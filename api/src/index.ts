import { createServer, startServer } from "./server";
import { characterDB, closeAllDatabases, economyDB } from "./database";
import { initializeRedis, closeRedis } from "./utils/cache";
import { logger as mainLogger } from "./config";

const logger = mainLogger.createNamedLogger("API");

async function main(): Promise<void> {
  try {
    await Promise.all([characterDB.ready, economyDB.ready, initializeRedis()]);

    const app = createServer();
    startServer(app);
  } catch (error) {
    logger.error("Failed to initialize API", { error });
    process.exit(1);
  }
}

void main();

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  try {
    await closeRedis();
    await closeAllDatabases();
    logger.info("Database and Redis connections closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", { error });
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  logger.info("SIGINT signal received: closing HTTP server");
  try {
    await closeRedis();
    await closeAllDatabases();
    logger.info("Database and Redis connections closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", { error });
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", { error });
  process.exit(1);
});
