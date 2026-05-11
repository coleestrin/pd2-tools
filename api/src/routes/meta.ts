import { Router, Request, Response } from "express";
import { metaDB } from "../database";
import type { ICohortFilter } from "../database/postgres/meta";
import { validateSeason } from "../middleware/validation";
import { autoCache } from "../middleware/auto-cache";
import { config, logger as mainLogger } from "../config";
import type {
  GameMode,
  IMetaResponse,
  ISkillRequirement,
} from "../types/meta";

const logger = mainLogger.createNamedLogger("META");
const router = Router();

/**
 * GET /api/meta
 *
 * Query params:
 *   gameMode   = "hardcore" | "softcore"  (default "softcore")
 *   className  = "Amazon" | "Assassin" | "Barbarian" | "Druid"
 *                | "Necromancer" | "Paladin" | "Sorceress"  (required)
 *   minLevel   = integer 1-99  (default 1)
 *   skills     = URL-encoded JSON array of { name: string, minLevel: number }
 *   season     = integer  (default config.currentSeason)
 *
 * Returns IMetaResponse: cohortSize + 5 aggregations.
 * Cached for 15 minutes via autoCache(900).
 */
router.get(
  "/",
  validateSeason,
  autoCache(900),
  async (req: Request, res: Response) => {
    try {
      // --- gameMode ---
      const gameModeRaw = req.query.gameMode;
      if (gameModeRaw !== undefined && typeof gameModeRaw !== "string") {
        res.status(400).json({
          error: { message: "gameMode must be a single value" },
        });
        return;
      }
      const gameModeValue = gameModeRaw || "softcore";
      if (gameModeValue !== "hardcore" && gameModeValue !== "softcore") {
        res.status(400).json({
          error: {
            message: `gameMode must be 'hardcore' or 'softcore' (got '${gameModeValue}')`,
          },
        });
        return;
      }
      const gameMode = gameModeValue as GameMode;

      // --- className ---
      const className = req.query.className;
      if (typeof className !== "string" || className.length === 0) {
        res.status(400).json({
          error: { message: "className is required" },
        });
        return;
      }

      // --- minLevel ---
      const minLevelRaw = req.query.minLevel;
      const minLevel =
        typeof minLevelRaw === "string" ? parseInt(minLevelRaw, 10) : 1;
      if (Number.isNaN(minLevel) || minLevel < 1 || minLevel > 99) {
        res.status(400).json({
          error: { message: "minLevel must be an integer 1-99" },
        });
        return;
      }

      // --- skills ---
      const skills: ISkillRequirement[] = [];
      const skillsRaw = req.query.skills;
      if (typeof skillsRaw === "string" && skillsRaw.length > 0) {
        try {
          const parsed = JSON.parse(decodeURIComponent(skillsRaw));
          if (!Array.isArray(parsed)) {
            throw new Error("not an array");
          }
          for (const s of parsed) {
            if (
              typeof s !== "object" ||
              s === null ||
              typeof s.name !== "string" ||
              typeof s.minLevel !== "number"
            ) {
              throw new Error(`malformed skill: ${JSON.stringify(s)}`);
            }
            skills.push({ name: s.name, minLevel: s.minLevel });
          }
        } catch (e) {
          res.status(400).json({
            error: {
              message: `skills must be a JSON array of { name, minLevel }: ${(e as Error).message}`,
            },
          });
          return;
        }
      }

      // --- season ---
      const seasonRaw = req.query.season;
      const season =
        typeof seasonRaw === "string"
          ? parseInt(seasonRaw, 10)
          : config.currentSeason;

      const filter: ICohortFilter = {
        gameMode,
        className,
        minLevel,
        skills,
        season,
      };

      const cohortIds = await metaDB.findCohort(filter);

      const [
        itemUsage,
        skillUsage,
        mercTypeUsage,
        mercItemUsage,
        levelDistribution,
        affixMods,
      ] = await Promise.all([
        metaDB.aggregateItemUsage(cohortIds),
        metaDB.aggregateSkillUsage(cohortIds),
        metaDB.aggregateMercType(cohortIds),
        metaDB.aggregateMercItems(cohortIds),
        metaDB.aggregateLevelDistribution(cohortIds, gameMode),
        metaDB.aggregateAffixMods(cohortIds),
      ]);

      const response: IMetaResponse = {
        cohortSize: cohortIds.length,
        itemUsage,
        skillUsage,
        mercTypeUsage,
        mercItemUsage,
        levelDistribution,
        affixMods,
      };

      logger.info("Meta aggregations served", {
        className,
        gameMode,
        season,
        minLevel,
        skillsCount: skills.length,
        cohortSize: cohortIds.length,
      });
      res.json(response);
    } catch (error: unknown) {
      logger.error("Error fetching meta aggregations", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch meta aggregations" },
      });
    }
  }
);

export default router;
