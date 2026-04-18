import { Request, Response, Router } from "express";
import { config, logger as mainLogger } from "../config";
import { characterDB, economyDB } from "../database";
import type { FullCharacterResponse } from "../database";
import { autoCache } from "../middleware/auto-cache";
import { validateSeason } from "../middleware/validation";

const router = Router();
const logger = mainLogger.createNamedLogger("Home Routes");

const RECENT_CHARACTER_SAMPLE_SIZE = 5;
const RECENT_CHARACTER_LIMIT = 5;
const MARKET_ITEM_LIMIT = 5;
const LEADERBOARD_LIMIT = 8;
const ECONOMY_ITEM_POOL = [
  "Token of Absolution",
  "Larzuk's Puzzlebox",
  "Catalyst Shard",
  "Demonic Cube",
  "Larzuk's Puzzlepiece",
  "Zod Rune",
  "Cham Rune",
  "Jah Rune",
  "Ber Rune",
  "Sur Rune",
  "Lo Rune",
  "Ohm Rune",
  "Tainted Worldstone Shard",
  "Black Soulstone",
  "Pure Demonic Essence",
  "Prime Evil Soul",
  "Trang-Oul's Jawbone",
  "Splinter of the Void",
  "Hellfire Ashes",
  "Talisman of Transgression",
] as const;
const ALL_CLASSES = [
  "Amazon",
  "Sorceress",
  "Assassin",
  "Barbarian",
  "Druid",
  "Necromancer",
  "Paladin",
] as const;

interface RecentCharacterActivity {
  name: string;
  className: string;
  level: number;
  mode: "Softcore" | "Hardcore";
  lastUpdated: number;
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

function normalizeRecentCharacter(
  character: FullCharacterResponse,
  mode: "Softcore" | "Hardcore"
): RecentCharacterActivity | null {
  if (
    !character.character?.name ||
    !character.character.class?.name ||
    typeof character.character.level !== "number" ||
    typeof character.lastUpdated !== "number"
  ) {
    return null;
  }

  return {
    name: character.character.name,
    className: character.character.class.name,
    level: character.character.level,
    mode,
    lastUpdated: character.lastUpdated,
  };
}

function pickRandomItems<T>(items: T[], count: number): T[] {
  const pool = [...items];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

router.get(
  "/slider",
  validateSeason,
  autoCache(30),
  async (req: Request, res: Response) => {
    try {
      const season = req.query.season
        ? parseInt(req.query.season as string, 10)
        : config.currentSeason;

      let leaderboardSeason = config.currentSeason;
      if (req.query.leaderboardSeason !== undefined) {
        const parsedLeaderboardSeason = parsePositiveInteger(
          req.query.leaderboardSeason
        );

        if (parsedLeaderboardSeason === null) {
          res.status(400).json({
            error: {
              message: "Leaderboard season must be a positive integer",
            },
          });
          return;
        }

        leaderboardSeason = parsedLeaderboardSeason;
      }

      const [
        softcoreRecent,
        hardcoreRecent,
        softcoreMeta,
        economyItems,
        leaderboardData,
      ] =
        await Promise.all([
          characterDB.getRecentCharacters(
            "softcore",
            season,
            RECENT_CHARACTER_SAMPLE_SIZE
          ),
          characterDB.getRecentCharacters(
            "hardcore",
            season,
            RECENT_CHARACTER_SAMPLE_SIZE
          ),
          characterDB.getFilteredCharacters("softcore", { season }, 1, 0),
          economyDB.getItemsSummary(season, 7),
          characterDB.getLevel99Leaderboard("softcore", leaderboardSeason),
        ]);

      const recentCharacters = [
        ...softcoreRecent.map((character) =>
          normalizeRecentCharacter(character, "Softcore")
        ),
        ...hardcoreRecent.map((character) =>
          normalizeRecentCharacter(character, "Hardcore")
        ),
      ]
        .filter(
          (character): character is RecentCharacterActivity => character !== null
        )
        .sort((a, b) => b.lastUpdated - a.lastUpdated);

      const dedupedCharacters = new Map<string, RecentCharacterActivity>();
      for (const character of recentCharacters) {
        const key = `${character.mode}:${character.name.toLowerCase()}`;
        if (!dedupedCharacters.has(key)) {
          dedupedCharacters.set(key, character);
        }
      }

      const softcoreTotal = Number(softcoreMeta.breakdown.total || 0);
      const softcoreClasses = [...ALL_CLASSES]
        .map((className) => {
          const count = Number(softcoreMeta.breakdown[className] || 0);
          return {
            className,
            count,
            share: softcoreTotal > 0 ? count / softcoreTotal : 0,
          };
        })
        .sort((a, b) => b.count - a.count);

      const marketSnapshot = pickRandomItems(
        economyItems
        .map((item) => {
          const latest = item.price_data[item.price_data.length - 1];
          if (!latest || typeof latest.price !== "number") {
            return null;
          }

          if (!ECONOMY_ITEM_POOL.includes(item.item_name)) {
            return null;
          }

          return {
            itemName: item.item_name,
            price: latest.price,
            listings: latest.numListings,
          };
        })
        .filter(
          (
            item
          ): item is { itemName: string; price: number; listings: number } =>
            item !== null
        )
        ,
        MARKET_ITEM_LIMIT
      );

      const leaderboard = leaderboardData
        .slice(0, LEADERBOARD_LIMIT)
        .map((entry) => ({
          accountName: entry.account_name,
          count: entry.count,
        }));

      res.json({
        recentCharacters: Array.from(dedupedCharacters.values()).slice(
          0,
          RECENT_CHARACTER_LIMIT
        ),
        softcoreClasses,
        marketSnapshot,
        leaderboard,
      });
    } catch (error: unknown) {
      logger.error("Error fetching home slider data", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: {
          message: "Failed to fetch home slider data",
        },
      });
    }
  }
);

export default router;
