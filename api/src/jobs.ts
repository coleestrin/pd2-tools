import { startCharacterScraper } from "./jobs/character-scraper";
import { startOnlinePlayersTracker } from "./jobs/online-players-tracker";
import { startLeaderboardUpdater } from "./jobs/leaderboard-updater";
import { logger as mainLogger } from "./config";
import { characterDB, economyDB } from "./database";

const logger = mainLogger.createNamedLogger("Jobs");
/* We use a seperate jobs.ts file instead of placing it all in the main index.ts since we scale to 20 instances of the API in production */

async function main(): Promise<void> {
  await Promise.all([characterDB.ready, economyDB.ready]);

  // Start background jobs after the database schema is ready.
  startCharacterScraper().catch((error) => {
    logger.error("Failed to start character scraper:", error);
  });

  startOnlinePlayersTracker().catch((error) => {
    logger.error("Failed to start online players tracker:", error);
  });

  startLeaderboardUpdater().catch((error) => {
    logger.error("Failed to start leaderboard updater:", error);
  });
}

void main().catch((error) => {
  logger.error("Failed to initialize jobs", { error });
  process.exit(1);
});
