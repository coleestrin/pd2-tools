//@ts-nocheck
import D2SkillParser from "./skill-calculator";
import { CharacterResponse, ICharacter, IItem, ILocation } from "../types";

// Helper to create mock character data
function createMockCharacter(
  className: string,
  skills: Array<{ name: string; level: number }>,
  items: Array<{ name: string; properties: string[]; location?: ILocation }>
): CharacterResponse {
  return {
    character: {
      name: "TestChar",
      level: 90,
      life: 1000,
      mana: 500,
      class: { name: className },
      skills: skills.map((s) => ({ name: s.name, level: s.level })),
      attributes: {
        strength: 100,
        dexterity: 75,
        vitality: 200,
        energy: 150,
      },
    } as ICharacter,
    items: items.map((item) => ({
      name: item.name,
      properties: item.properties,
      location: item.location || { equipment: "Body Armor", x: 0, y: 0 },
      quality: { name: "Unique" },
    })) as IItem[],
    mercenary: undefined,
  };
}

describe("D2SkillParser", () => {
  let parser: D2SkillParser;

  beforeEach(() => {
    parser = new D2SkillParser(false);
  });

  describe("Base Skills", () => {
    it("should return base skill levels without any items", () => {
      const char = createMockCharacter(
        "Sorceress",
        [
          { name: "Fire Ball", level: 20 },
          { name: "Meteor", level: 20 },
          { name: "Warmth", level: 1 },
        ],
        []
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Fire Ball",
            level: 20,
            baseLevel: 20,
          }),
          expect.objectContaining({
            skill: "Meteor",
            level: 20,
            baseLevel: 20,
          }),
          expect.objectContaining({
            skill: "Warmth",
            level: 1,
            baseLevel: 1,
          }),
        ])
      );
    });

    it("should filter out skills with 0 base level that gain bonuses", () => {
      const char = createMockCharacter(
        "Sorceress",
        [
          { name: "Fire Ball", level: 20 },
          { name: "Warmth", level: 0 }, // 0 base level
        ],
        [{ name: "Item", properties: ["+3 to Fire Skills"] }]
      );

      const result = parser.calculateTotalSkills(char);

      // Warmth should not appear even though it gets +3 from item
      expect(result.find((s) => s.skill === "Warmth")).toBeUndefined();
      expect(result.find((s) => s.skill === "Fire Ball")).toBeDefined();
    });
  });

  describe("Direct Skill Bonuses", () => {
    it("should apply direct skill bonus", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [{ name: "Item", properties: ["+3 to Fire Ball"] }]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Fire Ball",
            level: 23,
            baseLevel: 20,
          }),
        ])
      );
    });

    it("should apply direct skill bonus to Split Throw", () => {
      const char = createMockCharacter(
        "Barbarian",
        [{ name: "Split Throw", level: 10 }],
        [{ name: "Item", properties: ["+2 to Split Throw"] }]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Split Throw",
            level: 12,
            baseLevel: 10,
          }),
        ])
      );
    });

    it("should apply multiple direct skill bonuses", () => {
      const char = createMockCharacter(
        "Sorceress",
        [
          { name: "Fire Ball", level: 20 },
          { name: "Blessed Hammer", level: 1 },
        ],
        [
          { name: "Item1", properties: ["+3 to Blessed Hammer"] },
          { name: "Item2", properties: ["+2 to Blessed Hammer"] },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Blessed Hammer",
            level: 6,
            baseLevel: 1,
          }),
        ])
      );
    });

    it("should apply class-specific direct skill bonus", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [
          {
            name: "Item",
            properties: ["+3 to Fire Ball (Sorceress Only)"],
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 23 }),
        ])
      );
    });

    it("should not apply class-specific bonus to wrong class", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [{ name: "Item", properties: ["+3 to Zeal (Paladin Only)"] }]
      );

      const result = parser.calculateTotalSkills(char);

      // Fire Ball should remain 20
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 20 }),
        ])
      );
    });
  });

  describe("Tree Skill Bonuses", () => {
    it("should apply tree bonus to all skills in tree", () => {
      const char = createMockCharacter(
        "Sorceress",
        [
          { name: "Fire Ball", level: 20 },
          { name: "Meteor", level: 20 },
          { name: "Blizzard", level: 1 },
        ],
        [{ name: "Item", properties: ["+3 to Fire Skills"] }]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 23 }),
          expect.objectContaining({ skill: "Meteor", level: 23 }),
          expect.objectContaining({ skill: "Blizzard", level: 1 }), // Cold skill, not affected
        ])
      );
    });

    it("should apply class-specific tree bonus", () => {
      const char = createMockCharacter(
        "Sorceress",
        [
          { name: "Fire Ball", level: 20 },
          { name: "Meteor", level: 20 },
        ],
        [
          {
            name: "Item",
            properties: ["+2 to Fire Skills (Sorceress Only)"],
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 22 }),
          expect.objectContaining({ skill: "Meteor", level: 22 }),
        ])
      );
    });

    it("should not apply class-specific tree bonus to wrong class", () => {
      const char = createMockCharacter(
        "Paladin",
        [{ name: "Blessed Hammer", level: 20 }],
        [
          {
            name: "Item",
            properties: ["+3 to Fire Skills (Sorceress Only)"],
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Blessed Hammer",
            level: 20,
          }),
        ])
      );
    });
  });

  describe("All Skills Bonuses", () => {
    it("should apply +all skills to all character skills", () => {
      const char = createMockCharacter(
        "Sorceress",
        [
          { name: "Fire Ball", level: 20 },
          { name: "Blizzard", level: 20 },
          { name: "Lightning", level: 20 },
        ],
        [{ name: "Item", properties: ["+2 to All Skills"] }]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 22 }),
          expect.objectContaining({ skill: "Blizzard", level: 22 }),
          expect.objectContaining({ skill: "Lightning", level: 22 }),
        ])
      );
    });

    it("should not apply +all skills to other class skills", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [{ name: "Item", properties: ["+1 to All Skills"] }]
      );

      const result = parser.calculateTotalSkills(char);

      // Should only see Sorceress skills
      expect(result.find((s) => s.skill === "Blessed Hammer")).toBeUndefined();
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 21 }),
        ])
      );
    });

    it("should stack multiple +all skills items", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [
          { name: "Item1", properties: ["+1 to All Skills"] },
          { name: "Item2", properties: ["+2 to All Skills"] },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 23 }),
        ])
      );
    });
  });

  describe("Bonus Application Order", () => {
    it("should apply bonuses in correct order: direct -> tree -> class -> all", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [
          {
            name: "Item",
            properties: [
              "+1 to All Skills", // +1 (applied last)
              "+2 to Fire Skills", // +2 (applied second)
              "+3 to Fire Ball", // +3 (applied first)
            ],
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      // Should be 20 + 3 (direct) + 2 (tree) + 1 (all) = 26
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Fire Ball",
            level: 26,
            baseLevel: 20,
          }),
        ])
      );
    });

    it("should apply stacked bonuses correctly", () => {
      const char = createMockCharacter(
        "Paladin",
        [{ name: "Blessed Hammer", level: 20 }],
        [
          { name: "Arachnid Mesh", properties: ["+1 to All Skills"] },
          { name: "Shako", properties: ["+2 to All Skills"] },
          { name: "Torch", properties: ["+3 to Paladin Skills"] },
          { name: "Scepter", properties: ["+3 to Blessed Hammer"] },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      // 20 + 3 (direct) + 0 (tree) + 3 (class) + 1 + 2 (all) = 29
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Blessed Hammer",
            level: 29,
          }),
        ])
      );
    });
  });

  describe("Weapon Switch Handling", () => {
    it("should ignore items in left hand switch", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [
          { name: "Main Weapon", properties: ["+3 to Fire Ball"] },
          {
            name: "Switch Weapon",
            properties: ["+10 to Fire Ball"],
            location: {
              equipment: "Left Hand Switch",
              storage_id: 0,
              equipment_id: 0,
              zone_id: 0,
              zone: "",
              storage: "",
            },
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 23 }), // Only main weapon counted
        ])
      );
    });

    it("should ignore items in right hand switch", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [
          { name: "Main Weapon", properties: ["+2 to All Skills"] },
          {
            name: "Switch Weapon",
            properties: ["+10 to All Skills"],
            location: {
              equipment: "Right Hand Switch",
              storage_id: 0,
              equipment_id: 0,
              zone_id: 0,
              zone: "",
              storage: "",
            },
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 22 }), // Only +2 from main
        ])
      );
    });
  });

  describe("Result Ordering", () => {
    it("should sort results by level descending", () => {
      const char = createMockCharacter(
        "Sorceress",
        [
          { name: "Fire Ball", level: 20 },
          { name: "Meteor", level: 15 },
          { name: "Blizzard", level: 25 },
        ],
        []
      );

      const result = parser.calculateTotalSkills(char);

      expect(result[0].skill).toBe("Blizzard"); // 25
      expect(result[1].skill).toBe("Fire Ball"); // 20
      expect(result[2].skill).toBe("Meteor"); // 15
    });

    it("should include baseLevel in results", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [{ name: "Item", properties: ["+3 to Fire Ball"] }]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result[0]).toMatchObject({
        skill: "Fire Ball",
        level: 23,
        baseLevel: 20,
      });
    });
  });

  describe("Complex Scenarios", () => {
    it("should apply Druid skill bonuses from equipped items and inventory charms", () => {
      const shapeCharm = (index: number) => ({
        name: `Spiritual Grand Charm ${index}`,
        properties: ["+1 to Shape Shifting Skills (Druid Only)"],
        location: {
          storage: "Inventory",
          equipment: index % 3 === 0 ? "Right Hand" : undefined,
        } as ILocation,
      });
      const char = createMockCharacter(
        "Druid",
        [
          { name: "Rabies", level: 20 },
          { name: "Poison Creeper", level: 20 },
          { name: "Feral Rage", level: 20 },
          { name: "Lycanthropy", level: 20 },
          { name: "Werewolf", level: 8 },
          { name: "Oak Sage", level: 11 },
        ],
        [
          ...Array.from({ length: 8 }, (_, index) => shapeCharm(index)),
          {
            name: "Jalal's Mane",
            properties: [
              "+2 to Shape Shifting Skills (Druid Only)",
              "+2 to Druid Skills",
            ],
          },
          { name: "Amulet", properties: ["+2 to Druid Skills"] },
          { name: "Gloves", properties: ["+2 to Shape Shifting Skills (Druid Only)"] },
          { name: "Hellfire Torch", properties: ["+2 to Druid Skills"] },
          { name: "Arachnid Mesh", properties: ["+1 to All Skills"] },
          { name: "Annihilus", properties: ["+1 to All Skills"] },
          { name: "Wisp Projector", properties: ["+1 to All Skills"] },
          {
            name: "Call to Arms",
            properties: ["+1 to All Skills"],
            location: {
              equipment: "Left Hand Switch",
              storage_id: 0,
              equipment_id: 0,
              zone_id: 0,
              zone: "",
              storage: "",
            },
          },
          {
            name: "Lidless Wall",
            properties: ["+2 to All Skills"],
            location: {
              equipment: "Right Hand Switch",
              storage_id: 0,
              equipment_id: 0,
              zone_id: 0,
              zone: "",
              storage: "",
            },
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Rabies", level: 41, baseLevel: 20 }),
          expect.objectContaining({ skill: "Feral Rage", level: 41, baseLevel: 20 }),
          expect.objectContaining({ skill: "Lycanthropy", level: 41, baseLevel: 20 }),
          expect.objectContaining({ skill: "Werewolf", level: 29, baseLevel: 8 }),
          expect.objectContaining({
            skill: "Poison Creeper",
            level: 29,
            baseLevel: 20,
          }),
          expect.objectContaining({ skill: "Oak Sage", level: 20, baseLevel: 11 }),
        ])
      );
    });

    it("should handle Hammerdin build", () => {
      const char = createMockCharacter(
        "Paladin",
        [
          { name: "Blessed Hammer", level: 20 },
          { name: "Concentration", level: 20 },
          { name: "Vigor", level: 20 },
          { name: "Holy Shield", level: 1 },
        ],
        [
          { name: "Shako", properties: ["+2 to All Skills"] },
          { name: "Enigma", properties: ["+2 to All Skills"] },
          { name: "Arachnid Mesh", properties: ["+1 to All Skills"] },
          { name: "Torch", properties: ["+3 to Paladin Skills"] },
          {
            name: "Scepter",
            properties: ["+3 to Blessed Hammer", "+3 to Concentration"],
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      // Blessed Hammer: 20 + 3 (direct) + 3 (class) + 5 (all) = 31
      // Concentration: 20 + 3 (direct) + 3 (class) + 5 (all) = 31
      // Vigor: 20 + 3 (class) + 5 (all) = 28
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Blessed Hammer",
            level: 31,
          }),
          expect.objectContaining({
            skill: "Concentration",
            level: 31,
          }),
          expect.objectContaining({ skill: "Vigor", level: 28 }),
        ])
      );
    });

    it("should handle Blizzard Sorc build", () => {
      const char = createMockCharacter(
        "Sorceress",
        [
          { name: "Blizzard", level: 20 },
          { name: "Ice Blast", level: 20 },
          { name: "Glacial Spike", level: 20 },
          { name: "Cold Mastery", level: 20 },
        ],
        [
          { name: "Shako", properties: ["+2 to All Skills"] },
          { name: "Tal Armor", properties: ["+1 to All Skills"] },
          {
            name: "Orb",
            properties: [
              "+3 to Blizzard",
              "+3 to Cold Mastery",
              "+3 to Cold Skills (Sorceress Only)",
            ],
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      // Blizzard: 20 + 3 (direct) + 3 (tree) + 3 (all) = 29
      // Cold Mastery: 20 + 3 (direct) + 3 (tree) + 3 (all) = 29
      // Ice Blast: 20 + 3 (tree) + 3 (all) = 26
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Blizzard", level: 29 }),
          expect.objectContaining({
            skill: "Cold Mastery",
            level: 29,
          }),
          expect.objectContaining({ skill: "Ice Blast", level: 26 }),
        ])
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle character with no items", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 1 }],
        []
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual([
        expect.objectContaining({
          skill: "Fire Ball",
          level: 1,
          baseLevel: 1,
        }),
      ]);
    });

    it("should handle character with no skills", () => {
      const char = createMockCharacter(
        "Sorceress",
        [],
        [{ name: "Item", properties: ["+3 to All Skills"] }]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual([]);
    });

    it("should handle invalid skill names gracefully", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [{ name: "Item", properties: ["+3 to NonExistentSkill"] }]
      );

      const result = parser.calculateTotalSkills(char);

      // Should not crash, Fire Ball should remain 20
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 20 }),
        ])
      );
    });

    it("should handle properties with no skill bonuses", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [
          {
            name: "Item",
            properties: [
              "+100 to Life",
              "Cannot Be Frozen",
              "20% Faster Cast Rate",
            ],
          },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skill: "Fire Ball", level: 20 }),
        ])
      );
    });
  });

  describe("Error Handling", () => {
    it("should throw error for invalid character data", () => {
      const invalidChar = {
        character: null,
        items: null,
        nullReason: "Character not found",
      };

      expect(() => {
        parser.calculateTotalSkills(
          invalidChar as unknown as CharacterResponse
        );
      }).toThrow("Character not found");
    });

    it("should throw error when character is null", () => {
      const invalidChar = {
        character: null,
        items: [],
        nullReason: undefined,
      };

      expect(() => {
        parser.calculateTotalSkills(
          invalidChar as unknown as CharacterResponse
        );
      }).toThrow("Invalid character data");
    });

    it("should throw error when items is null", () => {
      const invalidChar = {
        character: {
          name: "Test",
          class: { name: "Sorceress" },
          skills: [],
        },
        items: null,
      };

      expect(() => {
        parser.calculateTotalSkills(
          invalidChar as unknown as CharacterResponse
        );
      }).toThrow("Invalid character data");
    });
  });

  describe("Oskill Capping", () => {
    it("should cap native class direct skill bonus at +3 when from item", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [{ name: "Item", properties: ["+30 to Fire Ball"] }]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Fire Ball",
            level: 23,
            baseLevel: 20,
          }),
        ])
      );
    });

    it("should not cap class-specific direct skill bonus", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [{ name: "Item", properties: ["+30 to Fire Ball (Sorceress Only)"] }]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Fire Ball",
            level: 50,
            baseLevel: 20,
          }),
        ])
      );
    });

    it("should not cap non-native skill bonuses", () => {
      const char = createMockCharacter(
        "Necromancer",
        [
          { name: "Raise Skeleton", level: 20 },
          { name: "Fire Ball", level: 1 },
        ],
        [{ name: "Item", properties: ["+30 to Fire Ball"] }]
      );

      const result = parser.calculateTotalSkills(char);

      const fireBall = result.find((s) => s.skill === "Fire Ball");
      expect(fireBall?.level).toBe(31);
    });

    it("should cap total oskill bonus at +3 per character, not per item", () => {
      const char = createMockCharacter(
        "Sorceress",
        [{ name: "Fire Ball", level: 20 }],
        [
          { name: "Item1", properties: ["+3 to Fire Ball"] },
          { name: "Item2", properties: ["+3 to Fire Ball"] },
        ]
      );

      const result = parser.calculateTotalSkills(char);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skill: "Fire Ball",
            level: 23,
            baseLevel: 20,
          }),
        ])
      );
    });
  });
});
