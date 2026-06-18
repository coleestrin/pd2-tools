//@ts-nocheck
import request from "supertest";
import express, { Application } from "express";
import characterRoutes from "./characters";
import economyRoutes from "./economy";
import statisticsRoutes from "./statistics";
import healthRoutes from "./health";
import leaderboardRoutes from "./leaderboard";
import { characterDB, economyDB } from "../database";
import { calculateDamage } from "../utils/damage-calculator";

jest.mock("../utils/damage-calculator", () => ({
  calculateDamage: jest.fn(() => ({
    weaponOptions: [],
    skillOptions: [],
    playerAuraOptions: [],
    transformationOptions: [],
    alwaysActiveAuras: [],
    profiles: [],
    notes: [],
  })),
}));

jest.mock("../utils/cache", () => ({
  getCacheValue: jest.fn(() => Promise.resolve(undefined)), // Default: no cache hit
  setCacheValue: jest.fn(() => Promise.resolve(true)),
  deleteCacheValue: jest.fn(() => Promise.resolve(0)),
  clearCache: jest.fn(() => Promise.resolve()),
  initializeRedis: jest.fn(() => Promise.resolve()),
  closeRedis: jest.fn(() => Promise.resolve()),
}));

jest.mock("../database", () => ({
  characterDB: {
    getFilteredCharacters: jest.fn(),
    getCharacterByName: jest.fn(),
    getCharactersByAccount: jest.fn(),
    getCharacterSnapshots: jest.fn(),
    getCharacterSnapshot: jest.fn(),
    getLevelDistributions: jest.fn(),
    analyzeItemUsage: jest.fn(),
    analyzeSkillUsage: jest.fn(),
    analyzeMercTypeUsage: jest.fn(),
    analyzeMercItemUsage: jest.fn(),
    getOnlinePlayersHistory: jest.fn(),
    getLevel99Leaderboard: jest.fn(),
    getMirroredLeaderboard: jest.fn(),
  },
  economyDB: {
    getUniqueItemNames: jest.fn(),
    getListingsByDataDate: jest.fn(),
    getListingsByIngestionDate: jest.fn(),
  },
}));

