import cron from "node-cron";
import fetch from "node-fetch";
import { characterDB } from "../database";
import { logger as mainLogger } from "../config";

const logger = mainLogger.createNamedLogger("Online Players Tracker");

async function recordOnlinePlayers() {
  try {
    const resp = await fetch("https://api.projectdiablo2.com/game/online", {
      compress: false,
      timeout: 30000,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        Connection: "close",
        "User-Agent": "pd2.tools/1.0 (+https://pd2.tools)",
      },
    });
    if (!resp.ok) {
      logger.error(
        `Failed to fetch online players: ${resp.status} ${resp.statusText}`
      );
      return;
    }

    const data = await resp.json();
    if (Array.isArray(data)) {
      await characterDB.logOnlinePlayers(data.length);
      logger.info(`Recorded ${data.length} online players`);
    } else {
      logger.warn("Unexpected response format from online players endpoint");
    }
  } catch (err) {
    logger.error("Error recording online players:", err);
  }
}

export async function startOnlinePlayersTracker(): Promise<void> {
  logger.info(
    "Online Players Tracker starting. Cron job scheduled for every 15 minutes."
  );

  // Run every 15 minutes
  cron.schedule("*/15 * * * *", recordOnlinePlayers);

  // Run immediately on start
  await recordOnlinePlayers();

  logger.info("Online Players Tracker initialized successfully.");
}
