import { startCharacterScraper } from "./jobs/character-scraper";
import { startOnlinePlayersTracker } from "./jobs/online-players-tracker";
import { logger as mainLogger } from "./config";

const logger = mainLogger.createNamedLogger("Jobs");
/* We use a seperate jobs.ts file instead of placing it all in the main index.ts since we scale to 20 instances of the API in production */

//Start background jobs
startCharacterScraper().catch((error) => {
	logger.error("Failed to start character scraper:", error);
});

startOnlinePlayersTracker().catch((error) => {
  logger.error("Failed to start online players tracker:", error);
});