jest.mock("../config", () => ({
  config: {
    currentSeason: 12,
    apiVersion: "v1",
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    createNamedLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

describe("API Routes", () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/v1/characters", characterRoutes);
    app.use("/api/v1/economy", economyRoutes);
    app.use("/api/v1/statistics", statisticsRoutes);
    app.use("/api/v1/health", healthRoutes);
    app.use("/api/v1/leaderboard", leaderboardRoutes);

    jest.clearAllMocks();
  });

  describe("Character Routes", () => {
    describe("GET /api/v1/characters", () => {
      it("should return filtered characters with default parameters", async () => {
        const mockResult = {
          total: 100,
          characters: [{ name: "TestChar", level: 90 }],
          breakdown: { softcore: 60, hardcore: 40 },
        };

        (characterDB.getFilteredCharacters as jest.Mock).mockResolvedValue(
          mockResult
        );

        const response = await request(app)
          .get("/api/v1/characters")
          .expect(200);

        expect(response.body).toEqual(mockResult);
        expect(characterDB.getFilteredCharacters).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({ season: 12 }),
          1,
          50
        );
      });

      it("should filter by level range", async () => {
        (characterDB.getFilteredCharacters as jest.Mock).mockResolvedValue({
          total: 10,
          characters: [],
          breakdown: {},
        });

        await request(app)
          .get("/api/v1/characters")
          .query({ minLevel: 80, maxLevel: 99 })
          .expect(200);

        expect(characterDB.getFilteredCharacters).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({
            levelRange: { min: 80, max: 99 },
          }),
          1,
          50
        );
      });

      it("should filter by classes", async () => {
        (characterDB.getFilteredCharacters as jest.Mock).mockResolvedValue({
          total: 5,
          characters: [],
          breakdown: {},
        });

        await request(app)
          .get("/api/v1/characters")
          .query({ classes: "Sorceress,Paladin" })
          .expect(200);

        expect(characterDB.getFilteredCharacters).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({
            requiredClasses: ["Sorceress", "Paladin"],
          }),
          1,
          50
        );
      });

      it("should filter by items", async () => {
        (characterDB.getFilteredCharacters as jest.Mock).mockResolvedValue({
          total: 3,
          characters: [],
          breakdown: {},
        });

        await request(app)
          .get("/api/v1/characters")
          .query({ items: "Shako,Enigma" })
          .expect(200);

        expect(characterDB.getFilteredCharacters).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({
            requiredItems: ["Shako", "Enigma"],
          }),
          1,
          50
        );
      });

      it("should filter by season", async () => {
        (characterDB.getFilteredCharacters as jest.Mock).mockResolvedValue({
          total: 20,
          characters: [],
          breakdown: {},
        });

        await request(app)
          .get("/api/v1/characters")
          .query({ season: 11 })
          .expect(200);

        expect(characterDB.getFilteredCharacters).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({ season: 11 }),
          1,
          50
        );
      });

      it("should filter by mercenary types", async () => {
        (characterDB.getFilteredCharacters as jest.Mock).mockResolvedValue({
          total: 15,
          characters: [],
          breakdown: {},
        });

        await request(app)
          .get("/api/v1/characters")
          .query({ mercTypes: "Offensive Auras,Cold Spells" })
          .expect(200);

        expect(characterDB.getFilteredCharacters).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({
            requiredMercTypes: ["Offensive Auras", "Cold Spells"],
          }),
          1,
          50
        );
      });

      it("should filter by mercenary items", async () => {
        (characterDB.getFilteredCharacters as jest.Mock).mockResolvedValue({
          total: 8,
          characters: [],
          breakdown: {},
        });

        await request(app)
          .get("/api/v1/characters")
          .query({ mercItems: "Colossus Voulge,Vampire Gaze" })
          .expect(200);

        expect(characterDB.getFilteredCharacters).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({
            requiredMercItems: ["Colossus Voulge", "Vampire Gaze"],
          }),
          1,
          50
        );
      });

      it("should handle pagination", async () => {
        (characterDB.getFilteredCharacters as jest.Mock).mockResolvedValue({
          total: 100,
          characters: [],
          breakdown: {},
        });

        await request(app)
          .get("/api/v1/characters")
          .query({ page: 3, pageSize: 25 })
          .expect(200);

        expect(characterDB.getFilteredCharacters).toHaveBeenCalledWith(
          "softcore",
          expect.any(Object),
          3,
          25
        );
      });

      it("should return 400 for invalid season", async () => {
        await request(app)
          .get("/api/v1/characters")
          .query({ season: "invalid" })
          .expect(400);
      });

      it("should handle database errors", async () => {
        (characterDB.getFilteredCharacters as jest.Mock).mockRejectedValue(
          new Error("Database error")
        );

        const response = await request(app)
          .get("/api/v1/characters")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to fetch characters" },
        });
      });
    });

    describe("GET /api/v1/characters/:name", () => {
      it("should return character by name", async () => {
        const mockCharacter = {
          character: { name: "TestChar", level: 90 },
          items: [],
        };

        (characterDB.getCharacterByName as jest.Mock).mockResolvedValue(
          mockCharacter
        );

        const response = await request(app)
          .get("/api/v1/characters/TestChar")
          .expect(200);

        expect(response.body).toEqual(mockCharacter);
        expect(characterDB.getCharacterByName).toHaveBeenCalledWith(
          "softcore",
          "TestChar",
          undefined
        );
      });

      it("should handle different game modes", async () => {
        (characterDB.getCharacterByName as jest.Mock).mockResolvedValue({});

        await request(app)
          .get("/api/v1/characters/TestChar")
          .query({ gameMode: "hardcore" })
          .expect(200);

        expect(characterDB.getCharacterByName).toHaveBeenCalledWith(
          "hardcore",
          "TestChar",
          undefined
        );
      });

      it("should handle season parameter", async () => {
        (characterDB.getCharacterByName as jest.Mock).mockResolvedValue({});

        await request(app)
          .get("/api/v1/characters/TestChar")
          .query({ season: 11 })
          .expect(200);

        expect(characterDB.getCharacterByName).toHaveBeenCalledWith(
          "softcore",
          "TestChar",
          11
        );
      });

      it("should return 404 when character not found", async () => {
        (characterDB.getCharacterByName as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .get("/api/v1/characters/NonExistent")
          .expect(404);

        expect(response.body).toEqual({
          error: { message: "Character not found" },
        });
      });

      it("should handle database errors", async () => {
        (characterDB.getCharacterByName as jest.Mock).mockRejectedValue(
          new Error("Database error")
        );

        const response = await request(app)
          .get("/api/v1/characters/TestChar")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to fetch character" },
        });
      });

      it("should return character data when damage calculation fails", async () => {
        const mockCharacter = {
          character: {
            name: "TestChar",
            level: 90,
            class: { name: "Druid" },
            attributes: {},
            skills: [],
          },
          items: [],
        };

        (characterDB.getCharacterByName as jest.Mock).mockResolvedValue(
          mockCharacter
        );
        (calculateDamage as jest.Mock).mockImplementationOnce(() => {
          throw new Error("Damage calculation error");
        });

        const response = await request(app)
          .get("/api/v1/characters/TestChar")
          .expect(200);

        expect(response.body).toEqual(mockCharacter);
        expect(calculateDamage).toHaveBeenCalled();
      });
    });

    describe("GET /api/v1/characters/accounts/:accountName", () => {
      it("should return all characters for an account", async () => {
        const mockCharacters = [
          {
            character: {
              name: "Char1",
              level: 90,
              class: { id: 1, name: "Sorceress" },
              life: 1000,
              mana: 500,
              season: 12,
            },
            items: [],
            realSkills: [],
            lastUpdated: Date.now(),
            accountName: "TestAccount",
          },
          {
            character: {
              name: "Char2",
              level: 85,
              class: { id: 4, name: "Paladin" },
              life: 1200,
              mana: 600,
              season: 12,
            },
            items: [],
            realSkills: [],
            lastUpdated: Date.now(),
            accountName: "TestAccount",
          },
        ];

        (characterDB.getCharactersByAccount as jest.Mock).mockResolvedValue(
          mockCharacters
        );

        const response = await request(app)
          .get("/api/v1/characters/accounts/TestAccount")
          .expect(200);

        expect(response.body.characters.length).toBe(2);
        expect(response.body.total).toBe(2);
        expect(characterDB.getCharactersByAccount).toHaveBeenCalledWith(
          "TestAccount",
          12
        );
      });

      it("should filter by season", async () => {
        const mockCharacters = [
          {
            character: { name: "Char1", level: 90 },
            accountName: "TestAccount",
          },
        ];

        (characterDB.getCharactersByAccount as jest.Mock).mockResolvedValue(
          mockCharacters
        );

        await request(app)
          .get("/api/v1/characters/accounts/TestAccount")
          .query({ season: 11 })
          .expect(200);

        expect(characterDB.getCharactersByAccount).toHaveBeenCalledWith(
          "TestAccount",
          11
        );
      });

      it("should return 404 for account with no characters", async () => {
        (characterDB.getCharactersByAccount as jest.Mock).mockResolvedValue([]);

        const response = await request(app)
          .get("/api/v1/characters/accounts/NonExistent")
          .expect(404);

        expect(response.body).toEqual({
          error: { message: "No characters found for this account" },
        });
      });

      it("should handle account names with special characters", async () => {
        const mockCharacters = [
          { character: { name: "TestChar" }, accountName: "Test_Account-123" },
        ];

        (characterDB.getCharactersByAccount as jest.Mock).mockResolvedValue(
          mockCharacters
        );

        const response = await request(app)
          .get("/api/v1/characters/accounts/Test_Account-123")
          .expect(200);

        expect(response.body.characters.length).toBe(1);
        expect(characterDB.getCharactersByAccount).toHaveBeenCalledWith(
          "Test_Account-123",
          12
        );
      });

      it("should handle database errors", async () => {
        (characterDB.getCharactersByAccount as jest.Mock).mockRejectedValue(
          new Error("Database error")
        );

        const response = await request(app)
          .get("/api/v1/characters/accounts/TestAccount")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to fetch characters by account" },
        });
      });

      it("should return characters with season information", async () => {
        const mockCharacters = [
          {
            character: {
              name: "Char1",
              level: 90,
              season: 12,
            },
            accountName: "TestAccount",
          },
        ];

        (characterDB.getCharactersByAccount as jest.Mock).mockResolvedValue(
          mockCharacters
        );

        const response = await request(app)
          .get("/api/v1/characters/accounts/TestAccount")
          .expect(200);

        expect(response.body.characters[0].character.season).toBe(12);
      });

      it("should use current season when no season specified", async () => {
        (characterDB.getCharactersByAccount as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/accounts/TestAccount")
          .expect(404);

        expect(characterDB.getCharactersByAccount).toHaveBeenCalledWith(
          "TestAccount",
          12
        );
      });

      it("should return 400 for invalid season parameter", async () => {
        await request(app)
          .get("/api/v1/characters/accounts/TestAccount")
          .query({ season: "invalid" })
          .expect(400);
      });
    });

    describe("GET /api/v1/characters/:name/snapshots", () => {
      it("should return all snapshots for a character", async () => {
        const mockSnapshots = [
          {
            snapshot_id: 1,
            snapshot_timestamp: Date.now(),
            level: 95,
            full_response_json: {
              character: { name: "TestChar", level: 95 },
            },
          },
          {
            snapshot_id: 2,
            snapshot_timestamp: Date.now() - 86400000, // 24h ago
            level: 90,
            full_response_json: {
              character: { name: "TestChar", level: 90 },
            },
          },
        ];

        (characterDB.getCharacterSnapshots as jest.Mock).mockResolvedValue(
          mockSnapshots
        );

        const response = await request(app)
          .get("/api/v1/characters/TestChar/snapshots")
          .expect(200);

        expect(response.body.snapshots.length).toBe(2);
        expect(response.body.total).toBe(2);
        expect(response.body.snapshots[0]).toHaveProperty("snapshot_id");
        expect(response.body.snapshots[0]).toHaveProperty("snapshot_timestamp");
        expect(response.body.snapshots[0]).toHaveProperty("level");
        expect(response.body.snapshots[0]).not.toHaveProperty(
          "full_response_json"
        ); // Should not include full JSON in list
        expect(characterDB.getCharacterSnapshots).toHaveBeenCalledWith(
          "softcore",
          "TestChar",
          12
        );
      });

      it("should filter snapshots by season", async () => {
        (characterDB.getCharacterSnapshots as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/TestChar/snapshots")
          .query({ season: 11 })
          .expect(404);

        expect(characterDB.getCharacterSnapshots).toHaveBeenCalledWith(
          "softcore",
          "TestChar",
          11
        );
      });

      it("should filter snapshots by game mode", async () => {
        (characterDB.getCharacterSnapshots as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/TestChar/snapshots")
          .query({ gameMode: "hardcore" })
          .expect(404);

        expect(characterDB.getCharacterSnapshots).toHaveBeenCalledWith(
          "hardcore",
          "TestChar",
          12
        );
      });

      it("should return 404 when no snapshots found", async () => {
        (characterDB.getCharacterSnapshots as jest.Mock).mockResolvedValue([]);

        const response = await request(app)
          .get("/api/v1/characters/NonExistent/snapshots")
          .expect(404);

        expect(response.body).toEqual({
          error: { message: "No snapshots found for this character" },
        });
      });

      it("should handle database errors", async () => {
        (characterDB.getCharacterSnapshots as jest.Mock).mockRejectedValue(
          new Error("Database error")
        );

        const response = await request(app)
          .get("/api/v1/characters/TestChar/snapshots")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to fetch character snapshots" },
        });
      });
    });

    describe("GET /api/v1/characters/:name/snapshots/:snapshotId", () => {
      it("should return specific snapshot by ID", async () => {
        const mockSnapshot = {
          character: {
            name: "TestChar",
            level: 95,
            life: 1500,
            mana: 800,
            experience: 2492671933,
            class: { id: 1, name: "Sorceress" },
            attributes: {
              strength: 100,
              dexterity: 80,
              vitality: 200,
              energy: 50,
            },
          },
          items: [
            {
              name: "Shako",
              quality: { name: "Unique" },
              location: { equipment: "Head" },
              properties: [],
            },
            {
              name: "Oculus",
              quality: { name: "Unique" },
              location: { equipment: "Right Hand" },
              properties: [],
            },
          ],
          realSkills: [],
          lastUpdated: Date.now(),
        };

        (characterDB.getCharacterSnapshot as jest.Mock).mockResolvedValue(
          mockSnapshot
        );

        const response = await request(app)
          .get("/api/v1/characters/TestChar/snapshots/123")
          .expect(200);

        expect(response.body.character.name).toBe("TestChar");
        expect(response.body.character.level).toBe(95);
        expect(characterDB.getCharacterSnapshot).toHaveBeenCalledWith(123);
      });

      it("should return 404 for non-existent snapshot", async () => {
        (characterDB.getCharacterSnapshot as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .get("/api/v1/characters/TestChar/snapshots/999")
          .expect(404);

        expect(response.body).toEqual({
          error: { message: "Snapshot not found" },
        });
      });

      it("should return 400 for invalid snapshot ID", async () => {
        const response = await request(app)
          .get("/api/v1/characters/TestChar/snapshots/invalid")
          .expect(400);

        expect(response.body).toEqual({
          error: { message: "Invalid snapshot ID" },
        });
      });

      it("should calculate realStats for snapshot with items", async () => {
        const mockSnapshot = {
          character: {
            name: "TestChar",
            level: 95,
            experience: 2492671933,
            class: { id: 1, name: "Sorceress" },
            attributes: {
              strength: 100,
              dexterity: 80,
              vitality: 200,
              energy: 50,
            },
          },
          items: [
            {
              name: "Shako",
              quality: { name: "Unique" },
              location: { equipment: "Head" },
              properties: [],
            },
          ],
          realSkills: [],
        };

        (characterDB.getCharacterSnapshot as jest.Mock).mockResolvedValue(
          mockSnapshot
        );

        const response = await request(app)
          .get("/api/v1/characters/TestChar/snapshots/123")
          .expect(200);

        expect(response.body).toHaveProperty("realStats"); // Should calculate stats
      });

      it("should handle database errors", async () => {
        (characterDB.getCharacterSnapshot as jest.Mock).mockRejectedValue(
          new Error("Database error")
        );

        const response = await request(app)
          .get("/api/v1/characters/TestChar/snapshots/123")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to fetch character snapshot" },
        });
      });
    });

    describe("GET /api/v1/characters/stats/level-distribution", () => {
      it("should return level distribution", async () => {
        const mockDistribution = {
          softcore: { 90: 50, 91: 30, 92: 20 },
          hardcore: { 90: 10, 91: 5 },
        };

        (characterDB.getLevelDistributions as jest.Mock).mockResolvedValue(
          mockDistribution
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/level-distribution")
          .expect(200);

        expect(response.body).toEqual(mockDistribution);
      });

      it("should filter by season", async () => {
        (characterDB.getLevelDistributions as jest.Mock).mockResolvedValue({});

        await request(app)
          .get("/api/v1/characters/stats/level-distribution")
          .query({ season: 11 })
          .expect(200);

        expect(characterDB.getLevelDistributions).toHaveBeenCalledWith(11);
      });

      it("should handle errors", async () => {
        (characterDB.getLevelDistributions as jest.Mock).mockRejectedValue(
          new Error("Error")
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/level-distribution")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to fetch level distribution" },
        });
      });
    });

    describe("GET /api/v1/characters/stats/item-usage", () => {
      it("should return item usage statistics", async () => {
        const mockUsage = [
          { itemName: "Shako", usageCount: 100, percentage: 50 },
        ];

        (characterDB.analyzeItemUsage as jest.Mock).mockResolvedValue(
          mockUsage
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/item-usage")
          .expect(200);

        expect(response.body).toEqual(mockUsage);
      });

      it("should apply filters", async () => {
        (characterDB.analyzeItemUsage as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/stats/item-usage")
          .query({
            gameMode: "hardcore",
            minLevel: 90,
            maxLevel: 99,
            classes: "Sorceress",
            season: 11,
          })
          .expect(200);

        expect(characterDB.analyzeItemUsage).toHaveBeenCalledWith("hardcore", {
          levelRange: { min: 90, max: 99 },
          requiredClasses: ["Sorceress"],
          season: 11,
        });
      });

      it("should apply mercenary filters", async () => {
        (characterDB.analyzeItemUsage as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/stats/item-usage")
          .query({
            gameMode: "softcore",
            mercTypes: "Offensive Auras",
            mercItems: "Colossus Voulge,Vampire Gaze",
            season: 12,
          })
          .expect(200);

        expect(characterDB.analyzeItemUsage).toHaveBeenCalledWith("softcore", {
          requiredMercTypes: ["Offensive Auras"],
          requiredMercItems: ["Colossus Voulge", "Vampire Gaze"],
          season: 12,
        });
      });

      it("should handle errors", async () => {
        (characterDB.analyzeItemUsage as jest.Mock).mockRejectedValue(
          new Error("Error")
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/item-usage")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to analyze item usage" },
        });
      });
    });

    describe("GET /api/v1/characters/stats/skill-usage", () => {
      it("should return skill usage statistics", async () => {
        const mockUsage = [
          {
            skillName: "Blessed Hammer",
            usageCount: 80,
            percentage: 40,
          },
        ];

        (characterDB.analyzeSkillUsage as jest.Mock).mockResolvedValue(
          mockUsage
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/skill-usage")
          .expect(200);

        expect(response.body).toEqual(mockUsage);
      });

      it("should apply filters", async () => {
        (characterDB.analyzeSkillUsage as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/stats/skill-usage")
          .query({
            gameMode: "softcore",
            minLevel: 85,
            classes: "Paladin,Sorceress",
            season: 12,
          })
          .expect(200);

        expect(characterDB.analyzeSkillUsage).toHaveBeenCalledWith("softcore", {
          levelRange: { min: 85 },
          requiredClasses: ["Paladin", "Sorceress"],
          season: 12,
        });
      });

      it("should apply mercenary filters", async () => {
        (characterDB.analyzeSkillUsage as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/stats/skill-usage")
          .query({
            gameMode: "hardcore",
            mercTypes: "Cold Spells,Fire Spells",
            mercItems: "Vampire Gaze",
            season: 11,
          })
          .expect(200);

        expect(characterDB.analyzeSkillUsage).toHaveBeenCalledWith("hardcore", {
          requiredMercTypes: ["Cold Spells", "Fire Spells"],
          requiredMercItems: ["Vampire Gaze"],
          season: 11,
        });
      });

      it("should handle errors", async () => {
        (characterDB.analyzeSkillUsage as jest.Mock).mockRejectedValue(
          new Error("Error")
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/skill-usage")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to analyze skill usage" },
        });
      });
    });

    describe("GET /api/v1/characters/stats/merc-type-usage", () => {
      it("should return mercenary type usage statistics", async () => {
        const mockUsage = [
          {
            mercType: "Offensive Auras",
            numOccurrences: 50,
            totalSample: 100,
            pct: 50,
          },
          {
            mercType: "Cold Spells",
            numOccurrences: 30,
            totalSample: 100,
            pct: 30,
          },
        ];

        (characterDB.analyzeMercTypeUsage as jest.Mock).mockResolvedValue(
          mockUsage
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/merc-type-usage")
          .expect(200);

        expect(response.body).toEqual(mockUsage);
        expect(characterDB.analyzeMercTypeUsage).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({ season: 12 })
        );
      });

      it("should apply filters including other merc filters", async () => {
        (characterDB.analyzeMercTypeUsage as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/stats/merc-type-usage")
          .query({
            gameMode: "hardcore",
            minLevel: 90,
            classes: "Sorceress",
            mercItems: "Colossus Voulge",
            season: 11,
          })
          .expect(200);

        expect(characterDB.analyzeMercTypeUsage).toHaveBeenCalledWith(
          "hardcore",
          {
            levelRange: { min: 90 },
            requiredClasses: ["Sorceress"],
            requiredMercItems: ["Colossus Voulge"],
            season: 11,
          }
        );
      });

      it("should handle errors", async () => {
        (characterDB.analyzeMercTypeUsage as jest.Mock).mockRejectedValue(
          new Error("Error")
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/merc-type-usage")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to analyze merc type usage" },
        });
      });
    });

    describe("GET /api/v1/characters/stats/merc-item-usage", () => {
      it("should return mercenary item usage statistics", async () => {
        const mockUsage = [
          {
            item: "Colossus Voulge",
            itemType: "Runeword",
            numOccurrences: 40,
            totalSample: 100,
            pct: 40,
          },
          {
            item: "Vampire Gaze",
            itemType: "Unique",
            numOccurrences: 25,
            totalSample: 100,
            pct: 25,
          },
        ];

        (characterDB.analyzeMercItemUsage as jest.Mock).mockResolvedValue(
          mockUsage
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/merc-item-usage")
          .expect(200);

        expect(response.body).toEqual(mockUsage);
        expect(characterDB.analyzeMercItemUsage).toHaveBeenCalledWith(
          "softcore",
          expect.objectContaining({ season: 12 })
        );
      });

      it("should apply filters including merc type filter", async () => {
        (characterDB.analyzeMercItemUsage as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/characters/stats/merc-item-usage")
          .query({
            gameMode: "softcore",
            classes: "Paladin,Sorceress",
            mercTypes: "Offensive Auras",
            items: "Harlequin Crest",
            season: 12,
          })
          .expect(200);

        expect(characterDB.analyzeMercItemUsage).toHaveBeenCalledWith(
          "softcore",
          {
            requiredClasses: ["Paladin", "Sorceress"],
            requiredMercTypes: ["Offensive Auras"],
            requiredItems: ["Harlequin Crest"],
            season: 12,
          }
        );
      });

      it("should handle errors", async () => {
        (characterDB.analyzeMercItemUsage as jest.Mock).mockRejectedValue(
          new Error("Error")
        );

        const response = await request(app)
          .get("/api/v1/characters/stats/merc-item-usage")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to analyze merc item usage" },
        });
      });
    });
  });

  describe("Economy Routes", () => {
    // TODO: Update economy route tests for new economy setup
    /* describe("GET /api/v1/economy/items", () => {
      it("should return unique item names", async () => {
        const mockItems = ["Shako", "Griffons", "Enigma"];

        (economyDB.getUniqueItemNames as jest.Mock).mockResolvedValue(
          mockItems
        );

        const response = await request(app)
          .get("/api/v1/economy/items")
          .expect(200);

        expect(response.body).toEqual(mockItems);
      });

      it("should filter by season", async () => {
        (economyDB.getUniqueItemNames as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/economy/items")
          .query({ season: 11 })
          .expect(200);

        expect(economyDB.getUniqueItemNames).toHaveBeenCalledWith(11);
      });

      it("should handle errors", async () => {
        (economyDB.getUniqueItemNames as jest.Mock).mockRejectedValue(
          new Error("Error")
        );

        const response = await request(app)
          .get("/api/v1/economy/items")
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to fetch item names" },
        });
      });
    });*/

    describe("GET /api/v1/economy/listings/:itemName", () => {
      it("should return listings for item by date", async () => {
        const mockListings = [
          {
            itemName: "Shako",
            priceStr: "1 HR",
            numericalPrice: 1.0,
          },
        ];

        (economyDB.getListingsByDataDate as jest.Mock).mockResolvedValue(
          mockListings
        );

        const response = await request(app)
          .get("/api/v1/economy/listings/Shako")
          .query({ date: "2025-01-01" })
          .expect(200);

        expect(response.body).toEqual(mockListings);
        expect(economyDB.getListingsByDataDate).toHaveBeenCalledWith(
          "Shako",
          "2025-01-01",
          undefined
        );
      });

      it("should return listings by ingestion date", async () => {
        const mockListings = [{ itemName: "SOJ", priceStr: "0.5 HR" }];

        (economyDB.getListingsByIngestionDate as jest.Mock).mockResolvedValue(
          mockListings
        );

        await request(app)
          .get("/api/v1/economy/listings/SOJ")
          .query({ ingestionDate: "2025-01-15" })
          .expect(200);

        expect(economyDB.getListingsByIngestionDate).toHaveBeenCalledWith(
          "SOJ",
          "2025-01-15",
          undefined
        );
      });

      it("should filter by season", async () => {
        (economyDB.getListingsByDataDate as jest.Mock).mockResolvedValue([]);

        await request(app)
          .get("/api/v1/economy/listings/Shako")
          .query({ date: "2025-01-01", season: 11 })
          .expect(200);

        expect(economyDB.getListingsByDataDate).toHaveBeenCalledWith(
          "Shako",
          "2025-01-01",
          11
        );
      });

      it("should return 400 when no date parameter provided", async () => {
        const response = await request(app)
          .get("/api/v1/economy/listings/Shako")
          .expect(400);

        expect(response.body).toEqual({
          error: {
            message: "Either date or ingestionDate query parameter is required",
          },
        });
      });

      it("should handle errors", async () => {
        (economyDB.getListingsByDataDate as jest.Mock).mockRejectedValue(
          new Error("Error")
        );

        const response = await request(app)
          .get("/api/v1/economy/listings/Shako")
          .query({ date: "2025-01-01" })
          .expect(500);

        expect(response.body).toEqual({
          error: { message: "Failed to fetch listings" },
        });
      });
    });
  });

  describe("Statistics Routes", () => {
    describe("GET /api/v1/statistics/online-players", () => {
      it("should return online players history", async () => {
        const mockHistory = [
          { timestamp: "2025-01-01", online: 1000, inGame: 500 },
        ];

        (characterDB.getOnlinePlayersHistory as jest.Mock).mockResolvedValue(
          mockHistory
        );

        const response = await request(app)
          .get("/api/v1/statistics/online-players")
          .expect(200);

        expect(response.body).toEqual(mockHistory);
      });

      it("should handle errors", async () => {
        (characterDB.getOnlinePlayersHistory as jest.Mock).mockRejectedValue(
          new Error("Error")
        );

        const response = await request(app)
          .get("/api/v1/statistics/online-players")
          .expect(500);

        expect(response.body).toEqual({
          error: {
            message: "Failed to fetch online players history",
          },
        });
      });
    });
  });

  describe("Health Routes", () => {
    describe("GET /api/v1/health", () => {
      it("should return health status", async () => {
        const response = await request(app).get("/api/v1/health").expect(200);

        expect(response.body).toEqual({
          status: "ok",
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        });
      });
    });
  });

  describe("Leaderboard Routes", () => {
    describe("GET /api/v1/leaderboard/level99", () => {
      it("should return level 99 leaderboard", async () => {
        const mockAccounts = [
          {
            account_name: "TopAccount",
            count: 5,
            game_mode: "softcore",
            season: 12,
            last_updated: Date.now(),
          },
        ];

        (characterDB.getLevel99Leaderboard as jest.Mock).mockResolvedValue(
          mockAccounts
        );

        const response = await request(app)
          .get("/api/v1/leaderboard/level99")
          .expect(200);

        expect(response.body).toEqual({
          leaderboard: mockAccounts,
          gameMode: "softcore",
          season: 12,
          total: 1,
        });
      });

      it("should handle errors", async () => {
        (characterDB.getLevel99Leaderboard as jest.Mock).mockRejectedValue(
          new Error("Database error")
        );

        const response = await request(app)
          .get("/api/v1/leaderboard/level99")
          .expect(500);

        expect(response.body).toEqual({
          error: "Failed to fetch level 99 leaderboard",
        });
      });
    });

    describe("GET /api/v1/leaderboard/mirrored", () => {
      it("should return mirrored item leaderboard", async () => {
        const mockItems = [
          {
            item_name: "Harlequin Crest",
            item_base_name: "Shako",
            count: 15,
            properties_signature: "sig123",
            example_item_json: { name: "Harlequin Crest" },
            example_character_name: "TestChar",
            game_mode: "softcore",
            season: 12,
            last_updated: Date.now(),
          },
        ];

        (characterDB.getMirroredLeaderboard as jest.Mock).mockResolvedValue(
          mockItems
        );

        const response = await request(app)
          .get("/api/v1/leaderboard/mirrored")
          .expect(200);

        expect(response.body).toEqual({
          leaderboard: mockItems,
          gameMode: "softcore",
          season: 12,
          total: 1,
        });
      });

      it("should handle errors", async () => {
        (characterDB.getMirroredLeaderboard as jest.Mock).mockRejectedValue(
          new Error("Database error")
        );

        const response = await request(app)
          .get("/api/v1/leaderboard/mirrored")
          .expect(500);

        expect(response.body).toEqual({
          error: "Failed to fetch mirrored leaderboard",
        });
      });
    });
  });
});
