import { Router, Request, Response } from "express";
import { economyDB } from "../database";
import { validateSeason } from "../middleware/validation";
import { config, logger as mainLogger } from "../config";
import { getCacheValue, setCacheValue } from "../utils/cache";

const logger = mainLogger.createNamedLogger("API");
const router = Router();

// GET /api/economy/items - Get items with aggregated price data
router.get("/items", validateSeason, async (req: Request, res: Response) => {
  try {
    const { season, days } = req.query;
    const seasonNumber = season
      ? parseInt(season as string, 10)
      : config.currentSeason;
    const daysOfHistory = days ? parseInt(days as string, 10) : 7;
    const cacheKey = `economy:items:${seasonNumber}:${daysOfHistory}`;

    // Check cache first
    const cached = getCacheValue(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // Fetch aggregated data from database
    const items = await economyDB.getItemsSummary(seasonNumber, daysOfHistory);

    // Get total count for additional context
    const totalListings = await economyDB.getTotalListingsCount(seasonNumber);

    const response = {
      items,
      totalListings,
      lastUpdated: new Date().toISOString(),
    };

    // Store in cache
    setCacheValue(cacheKey, response);

    res.json(response);
  } catch (error: unknown) {
    logger.error("Error fetching item data", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: { message: "Failed to fetch item data" },
    });
  }
});

// GET /api/economy/listings/:itemName - Get listings for an item
router.get(
  "/listings/:itemName",
  validateSeason,
  async (req: Request, res: Response) => {
    try {
      const { itemName } = req.params;
      const { date, ingestionDate, season } = req.query;
      const seasonNumber = season ? parseInt(season as string, 10) : undefined;

      if (!date && !ingestionDate) {
        res.status(400).json({
          error: {
            message: "Either date or ingestionDate query parameter is required",
          },
        });
        return;
      }

      let listings;

      if (date) {
        listings = await economyDB.getListingsByDataDate(
          itemName,
          date as string,
          seasonNumber
        );
      } else {
        listings = await economyDB.getListingsByIngestionDate(
          itemName,
          ingestionDate as string,
          seasonNumber
        );
      }

      res.json(listings);
    } catch (error: unknown) {
      logger.error("Error fetching listings", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch listings" },
      });
    }
  }
);

// GET /api/economy/items/:itemName - Get detailed item data
router.get(
  "/items/:itemName",
  validateSeason,
  async (req: Request, res: Response) => {
    try {
      const { itemName } = req.params;
      const { season, limit } = req.query;
      const seasonNumber = season ? parseInt(season as string, 10) : undefined;
      const listingLimit = limit ? parseInt(limit as string, 10) : 100;
      const cacheKey = `economy:item:${itemName}:${seasonNumber}:${listingLimit}`;

      // Check cache first
      const cached = getCacheValue(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      // Fetch from database
      const data = await economyDB.getItemDetail(
        itemName,
        seasonNumber,
        listingLimit
      );

      // Store in cache
      setCacheValue(cacheKey, data);

      res.json(data);
    } catch (error: unknown) {
      logger.error("Error fetching item detail", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch item detail" },
      });
    }
  }
);

// GET /api/economy/listings-count - Get total listings count
router.get(
  "/listings-count",
  validateSeason,
  async (req: Request, res: Response) => {
    try {
      const { season } = req.query;
      const seasonNumber = season
        ? parseInt(season as string, 10)
        : config.currentSeason;
      const cacheKey = `economy:listings-count:${seasonNumber}`;

      // Check cache first
      const cached = getCacheValue(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      // Fetch from database
      const total = await economyDB.getTotalListingsCount(seasonNumber);
      const response = { total };

      // Store in cache
      setCacheValue(cacheKey, response);

      res.json(response);
    } catch (error: unknown) {
      logger.error("Error fetching listings count", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { message: "Failed to fetch listings count" },
      });
    }
  }
);

export default router;

