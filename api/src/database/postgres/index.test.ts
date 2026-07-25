//@ts-nocheck
import CharacterDB_Postgres from "./index";
import { CharacterFilter, FullCharacterResponse } from "./index";

process.env.POSTGRES_DB = "pd2_tools_test";
process.env.POSTGRES_USER = "test_user";
process.env.POSTGRES_PASSWORD = "test_password";
process.env.POSTGRES_HOST = "localhost";
process.env.POSTGRES_PORT = "5432";

// Sample test data
const sampleChar1_Sorc = {
  character: {
    name: "TestSorc1",
    level: 80,
    life: 1000,
    mana: 500,
    experience: 681027665,
    class: { id: 1, name: "Sorceress" },
    skills: [
      { id: 1, name: "Fire Ball", level: 20 },
      { id: 2, name: "Teleport", level: 15 },
    ],
  },
  items: [
    { name: "Shako", quality: { name: "Unique" } },
    {
      name: "Spirit Monarch",
      quality: { name: "Runeword" },
      runeword: true,
    },
    { name: "Sigon's Gage", quality: { name: "Set" } },
  ],
  realSkills: [],
  lastUpdated: 1678886400000,
};

const sampleChar2_Pala = {
  character: {
    name: "TestPala1",
    level: 90,
    life: 1200,
    mana: 600,
    experience: 1618470619,
    class: { id: 4, name: "Paladin" },
    skills: [
      { id: 10, name: "Blessed Hammer", level: 20 },
      { id: 11, name: "Concentration", level: 20 },
    ],
  },
  items: [
    { name: "Shako", quality: { name: "Unique" } },
    {
      name: "Heart of the Oak",
      quality: { name: "Runeword" },
      runeword: true,
    },
  ],
  realSkills: [],
  lastUpdated: Date.now(),
};

const sampleChar3_Sorc = {
  character: {
    name: "TestSorc2",
    level: 70,
    life: 800,
    mana: 700,
    experience: 285041630,
    class: { id: 1, name: "Sorceress" },
    skills: [
      { id: 1, name: "Fire Ball", level: 18 },
      { id: 3, name: "Frozen Orb", level: 20 },
    ],
  },
  items: [],
  realSkills: [],
  lastUpdated: 1678886500000,
};

