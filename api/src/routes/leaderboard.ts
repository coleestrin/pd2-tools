import { Router, Request, Response } from "express";
import { characterDB } from "../database";
import { config, logger as mainLogger } from "../config";
import { validateSeason } from "../middleware/validation";

const router = Router();
const logger = mainLogger.createNamedLogger("Leaderboard Routes");

/**
 * GET /leaderboard/level99
 * Get level 99 account leaderboard
 *
 * Query params:
 * - gameMode: "softcore" | "hardcore" (default: "softcore")
 * - season: number (default: current season)
 */
router.get("/level99", validateSeason, async (req: Request, res: Response) => {
  try {
    const gameMode = (req.query.gameMode as string) || "softcore";
    const season = req.query.season
      ? parseInt(req.query.season as string, 10)
      : config.currentSeason;

    const leaderboard = await characterDB.getLevel99Leaderboard(
      gameMode,
      season
    );

    return res.json({
      leaderboard,
      gameMode,
      season,
      total: leaderboard.length,
    });
  } catch (error) {
    logger.error("Error fetching level 99 leaderboard", { error });
    return res
      .status(500)
      .json({ error: "Failed to fetch level 99 leaderboard" });
  }
});

/**
 * GET /leaderboard/mirrored
 * Get mirrored item leaderboard
 *
 * Query params:
 * - gameMode: "softcore" | "hardcore" (default: "softcore")
 * - season: number (default: current season)
 */
router.get(
  "/mirrored",
  validateSeason,
  async (req: Request, res: Response) => {
    try {
      const gameMode = (req.query.gameMode as string) || "softcore";
      const season = req.query.season
        ? parseInt(req.query.season as string, 10)
        : config.currentSeason;

      const leaderboard = await characterDB.getMirroredLeaderboard(
        gameMode,
        season
      );

      return res.json({
        leaderboard,
        gameMode,
        season,
        total: leaderboard.length,
      });
    } catch (error) {
      logger.error("Error fetching mirrored leaderboard", { error });
      return res
        .status(500)
        .json({ error: "Failed to fetch mirrored leaderboard" });
    }
});

export default router;
