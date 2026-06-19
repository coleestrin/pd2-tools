import cron from "node-cron";
import fetch from "node-fetch";
import { Profanity } from "@2toad/profanity";
import { characterDB } from "../database";
import { FullCharacterResponse } from "../database/postgres";
import { calculateTotalSkills } from "../utils/skill-calculator";
import { config, logger as mainLogger } from "../config";
import { CharacterApiResponse, CharacterResponse } from "../types";
import fs from "fs";

/* 
	Context:
	- At HalfCrimp's request we skip 12-2 PM PST as those are peak hours, and we keep it to <1 req/s outside of that.
		- You shouldn't modify these since it would go against their wishes, if you want to test a frontend update or something similar with a large amount of character data, you can just use api.pd2.tools.
	- We use Profanity to filter out vulgar character names since we can't have extreme NSFW text on the page w/ the ad provider I'm using.
*/

const logger = mainLogger.createNamedLogger("Character Scraper");

type ApiRequest = {
  url: string;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

type CharacterQueueItem = {
  characterName: string;
  sourceAccount: string;
};

type PersistentData = {
  seenAccounts: Record<string, number>;
  nlChars: string[];
};

// fixed settings per api limits so doesn't need to be in .env
const CONFIG = {
  API_REQUEST_COOLDOWN_MS: 1000,
  PERSISTENCE_FILE: "./data/seen.json",
  MIN_LVL_TO_INGEST: 80,
  MS_BETWEEN_ACCOUNT_CHECKS: 1 * 24 * 60 * 60 * 1000, // 1 day
  CONSUMER_ERROR_RETRY_WAIT_MS: 10 * 1000, // 10 seconds
  CONSUMER_EMPTY_QUEUE_SLEEP_MS: 5000, // 5 seconds
  RATE_CHECK_INTERVAL_MS: 60 * 1000,
  PRODUCER_CRON_SCHEDULE: "*/30 * * * *", // Every 30 minutes
  BLOCKED_HOURS: { start: 12, end: 14 }, // 12-2 PM PST
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isInBlockedTime(): boolean {
  /*const pstDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const hour = pstDate.getHours();*/
  return false; //hour >= CONFIG.BLOCKED_HOURS.start && hour < CONFIG.BLOCKED_HOURS.end; not needed for end season(?)
}

function formatUptime(uptimeInSeconds: number): string {
  const days = Math.floor(uptimeInSeconds / (3600 * 24));
  const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeInSeconds % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

class PersistenceManager {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  save(seenAccMap: Map<string, number>, nlCharSet: Set<string>): void {
    const data: PersistentData = {
      seenAccounts: Object.fromEntries(seenAccMap),
      nlChars: Array.from(nlCharSet),
    };
    fs.mkdirSync("./data", { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  load(): { seenAccMap: Map<string, number>; nlCharSet: Set<string> } {
    try {
      if (fs.existsSync(this.filePath)) {
        const data: PersistentData = JSON.parse(
          fs.readFileSync(this.filePath, "utf8")
        );
        return {
          seenAccMap: new Map(Object.entries(data.seenAccounts)),
          nlCharSet: new Set(data.nlChars),
        };
      }
    } catch (error) {
      logger.warn("Failed to load persistent data:", error);
    }
    return { seenAccMap: new Map(), nlCharSet: new Set() };
  }
}

class ApiClient {
  private readonly requestQueue: ApiRequest[] = [];
  private isProcessingRequests = false;
  private totalRequests = 0;

  async makeRequest(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, resolve, reject });
      if (!this.isProcessingRequests) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingRequests || this.requestQueue.length === 0) return;
    this.isProcessingRequests = true;

    while (this.requestQueue.length > 0) {
      if (isInBlockedTime()) {
        logger.debug("In blocked time, waiting 1m before trying again");
        await sleep(60000); // Check every minute during blocked time
        continue;
      }

      const request = this.requestQueue.shift()!;
      try {
        const response = await fetch(request.url, {
          compress: false,
          timeout: 30000,
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "identity",
            Connection: "close",
            "User-Agent": "pd2.tools/1.0 (+https://pd2.tools)",
          },
        });
        const data = await response.json();
        request.resolve(data);
      } catch (error) {
        request.reject(error);
      }

      this.totalRequests++;
      await sleep(CONFIG.API_REQUEST_COOLDOWN_MS); // Ensure exactly 1 second or more (latency) between requests
    }

    this.isProcessingRequests = false;
  }

  async getAllOnlineAccounts(): Promise<string[]> {
    try {
      const data = await this.makeRequest(
        "https://api.projectdiablo2.com/game/online"
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      logger.error("getAllOnlineAccounts: Fetch failed", error);
      return [];
    }
  }

  async getAllCharsFromAccount(accName: string): Promise<string[]> {
    try {
      const res = (await this.makeRequest(
        `https://api.projectdiablo2.com/game/account/${encodeURIComponent(accName)}`
      )) as { characters?: string[] };
      return res && Array.isArray(res.characters) ? res.characters : [];
    } catch (error) {
      logger.error(
        `getAllCharsFromAccount for ${accName}: Fetch failed`,
        error
      );
      return [];
    }
  }

  async getChar(charName: string): Promise<CharacterApiResponse | null> {
    try {
      return (await this.makeRequest(
        `https://api.projectdiablo2.com/game/character/${encodeURIComponent(charName)}`
      )) as CharacterApiResponse;
    } catch (error) {
      logger.error(`getChar for ${charName}: Fetch failed`, error);
      return null;
    }
  }

  getTotalRequests(): number {
    return this.totalRequests;
  }
}

class ProfanityFilter {
  private readonly profanity: Profanity;

  constructor() {
    this.profanity = new Profanity({ wholeWord: false });
  }

  isProfane(text: string): boolean {
    return this.profanity.exists(text);
  }
}

class ProducerJob {
  private isRunning = false;
  private readonly apiClient: ApiClient;
  private readonly profanityFilter: ProfanityFilter;

  constructor(apiClient: ApiClient, profanityFilter: ProfanityFilter) {
    this.apiClient = apiClient;
    this.profanityFilter = profanityFilter;
  }

  async run(
    queue: CharacterQueueItem[],
    seenAccMap: Map<string, number>,
    nlCharSet: Set<string>
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn(
        "Producer cron: Previous job still running, skipping this execution."
      );
      return;
    }

    logger.info("Producer cron: STARTING JOB.");
    this.isRunning = true;
    const jobStartTime = Date.now();
    let accountsAddedToQueueCount = 0;
    let charactersAddedToQueueCount = 0;

    try {
      const onlineAccounts = await this.apiClient.getAllOnlineAccounts();
      if (!onlineAccounts.length) {
        logger.debug("Producer cron: No online accounts found or API error.");
        return;
      }

      logger.debug(
        `Producer cron: Fetched ${onlineAccounts.length} online account names.`
      );

      for (const accountName of onlineAccounts) {
        if (!this.isValidAccountName(accountName)) {
          logger.warn(
            `Producer cron: Skipping invalid account name: '${accountName}'`
          );
          continue;
        }

        if (!this.shouldCheckAccount(accountName, seenAccMap)) {
          continue;
        }

        accountsAddedToQueueCount++;
        const characterNames =
          await this.apiClient.getAllCharsFromAccount(accountName);
        seenAccMap.set(accountName, Date.now());

        if (characterNames.length > 0) {
          logger.debug(
            `Producer cron: Account ${accountName} has ${characterNames.length} characters. Current queue size: ${queue.length}`
          );
          for (const charName of characterNames) {
            if (this.profanityFilter.isProfane(charName)) {
              logger.warn(
                `Producer cron: Skipping profane character name '${charName}' from account ${accountName}`
              );
              continue;
            }
            if (!this.isValidCharacterName(charName)) {
              logger.warn(
                `Producer cron: Skipping invalid character name '${charName}' from account ${accountName}`
              );
              continue;
            }
            if (nlCharSet.has(charName)) {
              logger.debug(
                `Producer cron: Skipping known NL/bricked char ${charName}.`
              );
              continue;
            }
            queue.push({
              characterName: charName,
              sourceAccount: accountName,
            });
            charactersAddedToQueueCount++;
          }
        }
      }
      logger.info(
        `Producer cron: Processed ${accountsAddedToQueueCount} eligible accounts. Added ${charactersAddedToQueueCount} characters to the queue. Current queue size: ${queue.length}`
      );
    } catch (error) {
      logger.error("Producer cron: Unhandled error in job execution:", error);
    } finally {
      const jobDurationSeconds = (Date.now() - jobStartTime) / 1000;
      logger.info(
        `Producer cron: JOB FINISHED in ${jobDurationSeconds.toFixed(2)}s. Queue size: ${queue.length}`
      );
      this.isRunning = false;
    }
  }

  private isValidAccountName(accountName: unknown): accountName is string {
    return typeof accountName === "string" && accountName.trim() !== "";
  }

  private isValidCharacterName(charName: unknown): charName is string {
    return typeof charName === "string" && charName.trim() !== "";
  }

  private shouldCheckAccount(
    accountName: string,
    seenAccMap: Map<string, number>
  ): boolean {
    const lastCheckedTs = seenAccMap.get(accountName);
    return (
      !lastCheckedTs ||
      Date.now() - lastCheckedTs >= CONFIG.MS_BETWEEN_ACCOUNT_CHECKS
    );
  }
}

class ConsumerWorker {
  private readonly apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  async processQueue(
    queue: CharacterQueueItem[],
    nlCharSet: Set<string>
  ): Promise<void> {
    logger.info("Consumer: Worker started. Waiting for characters in queue...");

    while (true) {
      if (queue.length === 0) {
        await sleep(CONFIG.CONSUMER_EMPTY_QUEUE_SLEEP_MS);
        continue;
      }

      const itemToProcess = queue.shift();
      if (!itemToProcess) continue;

      const { characterName, sourceAccount } = itemToProcess;
      logger.debug(
        `Consumer: Processing ${characterName} (from ${sourceAccount}). Queue items remaining: ${queue.length}`
      );

      try {
        await this.processCharacter(characterName, sourceAccount, nlCharSet);
      } catch (error) {
        logger.error(
          `Consumer: CRITICAL error processing ${characterName} from account ${sourceAccount}:`,
          error
        );
        logger.debug(
          `Consumer: Waiting ${CONFIG.CONSUMER_ERROR_RETRY_WAIT_MS / 1000}s before continuing with next item.`
        );
        await sleep(CONFIG.CONSUMER_ERROR_RETRY_WAIT_MS);
      }
    }
  }

  private async processCharacter(
    characterName: string,
    sourceAccount: string,
    nlCharSet: Set<string>
  ): Promise<void> {
    const charData = await this.apiClient.getChar(characterName);

    if (!charData) {
      logger.warn(
        `Consumer: Failed to fetch data for ${characterName}. Skipping.`
      );
      return;
    }

    if (!charData.character || !charData.character.status) {
      logger.warn(
        `Consumer: Incomplete data for ${characterName} (missing character or status object). Skipping.`
      );
      return;
    }

    if (charData.character.status.is_ladder) {
      if (this.shouldIngestCharacter(charData)) {
        await this.ingestCharacter(charData, sourceAccount);
      } else {
        logger.debug(
          `Consumer: Skipped ${characterName} (Lvl ${charData.character.level || "N/A"}), ladder but low level.`
        );
      }
    } else {
      logger.debug(
        `Consumer: ${characterName} is non-ladder. Adding to skip set.`
      );
      nlCharSet.add(characterName);
    }
  }

  private shouldIngestCharacter(charData: CharacterApiResponse): boolean {
    return (
      charData.character?.level !== undefined &&
      charData.character.level >= CONFIG.MIN_LVL_TO_INGEST
    );
  }

  private async ingestCharacter(
    charData: CharacterApiResponse,
    sourceAccount: string
  ): Promise<void> {
    const gameMode = charData.character!.status!.is_hardcore
      ? "hardcore"
      : "softcore";
    charData.lastUpdated = Date.now();
    charData.realSkills = calculateTotalSkills(
      charData as unknown as CharacterResponse
    );

    await characterDB.ingestCharacter(
      charData as FullCharacterResponse,
      gameMode,
      config.currentSeason,
      sourceAccount
    );
    logger.debug(
      `Consumer: Ingested ${charData.character!.name} (Lvl ${charData.character!.level}, ${gameMode}).`
    );
  }
}

class RateMonitor {
  private interval: NodeJS.Timeout | null = null;
  private readonly apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  start(): void {
    this.interval = setInterval(() => {
      const uptimeInSeconds = process.uptime();
      const totalRequests = this.apiClient.getTotalRequests();
      const avgReqPerSec = totalRequests / uptimeInSeconds;
      const uptime = formatUptime(uptimeInSeconds);

      logger.info(
        `API Requests - Average: ${avgReqPerSec.toFixed(2)}/s, Total: ${totalRequests} | Uptime: ${uptime}`
      );
    }, CONFIG.RATE_CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

class PriorityAccountProcessor {
  private readonly apiClient: ApiClient;
  private readonly priorityAccountsFile = "./data/priority-accounts.json";
  private isRunning = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(apiClient: ApiClient, _profanityFilter: ProfanityFilter) {
    this.apiClient = apiClient;
  }

  async run(
    queue: CharacterQueueItem[],
    seenAccMap: Map<string, number>,
    nlCharSet: Set<string>
  ): Promise<void> {
    if (this.isRunning) {
      logger.debug("Priority processor: Already running, skipping.");
      return;
    }

    // Read priority accounts file
    if (!fs.existsSync(this.priorityAccountsFile)) {
      return; // No file, nothing to do
    }

    let priorityAccounts: Array<{
      accountName: string;
      requestedAt: number;
      requestedByIp: string;
    }> = [];

    try {
      const data = fs.readFileSync(this.priorityAccountsFile, "utf-8");
      priorityAccounts = JSON.parse(data);
    } catch (error) {
      logger.error(
        "Priority processor: Error reading priority accounts file:",
        error
      );
      return;
    }

    if (priorityAccounts.length === 0) {
      return; // Empty file, nothing to do
    }

    this.isRunning = true;
    logger.info(
      `Priority processor: Processing ${priorityAccounts.length} priority accounts.`
    );

    try {
      for (const { accountName } of priorityAccounts) {
        if (!this.isValidAccountName(accountName)) {
          logger.warn(
            `Priority processor: Skipping invalid account name: '${accountName}'`
          );
          continue;
        }

        // Fetch characters from account
        const characterNames =
          await this.apiClient.getAllCharsFromAccount(accountName);
        seenAccMap.set(accountName, Date.now());

        if (characterNames.length > 0) {
          logger.info(
            `Priority processor: Account ${accountName} has ${characterNames.length} characters. Adding all to priority queue.`
          );

          for (const charName of characterNames) {
            if (!this.isValidCharacterName(charName)) {
              logger.warn(
                `Priority processor: Skipping invalid character name '${charName}'`
              );
              continue;
            }
            if (nlCharSet.has(charName)) {
              logger.debug(
                `Priority processor: Skipping known NL/bricked char ${charName}.`
              );
              continue;
            }

            // Push to FRONT of queue - ConsumerWorker will handle validation
            queue.unshift({
              characterName: charName,
              sourceAccount: accountName,
            });
          }

          logger.info(
            `Priority processor: Added ${characterNames.length} characters from ${accountName} to priority queue.`
          );
        }

        // Sleep 1 second between account API calls to respect rate limit
        await sleep(1000);
      }

      // Clear priority accounts file after processing
      fs.writeFileSync(this.priorityAccountsFile, JSON.stringify([], null, 2));
      logger.info(
        `Priority processor: Processed and cleared ${priorityAccounts.length} priority accounts.`
      );
    } catch (error) {
      logger.error("Priority processor: Error processing accounts:", error);
    } finally {
      this.isRunning = false;
    }
  }

  private isValidAccountName(accountName: unknown): accountName is string {
    return typeof accountName === "string" && accountName.trim() !== "";
  }

  private isValidCharacterName(charName: unknown): charName is string {
    return typeof charName === "string" && charName.trim() !== "";
  }
}

class CharacterScraper {
  private readonly apiClient: ApiClient;
  private readonly profanityFilter: ProfanityFilter;
  private readonly persistence: PersistenceManager;
  private readonly producerJob: ProducerJob;
  private readonly priorityProcessor: PriorityAccountProcessor;
  private readonly consumerWorker: ConsumerWorker;
  private readonly rateMonitor: RateMonitor;

  private readonly characterQueue: CharacterQueueItem[] = [];
  private seenAccMap!: Map<string, number>;
  private nlCharSet!: Set<string>;

  constructor() {
    this.apiClient = new ApiClient();
    this.profanityFilter = new ProfanityFilter();
    this.persistence = new PersistenceManager(CONFIG.PERSISTENCE_FILE);
    this.producerJob = new ProducerJob(this.apiClient, this.profanityFilter);
    this.priorityProcessor = new PriorityAccountProcessor(
      this.apiClient,
      this.profanityFilter
    );
    this.consumerWorker = new ConsumerWorker(this.apiClient);
    this.rateMonitor = new RateMonitor(this.apiClient);
  }

  async start(): Promise<void> {
    // Load persistent data
    const persistentData = this.persistence.load();
    this.seenAccMap = persistentData.seenAccMap;
    this.nlCharSet = persistentData.nlCharSet;

    // Start rate monitoring
    this.rateMonitor.start();

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    // Log startup information
    this.logStartupInfo();

    // Schedule producer cron job (runs every 30 minutes)
    cron.schedule(CONFIG.PRODUCER_CRON_SCHEDULE, () => {
      this.runProducerJob();
    });

    // Schedule priority account processor (runs every 1 minute)
    cron.schedule("*/1 * * * *", () => {
      this.runPriorityProcessor();
    });

    // Start consumer worker (runs continuously)
    this.startConsumerWorker();

    logger.info("Character Scraper initialized successfully.");

    // Run producer job immediately on startup
    logger.info("Running initial producer job on startup...");
    this.runProducerJob();
  }

  private async runProducerJob(): Promise<void> {
    await this.producerJob.run(
      this.characterQueue,
      this.seenAccMap,
      this.nlCharSet
    );
  }

  private async runPriorityProcessor(): Promise<void> {
    await this.priorityProcessor.run(
      this.characterQueue,
      this.seenAccMap,
      this.nlCharSet
    );
  }

  private startConsumerWorker(): void {
    this.consumerWorker
      .processQueue(this.characterQueue, this.nlCharSet)
      .catch((criticalError) => {
        logger.error(
          "Consumer: FATAL ERROR in worker loop. Exiting.",
          criticalError
        );
        process.exit(1);
      });
  }

  private setupGracefulShutdown(): void {
    process.on("SIGINT", () => {
      this.rateMonitor.stop();
      this.persistence.save(this.seenAccMap, this.nlCharSet);
      logger.info("Gracefully shutting down, saved persistent data");
      process.exit(0);
    });
  }

  private logStartupInfo(): void {
    logger.info(
      "Character Scraper starting. Producer cron job scheduled for every 30 minutes."
    );
    logger.info("Priority account processor scheduled for every 1 minute.");
    logger.info(
      `Account check cooldown: ${CONFIG.MS_BETWEEN_ACCOUNT_CHECKS / (60 * 60 * 1000)} hours.`
    );
    logger.info(`Min level to ingest: ${CONFIG.MIN_LVL_TO_INGEST}.`);
  }
}

export async function startCharacterScraper(): Promise<void> {
  const scraper = new CharacterScraper();
  await scraper.start();
}