describe("CharacterDB_Postgres - Season Tracking", () => {
  let db: CharacterDB_Postgres;
  const gameModeSC = "softcore";
  const gameModeHC = "hardcore";
  const season11 = 11;
  const season12 = 12;

  beforeEach(async () => {
    db = new CharacterDB_Postgres();
    await db.ready;
    await db.clearGameModeData(gameModeSC, season11);
    await db.clearGameModeData(gameModeSC, season12);
    await db.clearGameModeData(gameModeHC, season11);
    await db.clearGameModeData(gameModeHC, season12);
  });

  afterEach(async () => {
    await db.close();
  });

  describe("Schema Initialization", () => {
    it("should create database connection", () => {
      expect(db).toBeInstanceOf(CharacterDB_Postgres);
    });

    it("should initialize schema correctly", async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11);
      const char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );
      expect(char).not.toBeNull();
    });
  });

  describe("Season Isolation", () => {
    it("should store characters in different seasons separately", async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11);
      await db.ingestCharacter(sampleChar2_Pala, gameModeSC, season12);

      const s11Chars = await db.getFilteredCharacters(gameModeSC, {
        season: season11,
      });
      const s12Chars = await db.getFilteredCharacters(gameModeSC, {
        season: season12,
      });

      expect(s11Chars.total).toBe(1);
      expect(s12Chars.total).toBe(1);
      expect(s11Chars.characters[0]?.character?.name).toBe(
        sampleChar1_Sorc.character.name
      );
      expect(s12Chars.characters[0]?.character?.name).toBe(
        sampleChar2_Pala.character.name
      );
    });

    it("should allow same character name in different seasons", async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11);

      const sameCharDifferentSeason = {
        ...sampleChar1_Sorc,
        character: { ...sampleChar1_Sorc.character, level: 95 },
      };
      await db.ingestCharacter(sameCharDifferentSeason, gameModeSC, season12);

      const s11Char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );
      const s12Char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season12
      );

      expect(s11Char?.character!.level).toBe(80);
      expect(s12Char?.character!.level).toBe(95);
    });

    it("should clear only specified season data", async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11);
      await db.ingestCharacter(sampleChar2_Pala, gameModeSC, season12);

      await db.clearGameModeData(gameModeSC, season11);

      const s11Chars = await db.getFilteredCharacters(gameModeSC, {
        season: season11,
      });
      const s12Chars = await db.getFilteredCharacters(gameModeSC, {
        season: season12,
      });

      expect(s11Chars.total).toBe(0);
      expect(s12Chars.total).toBe(1);
    });
  });

  describe("Character Ingestion", () => {
    it("should ingest character with all data", async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11);
      const char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );

      expect(char).not.toBeNull();
      expect(char?.character!.name).toBe(sampleChar1_Sorc.character.name);
      expect(char?.character!.level).toBe(sampleChar1_Sorc.character.level);
      expect(char?.character!.class.name).toBe(
        sampleChar1_Sorc.character.class.name
      );
      expect(char?.items?.length).toBe(sampleChar1_Sorc.items.length);
      expect(char?.character!.skills.length).toBe(
        sampleChar1_Sorc.character.skills.length
      );
    });

    it("should update existing character in same season", async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11);

      const updated = {
        ...sampleChar1_Sorc,
        character: { ...sampleChar1_Sorc.character, level: 85 },
      };
      await db.ingestCharacter(updated, gameModeSC, season11);

      const char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );
      expect(char?.character!.level).toBe(85);

      const { total } = await db.getFilteredCharacters(gameModeSC, {
        season: season11,
      });
      expect(total).toBe(1);
    });

    it("should handle special characters in names", async () => {
      const specialChar = {
        ...sampleChar1_Sorc,
        character: {
          ...sampleChar1_Sorc.character,
          name: "Test'Name-With_Special#Chars",
        },
      };
      await db.ingestCharacter(specialChar, gameModeSC, season11);
      const char = await db.getCharacterByName(
        gameModeSC,
        specialChar.character.name,
        season11
      );
      expect(char?.character!.name).toBe(specialChar.character.name);
    });

    it("should not ingest if character or name is missing", async () => {
      const invalidChar = { ...sampleChar1_Sorc, character: null };
      await db.ingestCharacter(
        invalidChar as unknown as FullCharacterResponse,
        gameModeSC,
        season11
      );

      const { total } = await db.getFilteredCharacters(gameModeSC, {
        season: season11,
      });
      expect(total).toBe(0);
    });

    it("should handle concurrent ingestion", async () => {
      await Promise.all([
        db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11),
        db.ingestCharacter(sampleChar2_Pala, gameModeSC, season11),
        db.ingestCharacter(sampleChar3_Sorc, gameModeSC, season11),
      ]);

      const { total } = await db.getFilteredCharacters(gameModeSC, {
        season: season11,
      });
      expect(total).toBe(3);
    });
  });

  describe("Character Retrieval", () => {
    beforeEach(async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11);
    });

    it("should retrieve character by name (case insensitive)", async () => {
      const charLower = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name.toLowerCase(),
        season11
      );
      expect(charLower).not.toBeNull();

      const charUpper = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name.toUpperCase(),
        season11
      );
      expect(charUpper).not.toBeNull();
    });

    it("should return null for non-existent character", async () => {
      const char = await db.getCharacterByName(
        gameModeSC,
        "NonExistentChar",
        season11
      );
      expect(char).toBeNull();
    });

    it("should return null for character in different season", async () => {
      const char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season12
      );
      expect(char).toBeNull();
    });

    it("should return latest season when no season specified", async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season12);
      const char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name
      );
      expect(char).not.toBeNull();
    });
  });

  describe("Character Filtering", () => {
    beforeEach(async () => {
      await Promise.all([
        db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11),
        db.ingestCharacter(sampleChar2_Pala, gameModeSC, season11),
        db.ingestCharacter(sampleChar3_Sorc, gameModeSC, season11),
      ]);
    });

    it("should filter by class", async () => {
      const filter: CharacterFilter = {
        requiredClasses: ["Sorceress"],
        season: season11,
      };
      const { total, characters } = await db.getFilteredCharacters(
        gameModeSC,
        filter
      );
      expect(total).toBe(2);
      characters.forEach((char) => {
        expect(char.character!.class.name).toBe("Sorceress");
      });
    });

    it("should filter by required item", async () => {
      const filter: CharacterFilter = {
        requiredItems: ["Shako"],
        season: season11,
      };
      const { total } = await db.getFilteredCharacters(gameModeSC, filter);
      expect(total).toBe(2);
    });

    it("should filter by multiple required items (AND logic)", async () => {
      const filter: CharacterFilter = {
        requiredItems: ["Shako", "Spirit Monarch"],
        season: season11,
      };
      const { total, characters } = await db.getFilteredCharacters(
        gameModeSC,
        filter
      );
      expect(total).toBe(1);
      expect(characters[0].character!.name).toBe(
        sampleChar1_Sorc.character.name
      );
    });

    it("should filter by required skill and level", async () => {
      const filter: CharacterFilter = {
        requiredSkills: [{ name: "Fire Ball", minLevel: 20 }],
        season: season11,
      };
      const { total, characters } = await db.getFilteredCharacters(
        gameModeSC,
        filter
      );
      expect(total).toBe(1);
      expect(characters[0].character!.name).toBe(
        sampleChar1_Sorc.character.name
      );
    });

    it("should filter by level range", async () => {
      const filter: CharacterFilter = {
        levelRange: { min: 85, max: 95 },
        season: season11,
      };
      const { total, characters } = await db.getFilteredCharacters(
        gameModeSC,
        filter
      );
      expect(total).toBe(1);
      expect(characters[0].character!.name).toBe(
        sampleChar2_Pala.character.name
      );
    });

    it("should combine multiple filters", async () => {
      const filter: CharacterFilter = {
        requiredClasses: ["Sorceress"],
        requiredItems: ["Shako"],
        requiredSkills: [{ name: "Fire Ball", minLevel: 20 }],
        season: season11,
      };
      const { total, characters } = await db.getFilteredCharacters(
        gameModeSC,
        filter
      );
      expect(total).toBe(1);
      expect(characters[0].character!.name).toBe(
        sampleChar1_Sorc.character.name
      );
    });

    it("should return empty for no matches", async () => {
      const filter: CharacterFilter = {
        requiredClasses: ["Amazon"],
        season: season11,
      };
      const { total, characters, breakdown } = await db.getFilteredCharacters(
        gameModeSC,
        filter
      );
      expect(total).toBe(0);
      expect(characters.length).toBe(0);
      expect(breakdown.total).toBe(0);
    });

    it("should support pagination", async () => {
      const page1 = await db.getFilteredCharacters(
        gameModeSC,
        { season: season11 },
        1,
        2
      );
      expect(page1.characters.length).toBe(2);
      expect(page1.total).toBe(3);

      const page2 = await db.getFilteredCharacters(
        gameModeSC,
        { season: season11 },
        2,
        2
      );
      expect(page2.characters.length).toBe(1);
      expect(page2.total).toBe(3);
    });

    it("should return breakdown by class", async () => {
      const { breakdown } = await db.getFilteredCharacters(gameModeSC, {
        season: season11,
      });
      expect(breakdown.Sorceress).toBe(2);
      expect(breakdown.Paladin).toBe(1);
      expect(breakdown.total).toBe(3);
    });
  });

  describe("Level Distribution", () => {
    it("should return level distribution for specific season", async () => {
      const chars = Array.from({ length: 5 }, (_, i) => ({
        ...sampleChar1_Sorc,
        character: {
          ...sampleChar1_Sorc.character,
          name: `Char${i}`,
          level: 80 + i,
        },
      }));

      await Promise.all(
        chars.map((char) => db.ingestCharacter(char, gameModeSC, season11))
      );

      const dist = await db.getLevelDistributions(season11);
      expect(dist.softcore).toBeDefined();
      expect(dist.hardcore).toBeDefined();
    });

    it("should return empty distribution for season with no data", async () => {
      const dist = await db.getLevelDistributions(season12);
      expect(dist.softcore.every((d) => d.count === 0)).toBe(true);
      expect(dist.hardcore.every((d) => d.count === 0)).toBe(true);
    });
  });

  describe("Item Usage Analytics", () => {
    beforeEach(async () => {
      await Promise.all([
        db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11),
        db.ingestCharacter(sampleChar2_Pala, gameModeSC, season11),
      ]);
    });

    it("should analyze item usage for specific season", async () => {
      const usage = await db.analyzeItemUsage(gameModeSC, {
        season: season11,
      });
      const shako = usage.find((item) => item.item === "Shako");
      expect(shako).toBeDefined();
      expect(shako!.numOccurrences).toBe(2);
      expect(shako!.totalSample).toBe(2);
      expect(shako!.pct).toBe(100);
    });

    it("should filter item usage by class", async () => {
      const usage = await db.analyzeItemUsage(gameModeSC, {
        requiredClasses: ["Sorceress"],
        season: season11,
      });
      const shako = usage.find((item) => item.item === "Shako");
      expect(shako!.numOccurrences).toBe(1);
      expect(shako!.totalSample).toBe(1);
    });

    it("should return empty for season with no data", async () => {
      const usage = await db.analyzeItemUsage(gameModeSC, {
        season: season12,
      });
      expect(usage.length).toBe(0);
    });
  });

  describe("Skill Usage Analytics", () => {
    beforeEach(async () => {
      await Promise.all([
        db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11),
        db.ingestCharacter(sampleChar2_Pala, gameModeSC, season11),
      ]);
    });

    it("should analyze skill usage for specific season", async () => {
      const usage = await db.analyzeSkillUsage(gameModeSC, {
        season: season11,
      });
      const fireball = usage.find((skill) => skill.name === "Fire Ball");
      expect(fireball).toBeDefined();
    });

    it("should only count skills at level 20+", async () => {
      const usage = await db.analyzeSkillUsage(gameModeSC, {
        season: season11,
      });
      const teleport = usage.find((skill) => skill.name === "Teleport");
      expect(teleport).toBeUndefined(); // Teleport is level 15
    });

    it("should return empty for season with no data", async () => {
      const usage = await db.analyzeSkillUsage(gameModeSC, {
        season: season12,
      });
      expect(usage.length).toBe(0);
    });
  });

  describe("Online Players History", () => {
    it("should log and retrieve online player counts", async () => {
      await db.logOnlinePlayers(100);
      await db.logOnlinePlayers(150);

      const history = await db.getOnlinePlayersHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[history.length - 2].num_online_players).toBe(100);
      expect(history[history.length - 1].num_online_players).toBe(150);
    });
  });

  describe("Game Mode Isolation", () => {
    it("should isolate softcore and hardcore data", async () => {
      await db.ingestCharacter(sampleChar1_Sorc, gameModeSC, season11);
      await db.ingestCharacter(sampleChar2_Pala, gameModeHC, season11);

      const scChars = await db.getFilteredCharacters(gameModeSC, {
        season: season11,
      });
      const hcChars = await db.getFilteredCharacters(gameModeHC, {
        season: season11,
      });

      expect(scChars.total).toBe(1);
      expect(hcChars.total).toBe(1);
    });
  });

  describe("Mercenary Functionality", () => {
    describe("Mercenary Ingestion", () => {
      it("should ingest character with mercenary type and items", async () => {
        const charWithMerc = {
          character: {
            name: "TestMerc1",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 1, name: "Sorceress" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Colossus Voulge",
                quality: { name: "Runeword" },
                runeword: true,
              },
              {
                name: "Sacred Armor",
                quality: { name: "Unique" },
                runeword: false,
              },
            ],
          },
        };

        await db.ingestCharacter(charWithMerc, gameModeSC, season11);
        const char = await db.getCharacterByName(
          gameModeSC,
          "TestMerc1",
          season11
        );

        expect(char).not.toBeNull();
        expect(char?.mercenary?.description).toBe("Offensive Auras");
        expect(char?.mercenary?.items?.length).toBe(2);
      });

      it("should ingest character without mercenary", async () => {
        const charNoMerc = {
          character: {
            name: "TestNoMerc",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 4, name: "Paladin" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
        };

        await db.ingestCharacter(charNoMerc, gameModeSC, season11);
        const char = await db.getCharacterByName(
          gameModeSC,
          "TestNoMerc",
          season11
        );

        expect(char).not.toBeNull();
        expect(char?.mercenary).toBeUndefined();
      });

      it("should ingest character with mercenary type but no items", async () => {
        const charMercNoItems = {
          character: {
            name: "TestMercNoItems",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 0, name: "Amazon" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Cold Spells",
            items: [],
          },
        };

        await db.ingestCharacter(charMercNoItems, gameModeSC, season11);
        const char = await db.getCharacterByName(
          gameModeSC,
          "TestMercNoItems",
          season11
        );

        expect(char?.mercenary?.description).toBe("Cold Spells");
        expect(char?.mercenary?.items?.length).toBe(0);
      });

      it("should handle invalid mercenary item data gracefully", async () => {
        const charInvalidMercItems = {
          character: {
            name: "TestInvalidMerc",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 2, name: "Necromancer" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Fire Spells",
            items: [
              {
                name: "Voulge",
                quality: { name: "Unique" },
              },
              {
                // Missing name - should be skipped
                quality: { name: "Runeword" },
              },
              {
                name: "Great Hauberk",
                // Missing quality - should be skipped
              },
            ],
          },
        };

        await db.ingestCharacter(charInvalidMercItems, gameModeSC, season11);
        const char = await db.getCharacterByName(
          gameModeSC,
          "TestInvalidMerc",
          season11
        );

        // JSONB stores all items including invalid ones
        // But only 1 valid item should be in MercenaryItems table
        expect(char?.mercenary?.items?.length).toBe(3);
      });
    });

    describe("Mercenary Type Filtering (OR Logic)", () => {
      beforeEach(async () => {
        const char1 = {
          character: {
            name: "TestOffAuras1",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 4, name: "Paladin" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: { description: "Offensive Auras", items: [] },
        };

        const char2 = {
          character: {
            name: "TestColdSpells1",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 1, name: "Sorceress" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: { description: "Cold Spells", items: [] },
        };

        const char3 = {
          character: {
            name: "TestOffAuras2",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 3, name: "Barbarian" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: { description: "Offensive Auras", items: [] },
        };

        await Promise.all([
          db.ingestCharacter(char1, gameModeSC, season11),
          db.ingestCharacter(char2, gameModeSC, season11),
          db.ingestCharacter(char3, gameModeSC, season11),
        ]);
      });

      it("should filter by single mercenary type", async () => {
        const filter: CharacterFilter = {
          requiredMercTypes: ["Offensive Auras"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        const names = results.characters.map((c) => c.character!.name).sort();

        expect(names).toContain("TestOffAuras1");
        expect(names).toContain("TestOffAuras2");
        expect(names).not.toContain("TestColdSpells1");
      });

      it("should filter by multiple mercenary types (OR logic)", async () => {
        const filter: CharacterFilter = {
          requiredMercTypes: ["Offensive Auras", "Cold Spells"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        const names = results.characters.map((c) => c.character!.name).sort();

        expect(names).toContain("TestOffAuras1");
        expect(names).toContain("TestOffAuras2");
        expect(names).toContain("TestColdSpells1");
        expect(results.total).toBe(3);
      });

      it("should return no results for non-existent mercenary type", async () => {
        const filter: CharacterFilter = {
          requiredMercTypes: ["NonexistentMercType"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        expect(results.characters.length).toBe(0);
      });
    });

    describe("Mercenary Item Filtering (AND Logic)", () => {
      beforeEach(async () => {
        const char1 = {
          character: {
            name: "TestInfinity",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 1, name: "Sorceress" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Colossus Voulge",
                quality: { name: "Runeword" },
                runeword: true,
              },
            ],
          },
        };

        const char2 = {
          character: {
            name: "TestInfinityFort",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 4, name: "Paladin" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Colossus Voulge",
                quality: { name: "Runeword" },
                runeword: true,
              },
              {
                name: "Sacred Armor",
                quality: { name: "Runeword" },
                runeword: true,
              },
            ],
          },
        };

        const char3 = {
          character: {
            name: "TestFortOnly",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 3, name: "Barbarian" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Sacred Armor",
                quality: { name: "Runeword" },
                runeword: true,
              },
            ],
          },
        };

        await Promise.all([
          db.ingestCharacter(char1, gameModeSC, season11),
          db.ingestCharacter(char2, gameModeSC, season11),
          db.ingestCharacter(char3, gameModeSC, season11),
        ]);
      });

      it("should filter by single mercenary item", async () => {
        const filter: CharacterFilter = {
          requiredMercItems: ["Colossus Voulge"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        const names = results.characters.map((c) => c.character!.name).sort();

        expect(names).toContain("TestInfinity");
        expect(names).toContain("TestInfinityFort");
        expect(names).not.toContain("TestFortOnly");
      });

      it("should filter by multiple mercenary items with AND logic", async () => {
        const filter: CharacterFilter = {
          requiredMercItems: ["Colossus Voulge", "Sacred Armor"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        const names = results.characters.map((c) => c.character!.name);

        expect(names.length).toBe(1);
        expect(names).toContain("TestInfinityFort");
        expect(names).not.toContain("TestInfinity"); // Missing Sacred Armor
        expect(names).not.toContain("TestFortOnly"); // Missing Colossus Voulge
      });

      it("should return no results when character missing required item", async () => {
        const filter: CharacterFilter = {
          requiredMercItems: ["Colossus Voulge", "Giant Thresher"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        expect(results.characters.length).toBe(0);
      });
    });

    describe("Combined Character and Mercenary Filters", () => {
      beforeEach(async () => {
        const char1 = {
          character: {
            name: "TestSorcOff",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 1, name: "Sorceress" },
            skills: [{ id: 40, name: "Blizzard", level: 40 }],
          },
          items: [{ name: "Harlequin Crest", quality: { name: "Unique" } }],
          realSkills: [{ skill: "Blizzard", level: 40 }],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Colossus Voulge",
                quality: { name: "Runeword" },
                runeword: true,
              },
            ],
          },
        };

        const char2 = {
          character: {
            name: "TestPalOff",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 4, name: "Paladin" },
            skills: [{ id: 117, name: "Holy Shield", level: 20 }],
          },
          items: [{ name: "Harlequin Crest", quality: { name: "Unique" } }],
          realSkills: [{ skill: "Holy Shield", level: 20 }],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Colossus Voulge",
                quality: { name: "Runeword" },
                runeword: true,
              },
            ],
          },
        };

        await Promise.all([
          db.ingestCharacter(char1, gameModeSC, season11),
          db.ingestCharacter(char2, gameModeSC, season11),
        ]);
      });

      it("should filter by class + mercenary type", async () => {
        const filter: CharacterFilter = {
          requiredClasses: ["Sorceress"],
          requiredMercTypes: ["Offensive Auras"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        const names = results.characters.map((c) => c.character!.name);

        expect(names.length).toBe(1);
        expect(names).toContain("TestSorcOff");
        expect(names).not.toContain("TestPalOff");
      });

      it("should filter by character item + mercenary item", async () => {
        const filter: CharacterFilter = {
          requiredItems: ["Harlequin Crest"],
          requiredMercItems: ["Colossus Voulge"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        const names = results.characters.map((c) => c.character!.name).sort();

        expect(names).toContain("TestSorcOff");
        expect(names).toContain("TestPalOff");
      });

      it("should filter by class + character item + merc type + merc item", async () => {
        const filter: CharacterFilter = {
          requiredClasses: ["Sorceress"],
          requiredItems: ["Harlequin Crest"],
          requiredSkills: [{ name: "Blizzard", minLevel: 30 }],
          requiredMercTypes: ["Offensive Auras"],
          requiredMercItems: ["Colossus Voulge"],
          season: season11,
        };

        const results = await db.getFilteredCharacters(gameModeSC, filter);
        const names = results.characters.map((c) => c.character!.name);

        expect(names.length).toBe(1);
        expect(names).toContain("TestSorcOff");
      });
    });

    describe("Mercenary Stats Analysis", () => {
      beforeEach(async () => {
        const char1 = {
          character: {
            name: "TestStatsMerc1",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 1, name: "Sorceress" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Colossus Voulge",
                quality: { name: "Runeword" },
                runeword: true,
              },
              { name: "Vampire Gaze", quality: { name: "Unique" } },
            ],
          },
        };

        const char2 = {
          character: {
            name: "TestStatsMerc2",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 4, name: "Paladin" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Colossus Voulge",
                quality: { name: "Runeword" },
                runeword: true,
              },
            ],
          },
        };

        const char3 = {
          character: {
            name: "TestStatsMerc3",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 3, name: "Barbarian" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Cold Spells",
            items: [{ name: "Vampire Gaze", quality: { name: "Unique" } }],
          },
        };

        await Promise.all([
          db.ingestCharacter(char1, gameModeSC, season11),
          db.ingestCharacter(char2, gameModeSC, season11),
          db.ingestCharacter(char3, gameModeSC, season11),
        ]);
      });

      it("should analyze mercenary type usage", async () => {
        const stats = await db.analyzeMercTypeUsage(gameModeSC, {
          season: season11,
        });

        const offensiveAuras = stats.find(
          (s) => s.mercType === "Offensive Auras"
        );
        const coldSpells = stats.find((s) => s.mercType === "Cold Spells");

        expect(offensiveAuras).toBeDefined();
        expect(offensiveAuras?.numOccurrences).toBe(2);
        expect(offensiveAuras?.pct).toBeCloseTo(66.67, 1);

        expect(coldSpells).toBeDefined();
        expect(coldSpells?.numOccurrences).toBe(1);
        expect(coldSpells?.pct).toBeCloseTo(33.33, 1);
      });

      it("should analyze mercenary item usage", async () => {
        const stats = await db.analyzeMercItemUsage(gameModeSC, {
          season: season11,
        });

        const voulge = stats.find((s) => s.item === "Colossus Voulge");
        const vampGaze = stats.find((s) => s.item === "Vampire Gaze");

        expect(voulge).toBeDefined();
        expect(voulge?.numOccurrences).toBe(2);
        expect(voulge?.pct).toBeCloseTo(66.67, 1);
        expect(voulge?.itemType).toBe("Runeword");

        expect(vampGaze).toBeDefined();
        expect(vampGaze?.numOccurrences).toBe(2);
        expect(vampGaze?.pct).toBeCloseTo(66.67, 1);
        expect(vampGaze?.itemType).toBe("Unique");
      });

      it("should analyze merc type usage with class filter", async () => {
        const filter: CharacterFilter = {
          requiredClasses: ["Sorceress"],
          season: season11,
        };

        const stats = await db.analyzeMercTypeUsage(gameModeSC, filter);

        expect(stats.length).toBe(1);
        expect(stats[0].mercType).toBe("Offensive Auras");
        expect(stats[0].numOccurrences).toBe(1);
        expect(stats[0].pct).toBe(100);
      });

      it("should analyze merc item usage with merc type filter", async () => {
        const filter: CharacterFilter = {
          requiredMercTypes: ["Offensive Auras"],
          season: season11,
        };

        const stats = await db.analyzeMercItemUsage(gameModeSC, filter);

        const voulge = stats.find((s) => s.item === "Colossus Voulge");
        const vampGaze = stats.find((s) => s.item === "Vampire Gaze");

        expect(voulge?.numOccurrences).toBe(2);
        expect(voulge?.pct).toBe(100);

        expect(vampGaze?.numOccurrences).toBe(1);
        expect(vampGaze?.pct).toBe(50);
      });
    });

    describe("Mercenary Update and CASCADE", () => {
      it("should replace mercenary data when re-ingesting character", async () => {
        const charData1 = {
          character: {
            name: "TestUpdateMerc",
            level: 95,
            life: 1500,
            mana: 1000,
            class: { id: 1, name: "Sorceress" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Offensive Auras",
            items: [
              {
                name: "Colossus Voulge",
                quality: { name: "Runeword" },
                runeword: true,
              },
            ],
          },
        };

        await db.ingestCharacter(charData1, gameModeSC, season11);

        let char = await db.getCharacterByName(
          gameModeSC,
          "TestUpdateMerc",
          season11
        );
        expect(char?.mercenary?.description).toBe("Offensive Auras");
        expect(char?.mercenary?.items?.length).toBe(1);

        // Re-ingest with different mercenary
        const charData2 = {
          character: {
            name: "TestUpdateMerc",
            level: 96,
            life: 1500,
            mana: 1000,
            class: { id: 1, name: "Sorceress" },
            skills: [],
          },
          items: [],
          realSkills: [],
          lastUpdated: Date.now(),
          mercenary: {
            description: "Cold Spells",
            items: [
              {
                name: "Giant Thresher",
                quality: { name: "Runeword" },
                runeword: true,
              },
              { name: "Vampire Gaze", quality: { name: "Unique" } },
            ],
          },
        };

        await db.ingestCharacter(charData2, gameModeSC, season11);

        char = await db.getCharacterByName(
          gameModeSC,
          "TestUpdateMerc",
          season11
        );
        expect(char?.mercenary?.description).toBe("Cold Spells");
        expect(char?.mercenary?.items?.length).toBe(2);
      });
    });
  });

  describe("Account Name Feature", () => {
    it("should ingest character with account name", async () => {
      const freshChar = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(freshChar, gameModeSC, season11, "TestAccount");
      const char = await db.getCharacterByName(
        gameModeSC,
        freshChar.character.name,
        season11
      );

      expect(char).not.toBeNull();
      expect(char?.accountName).toBe("TestAccount");
    });

    it("should handle null account name (legacy characters)", async () => {
      const freshChar = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(freshChar, gameModeSC, season11); // No account name
      const char = await db.getCharacterByName(
        gameModeSC,
        freshChar.character.name,
        season11
      );

      expect(char).not.toBeNull();
      expect(char?.accountName).toBeUndefined();
    });

    it("should update account name when re-ingesting character", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "OldAccount"
      );
      let char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );
      expect(char?.accountName).toBe("OldAccount");

      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "NewAccount"
      );
      char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );
      expect(char?.accountName).toBe("NewAccount");
    });

    it("should return characters by account name", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "MyAccount"
      );
      await db.ingestCharacter(
        sampleChar2_Pala,
        gameModeSC,
        season11,
        "MyAccount"
      );
      await db.ingestCharacter(
        sampleChar3_Sorc,
        gameModeSC,
        season11,
        "OtherAccount"
      );

      const chars = await db.getCharactersByAccount("MyAccount", season11);
      expect(chars.length).toBe(2);
      chars.forEach((char) => {
        expect(char.accountName).toBe("MyAccount");
      });
    });

    it("should return empty array for non-existent account", async () => {
      const chars = await db.getCharactersByAccount(
        "NonExistentAccount",
        season11
      );
      expect(chars.length).toBe(0);
    });

    it("should return characters sorted by level DESC", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "TestAccount"
      ); // Level 80
      await db.ingestCharacter(
        sampleChar2_Pala,
        gameModeSC,
        season11,
        "TestAccount"
      ); // Level 90
      await db.ingestCharacter(
        sampleChar3_Sorc,
        gameModeSC,
        season11,
        "TestAccount"
      ); // Level 70

      const chars = await db.getCharactersByAccount("TestAccount", season11);
      expect(chars.length).toBe(3);
      expect(chars[0].character!.name).toBe(sampleChar2_Pala.character.name); // Level 90
      expect(chars[1].character!.name).toBe(sampleChar1_Sorc.character.name); // Level 80
      expect(chars[2].character!.name).toBe(sampleChar3_Sorc.character.name); // Level 70
    });

    it("should filter characters by account and season", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "TestAccount"
      );
      await db.ingestCharacter(
        sampleChar2_Pala,
        gameModeSC,
        season12,
        "TestAccount"
      );

      const s11Chars = await db.getCharactersByAccount("TestAccount", season11);
      const s12Chars = await db.getCharactersByAccount("TestAccount", season12);

      expect(s11Chars.length).toBe(1);
      expect(s12Chars.length).toBe(1);
      expect(s11Chars[0].character!.name).toBe(sampleChar1_Sorc.character.name);
      expect(s12Chars[0].character!.name).toBe(sampleChar2_Pala.character.name);
    });

    it("should return all seasons when no season specified", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "TestAccount"
      );
      await db.ingestCharacter(
        sampleChar2_Pala,
        gameModeSC,
        season12,
        "TestAccount"
      );

      const allChars = await db.getCharactersByAccount("TestAccount");
      expect(allChars.length).toBe(2);
    });

    it("should handle account names with special characters", async () => {
      const specialAccountName = "Test_Account-123";
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        specialAccountName
      );

      const chars = await db.getCharactersByAccount(
        specialAccountName,
        season11
      );
      expect(chars.length).toBe(1);
      expect(chars[0].accountName).toBe(specialAccountName);
    });

    it("should isolate accounts across game modes", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "TestAccount"
      );
      await db.ingestCharacter(
        sampleChar2_Pala,
        gameModeHC,
        season11,
        "TestAccount"
      );

      const allChars = await db.getCharactersByAccount("TestAccount", season11);
      // Should return both SC and HC characters with same account name
      expect(allChars.length).toBe(2);
    });
  });

  describe("Season in Character Response", () => {
    it("should return season in character response from getCharacterByName", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "TestAccount"
      );
      const char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );

      expect(char).not.toBeNull();
      expect(char?.character?.season).toBe(season11);
    });

    it("should return season in character response from getCharactersByAccount", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "TestAccount"
      );
      const chars = await db.getCharactersByAccount("TestAccount", season11);

      expect(chars.length).toBe(1);
      expect(chars[0].character?.season).toBe(season11);
    });

    it("should return correct season for different characters", async () => {
      await db.ingestCharacter(
        sampleChar1_Sorc,
        gameModeSC,
        season11,
        "TestAccount"
      );
      await db.ingestCharacter(
        sampleChar2_Pala,
        gameModeSC,
        season12,
        "TestAccount"
      );

      const s11Char = await db.getCharacterByName(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );
      const s12Char = await db.getCharacterByName(
        gameModeSC,
        sampleChar2_Pala.character.name,
        season12
      );

      expect(s11Char?.character?.season).toBe(season11);
      expect(s12Char?.character?.season).toBe(season12);
    });
  });

  describe("Character Snapshots", () => {
    it("should create snapshot when character is re-ingested", async () => {
      const char1 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(char1, gameModeSC, season11);

      // Re-ingest with changes
      const char2 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2.character.experience = 700000000;
      await db.ingestCharacter(char2, gameModeSC, season11);

      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        char1.character.name,
        season11
      );

      // Should have 1 snapshot (the old state before second ingestion)
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].level).toBe(char1.character.level);
      expect(snapshots[0].experience).toBe(char1.character.experience);
    });

    it("should create snapshot when character level changes", async () => {
      const char1 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(char1, gameModeSC, season11);

      // Change level and experience
      const char2 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2.character.level = 86;
      char2.character.experience = 1145236814;
      await db.ingestCharacter(char2, gameModeSC, season11);

      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        char1.character.name,
        season11
      );

      // First ingestion = 0 snapshots, Second ingestion = 1 snapshot (old state)
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].level).toBe(80); // Snapshot of old state (level 80)
    });

    it("should create snapshot when character experience changes", async () => {
      const char1 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(char1, gameModeSC, season11);

      const char2 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2.character.experience = 700000000;
      await db.ingestCharacter(char2, gameModeSC, season11);

      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        char1.character.name,
        season11
      );

      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].experience).toBe(681027665); // Old state
    });

    it("should create multiple snapshots over time", async () => {
      const char1 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char1.lastUpdated = 1000000000;
      await db.ingestCharacter(char1, gameModeSC, season11);

      const char2 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2.character.experience = 700000000;
      char2.lastUpdated = 2000000000;
      await db.ingestCharacter(char2, gameModeSC, season11);

      const char3 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char3.character.experience = 800000000;
      char3.lastUpdated = 3000000000;
      await db.ingestCharacter(char3, gameModeSC, season11);

      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        char1.character.name,
        season11
      );

      // 3 ingestions = 2 snapshots (first has no snapshot)
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].experience).toBe(700000000); // Most recent snapshot
      expect(snapshots[1].experience).toBe(681027665); // Oldest snapshot
    });

    it("should not create snapshot when experience unchanged (within 24h)", async () => {
      const char1 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char1.lastUpdated = Date.now();
      await db.ingestCharacter(char1, gameModeSC, season11);

      // Re-ingest same character (no changes to experience)
      const char2 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2.lastUpdated = Date.now();
      await db.ingestCharacter(char2, gameModeSC, season11);

      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        char1.character.name,
        season11
      );

      expect(snapshots).toHaveLength(0); // No snapshot created (no change)
    });

    it("should retrieve specific snapshot by ID", async () => {
      const char1 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(char1, gameModeSC, season11);

      // Create a snapshot by re-ingesting with changes
      const char2 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2.character.experience = 700000000;
      await db.ingestCharacter(char2, gameModeSC, season11);

      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        char1.character.name,
        season11
      );
      const snapshotId = snapshots[0].snapshot_id;

      const snapshot = await db.getCharacterSnapshot(snapshotId);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.character.name).toBe(char1.character.name);
      expect(snapshot?.character.level).toBe(char1.character.level);
      expect(snapshot?.character.experience).toBe(char1.character.experience);
    });

    it("should return snapshots in descending timestamp order", async () => {
      const char1 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char1.lastUpdated = 1000000000;
      await db.ingestCharacter(char1, gameModeSC, season11);

      const char2 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2.character.experience = 700000000;
      char2.lastUpdated = 2000000000;
      await db.ingestCharacter(char2, gameModeSC, season11);

      const char3 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char3.character.experience = 800000000;
      char3.lastUpdated = 3000000000;
      await db.ingestCharacter(char3, gameModeSC, season11);

      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        char1.character.name,
        season11
      );

      expect(snapshots).toHaveLength(2);
      // Most recent snapshot first (DESC order)
      expect(snapshots[0].snapshot_timestamp).toBeGreaterThan(
        snapshots[1].snapshot_timestamp
      );
    });

    it("should return empty array when no snapshots exist", async () => {
      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        "NonExistentChar",
        season11
      );

      expect(snapshots).toHaveLength(0);
    });

    it("should return null for non-existent snapshot ID", async () => {
      const snapshot = await db.getCharacterSnapshot(999999);
      expect(snapshot).toBeNull();
    });

    it("should isolate snapshots by season", async () => {
      // Season 11: Create character then re-ingest to create snapshot
      const char1_s11 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(char1_s11, gameModeSC, season11);

      const char2_s11 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2_s11.character.experience = 700000000;
      await db.ingestCharacter(char2_s11, gameModeSC, season11);

      // Season 12: Create character then re-ingest to create snapshot
      const char1_s12 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(char1_s12, gameModeSC, season12);

      const char2_s12 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      char2_s12.character.experience = 800000000;
      await db.ingestCharacter(char2_s12, gameModeSC, season12);

      const s11Snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season11
      );
      const s12Snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        sampleChar1_Sorc.character.name,
        season12
      );

      expect(s11Snapshots).toHaveLength(1);
      expect(s12Snapshots).toHaveLength(1);
      // Verify season isolation - snapshot IDs should be different
      expect(s11Snapshots[0].snapshot_id).not.toBe(s12Snapshots[0].snapshot_id);
    });

    it("should delete snapshots when clearing game mode data", async () => {
      const freshChar = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      await db.ingestCharacter(freshChar, gameModeSC, season11);

      // Change character and ingest again to create multiple snapshots
      const updatedChar = JSON.parse(JSON.stringify(sampleChar1_Sorc));
      updatedChar.character.level = 85;
      updatedChar.character.experience = 1145236814;
      await db.ingestCharacter(updatedChar, gameModeSC, season11);

      // Clear character (which deletes it)
      await db.clearGameModeData(gameModeSC, season11);

      const snapshots = await db.getCharacterSnapshots(
        gameModeSC,
        freshChar.character.name,
        season11
      );

      expect(snapshots).toHaveLength(0); // All snapshots should be deleted
    });
  });

  describe("Leaderboard Database Methods", () => {
    beforeEach(async () => {
      // Clear leaderboard tables for both seasons and gamemodes
      await db.deleteLevel99LeaderboardEntries(season11, gameModeSC);
      await db.deleteLevel99LeaderboardEntries(season12, gameModeSC);
      await db.deleteLevel99LeaderboardEntries(season11, gameModeHC);
      await db.deleteLevel99LeaderboardEntries(season12, gameModeHC);
      await db.deleteMirroredLeaderboardEntries(season11, gameModeSC);
      await db.deleteMirroredLeaderboardEntries(season12, gameModeSC);
      await db.deleteMirroredLeaderboardEntries(season11, gameModeHC);
      await db.deleteMirroredLeaderboardEntries(season12, gameModeHC);
    });

    describe("Level 99 Account Leaderboard", () => {
      it("should count level 99 characters per account", async () => {
        const char1 = JSON.parse(JSON.stringify(sampleChar1_Sorc));
        char1.character.level = 99;
        char1.character.experience = 3520485254;
        char1.character.name = "Char99_1";

        const char2 = JSON.parse(JSON.stringify(sampleChar2_Pala));
        char2.character.level = 99;
        char2.character.experience = 3520485254;
        char2.character.name = "Char99_2";

        await db.ingestCharacter(char1, gameModeSC, season12, "TestAccount1");
        await db.ingestCharacter(char2, gameModeSC, season12, "TestAccount1");

        const gameModeId = await db.getGameModeId(gameModeSC);
        const accounts = await db.getLevel99AccountCounts(
          season12,
          gameModeId,
          100
        );

        expect(accounts.length).toBeGreaterThanOrEqual(1);
        const testAccount = accounts.find(
          (a) => a.account_name === "TestAccount1"
        );
        expect(testAccount).toBeDefined();
        expect(testAccount.count).toBe(2);
      });

      it("should insert and retrieve level 99 leaderboard entries", async () => {
        const entries = [
          {
            accountName: "TopAccount",
            count: 5,
            gameMode: gameModeSC,
            season: season12,
          },
        ];

        await db.insertLevel99LeaderboardEntries(entries, Date.now());
        const results = await db.getLevel99Leaderboard(gameModeSC, season12);

        expect(results.length).toBe(1);
        expect(results[0].account_name).toBe("TopAccount");
        expect(results[0].count).toBe(5);
      });

      it("should handle upsert on level 99 leaderboard", async () => {
        const entries = [
          {
            accountName: "TestAccount",
            count: 3,
            gameMode: gameModeSC,
            season: season12,
          },
        ];

        await db.insertLevel99LeaderboardEntries(entries, Date.now());

        const updatedEntries = [
          {
            accountName: "TestAccount",
            count: 7,
            gameMode: gameModeSC,
            season: season12,
          },
        ];

        await db.insertLevel99LeaderboardEntries(updatedEntries, Date.now());
        const results = await db.getLevel99Leaderboard(gameModeSC, season12);

        expect(results.length).toBe(1);
        expect(results[0].count).toBe(7);
      });

      it("should delete level 99 leaderboard entries by season/gamemode", async () => {
        const entry = {
          accountName: "TestAccount",
          count: 5,
          gameMode: gameModeSC,
          season: season12,
        };

        await db.insertLevel99LeaderboardEntries([entry], Date.now());
        await db.deleteLevel99LeaderboardEntries(season12, gameModeSC);

        const results = await db.getLevel99Leaderboard(gameModeSC, season12);
        expect(results.length).toBe(0);
      });
    });

    describe("Mirrored Item Leaderboard", () => {
      it("should insert and retrieve mirrored item leaderboard entries", async () => {
        const mockMirroredItem = {
          name: "Harlequin Crest",
          base: { name: "Shako" },
          quality: { name: "Unique" },
          is_ethereal: false,
          modifiers: [{ label: "+2 to All Skills" }, { label: "Mirrored" }],
        };

        const entries = [
          {
            itemName: "Harlequin Crest",
            itemBaseName: "Shako",
            count: 15,
            propertiesSignature: JSON.stringify(mockMirroredItem),
            exampleItemJson: mockMirroredItem,
            exampleCharacterName: "TestChar1",
            gameMode: gameModeSC,
            season: season12,
          },
        ];

        await db.insertMirroredLeaderboardEntries(entries, Date.now());
        const results = await db.getMirroredLeaderboard(gameModeSC, season12);

        expect(results.length).toBe(1);
        expect(results[0].item_name).toBe("Harlequin Crest");
        expect(results[0].count).toBe(15);
        expect(results[0].example_item_json).toBeDefined();
      });

      it("should handle upsert on mirrored leaderboard", async () => {
        const mockItem = {
          name: "Griffon's Eye",
          properties: ["Mirrored"],
        };

        const entries = [
          {
            itemName: "Griffon's Eye",
            itemBaseName: "Diadem",
            count: 10,
            propertiesSignature: "sig123",
            exampleItemJson: mockItem,
            exampleCharacterName: "Char1",
            gameMode: gameModeSC,
            season: season12,
          },
        ];

        await db.insertMirroredLeaderboardEntries(entries, Date.now());

        const updatedEntries = [
          {
            itemName: "Griffon's Eye",
            itemBaseName: "Diadem",
            count: 25,
            propertiesSignature: "sig123",
            exampleItemJson: mockItem,
            exampleCharacterName: "Char1",
            gameMode: gameModeSC,
            season: season12,
          },
        ];

        await db.insertMirroredLeaderboardEntries(updatedEntries, Date.now());
        const results = await db.getMirroredLeaderboard(gameModeSC, season12);

        expect(results.length).toBe(1);
        expect(results[0].count).toBe(25);
      });

      it("should delete mirrored leaderboard entries by season/gamemode", async () => {
        const mockItem = { name: "Test", properties: ["Mirrored"] };
        const entry = {
          itemName: "Test Item",
          itemBaseName: "Test Base",
          count: 5,
          propertiesSignature: "test-sig",
          exampleItemJson: mockItem,
          exampleCharacterName: "TestChar",
          gameMode: gameModeSC,
          season: season12,
        };

        await db.insertMirroredLeaderboardEntries([entry], Date.now());
        await db.deleteMirroredLeaderboardEntries(season12, gameModeSC);

        const results = await db.getMirroredLeaderboard(gameModeSC, season12);
        expect(results.length).toBe(0);
      });
    });
  });
});
