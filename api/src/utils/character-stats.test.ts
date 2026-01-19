//@ts-nocheck
import CharacterStatParser from "./character-stats";
import { ICharacter, IItem, CharacterData } from "../types";

type CharacterResp = CharacterData;

// Helper to create mock character with base stats
function createMockCharacter(items: IItem[]): CharacterResp {
  return {
    character: {
      name: "TestChar",
      level: 90,
      class: { name: "Sorceress", id: 1 },
      attributes: {
        strength: 100,
        dexterity: 75,
        vitality: 200,
        energy: 150,
      },
      skills: [],
    } as unknown as ICharacter,
    items,
    mercenary: undefined,
  };
}

// Helper to create mock item with properties
function createMockItem(
  name: string,
  properties: string[],
  equipment: string = "Body Armor"
): IItem {
  return {
    name,
    quality: { name: "Unique", id: 7 },
    base_item: { name: "Test Base", id: 1 },
    location: { equipment, x: 0, y: 0, width: 2, height: 3 },
    properties,
  } as unknown as IItem;
}

describe("StatParser", () => {
  describe("Base Stats Initialization", () => {
    it("should initialize with character base attributes", () => {
      const char = createMockCharacter([]);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.strength).toBe(100);
      expect(stats.dexterity).toBe(75);
      expect(stats.vitality).toBe(200);
      expect(stats.energy).toBe(150);
    });

    it("should initialize resistances with Hell penalty and Anya quest bonus", () => {
      const char = createMockCharacter([]);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      // Hell penalty -100, Anya quest +30 = -70
      expect(stats.fireRes).toBe(-70);
      expect(stats.coldRes).toBe(-70);
      expect(stats.lightningRes).toBe(-70);
      expect(stats.poisonRes).toBe(-70);
    });

    it("should initialize max resistances to 75", () => {
      const char = createMockCharacter([]);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.maxFireRes).toBe(75);
      expect(stats.maxColdRes).toBe(75);
      expect(stats.maxLightningRes).toBe(75);
      expect(stats.maxPoisonRes).toBe(75);
    });

    it("should initialize other stats to 0", () => {
      const char = createMockCharacter([]);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fasterCastRate).toBe(0);
      expect(stats.increasedAttackSpeed).toBe(0);
      expect(stats.magicFind).toBe(0);
      expect(stats.goldFind).toBe(0);
      expect(stats.fasterRunWalk).toBe(0);
      expect(stats.physicalDamageReduction).toBe(0);
      expect(stats.fasterHitRecovery).toBe(0);
    });
  });

  describe("Resistance Parsing", () => {
    it("should parse all resistances property", () => {
      const items = [createMockItem("Item1", ["All Resistances +20%"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fireRes).toBe(-50); // -70 + 20
      expect(stats.coldRes).toBe(-50);
      expect(stats.lightningRes).toBe(-50);
      expect(stats.poisonRes).toBe(-50);
    });

    it("should parse individual fire resistance", () => {
      const items = [createMockItem("Item1", ["Fire Resist 30%"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fireRes).toBe(-40); // -70 + 30
      expect(stats.coldRes).toBe(-70); // unchanged
    });

    it("should parse individual cold resistance", () => {
      const items = [createMockItem("Item1", ["Cold Resist 25%"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.coldRes).toBe(-45);
    });

    it("should parse individual lightning resistance", () => {
      const items = [createMockItem("Item1", ["Lightning Resist 35%"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.lightningRes).toBe(-35);
    });

    it("should parse individual poison resistance", () => {
      const items = [createMockItem("Item1", ["Poison Resist 40%"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.poisonRes).toBe(-30);
    });

    it("should parse max resistance bonuses", () => {
      const items = [
        createMockItem("Item1", ["5% to Maximum Fire Resist"]),
        createMockItem("Item2", ["3% to Maximum Cold Resist"]),
        createMockItem("Item3", ["4% to Maximum Lightning Resist"]),
        createMockItem("Item4", ["2% to Maximum Poison Resist"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.maxFireRes).toBe(80);
      expect(stats.maxColdRes).toBe(78);
      expect(stats.maxLightningRes).toBe(79);
      expect(stats.maxPoisonRes).toBe(77);
    });

    it("should stack multiple resistance bonuses", () => {
      const items = [
        createMockItem("Item1", ["All Resistances +10%", "Fire Resist 15%"]),
        createMockItem("Item2", ["All Resistances +5%", "Cold Resist 20%"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fireRes).toBe(-40); // -70 + 10 + 5 + 15 = -40
      expect(stats.coldRes).toBe(-35); // -70 + 10 + 5 + 20 = -35
    });
  });

  describe("Attribute Parsing", () => {
    it("should parse strength bonuses", () => {
      const items = [createMockItem("Item1", ["+25 to Strength"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.strength).toBe(125);
    });

    it("should parse dexterity bonuses", () => {
      const items = [createMockItem("Item1", ["+30 to Dexterity"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.dexterity).toBe(105);
    });

    it("should parse vitality bonuses", () => {
      const items = [createMockItem("Item1", ["+20 to Vitality"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.vitality).toBe(220);
    });

    it("should parse energy bonuses", () => {
      const items = [createMockItem("Item1", ["+15 to Energy"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.energy).toBe(165);
    });

    it("should stack multiple attribute bonuses", () => {
      const items = [
        createMockItem("Item1", ["+10 to Strength", "+5 to Dexterity"]),
        createMockItem("Item2", ["+15 to Strength", "+10 to Vitality"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.strength).toBe(125); // 100 + 10 + 15
      expect(stats.dexterity).toBe(80); // 75 + 5
      expect(stats.vitality).toBe(210); // 200 + 10
    });
  });

  describe("Speed Stats Parsing", () => {
    it("should parse faster cast rate", () => {
      const items = [createMockItem("Item1", ["20% Faster Cast Rate"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fasterCastRate).toBe(20);
    });

    it("should parse increased attack speed", () => {
      const items = [createMockItem("Item1", ["30% Increased Attack Speed"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.increasedAttackSpeed).toBe(30);
    });

    it("should parse faster run/walk", () => {
      const items = [createMockItem("Item1", ["25% Faster Run/Walk"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fasterRunWalk).toBe(25);
    });

    it("should parse faster hit recovery", () => {
      const items = [createMockItem("Item1", ["15% Faster Hit Recovery"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fasterHitRecovery).toBe(15);
    });

    it("should stack speed bonuses", () => {
      const items = [
        createMockItem("Item1", [
          "20% Faster Cast Rate",
          "10% Faster Run/Walk",
        ]),
        createMockItem("Item2", [
          "10% Faster Cast Rate",
          "15% Faster Run/Walk",
        ]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fasterCastRate).toBe(30);
      expect(stats.fasterRunWalk).toBe(25);
    });
  });

  describe("Leech Stats Parsing", () => {
    it("should parse life leech", () => {
      const items = [createMockItem("Item1", ["8% Life stolen per hit"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.lifeLeech).toBe(8);
    });

    it("should parse mana leech", () => {
      const items = [createMockItem("Item1", ["3% Mana stolen per hit"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.manaLeech).toBe(3);
    });

    it("should parse life after each kill", () => {
      const items = [createMockItem("Item1", ["4 Life after each Kill"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.hpPerKill).toBe(4);
    });

    it("should parse mana after each kill", () => {
      const items = [createMockItem("Item1", ["5 to Mana after each Kill"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.mpPerKill).toBe(5);
    });
  });

  describe("Elemental Skill Damage Stats Parsing", () => {
    it("should parse fire skill damage", () => {
      const items = [createMockItem("Item1", ["8% to Fire Skill Damage"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fireSkillDamage).toBe(8);
    });

    it("should parse cold skill damage", () => {
      const items = [createMockItem("Item1", ["3% to Cold Skill Damage"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.coldSkillDamage).toBe(3);
    });

    it("should parse lightning skill damage", () => {
      const items = [createMockItem("Item1", ["4% to Lightning Skill Damage"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.lightningSkillDamage).toBe(4);
    });

    it("should parse poison skill damage", () => {
      const items = [createMockItem("Item1", ["5% to Poison Skill Damage"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.poisonSkillDamage).toBe(5);
    });
  });

  describe("Elemental Pierce Parsing", () => {
    it("should parse fire pierce", () => {
      const items = [createMockItem("Item1", ["-8% to Enemy Fire Resistance"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.firePierce).toBe(-8);
    });

    it("should parse cold pierce", () => {
      const items = [createMockItem("Item1", ["-3% to Enemy Cold Resistance"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.coldPierce).toBe(-3);
    });

    it("should parse lightning pierce", () => {
      const items = [createMockItem("Item1", ["-4% to Enemy Lightning Resistance"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.lightningPierce).toBe(-4);
    });

    it("should parse poison pierce", () => {
      const items = [createMockItem("Item1", ["-5% to Enemy Poison Resistance"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.poisonPierce).toBe(-5);
    });
  });

  describe("Magic Find and Gold Find", () => {
    it("should parse magic find", () => {
      const items = [
        createMockItem("Item1", ["50% Better Chance of Getting Magic Items"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.magicFind).toBe(50);
    });

    it("should parse gold find", () => {
      const items = [createMockItem("Item1", ["30% Extra Gold from Monsters"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.goldFind).toBe(30);
    });

    it("should ignore MF from Enigma", () => {
      const items = [
        createMockItem("Enigma", ["74% Better Chance of Getting Magic Items"]),
        createMockItem("Other Item", [
          "25% Better Chance of Getting Magic Items",
        ]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.magicFind).toBe(25); // Only from Other Item
    });

    it("should stack MF from multiple items", () => {
      const items = [
        createMockItem("Item1", ["50% Better Chance of Getting Magic Items"]),
        createMockItem("Item2", ["40% Better Chance of Getting Magic Items"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.magicFind).toBe(90);
    });
  });

  describe("Absorb Stats", () => {
    it("should parse fire absorb percentage", () => {
      const items = [createMockItem("Item1", ["Fire Absorb 10%"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fAbsorbPct).toBe(10);
    });

    it("should parse cold absorb percentage", () => {
      const items = [createMockItem("Item1", ["Cold Absorb 8%"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.cAbsorbPct).toBe(8);
    });

    it("should parse lightning absorb percentage", () => {
      const items = [createMockItem("Item1", ["Lightning Absorb 12%"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.lAbsorbPct).toBe(12);
    });

    it("should parse fire absorb flat", () => {
      const items = [createMockItem("Item1", ["+20 Fire Absorb"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fAbsorbFlat).toBe(20);
    });

    it("should parse cold absorb flat", () => {
      const items = [createMockItem("Item1", ["+15 Cold Absorb"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.cAbsorbFlat).toBe(15);
    });

    it("should parse lightning absorb flat", () => {
      const items = [createMockItem("Item1", ["+25 Lightning Absorb"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.lAbsorbFlat).toBe(25);
    });

    it("should parse magic absorb flat", () => {
      const items = [createMockItem("Item1", ["+5 Magic Absorb"])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.mAbsorbFlat).toBe(5);
    });
  });

  describe("Damage Procs", () => {
    it("should parse crushing blow", () => {
      const items = [
        createMockItem("Item1", ["+25% Chance of Crushing Blow"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.crushingBlow).toBe(25);
    });

    it("should parse deadly strike", () => {
      const items = [
        createMockItem("Item1", ["+33% Deadly Strike"])
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.deadlyStrike).toBe(33);
    });

    it("should parse open wounds", () => {
      const items = [
        createMockItem("Item1", ["+50% Chance of Open Wounds"])
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.openWounds).toBe(50);
    });

    it("should parse open wounds additional dps", () => {
      const items = [
        createMockItem("Item1", ["+500 Open Wounds Damage Per Second"])
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.openWoundsDPS).toBe(500);
    });
  });

  describe("Physical Damage Reduction", () => {
    it("should parse PDR", () => {
      const items = [
        createMockItem("Item1", ["Physical Damage Taken Reduced by 15%"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.physicalDamageReduction).toBe(15);
    });

    it("should stack PDR from multiple items", () => {
      const items = [
        createMockItem("Item1", ["Physical Damage Taken Reduced by 10%"]),
        createMockItem("Item2", ["Physical Damage Taken Reduced by 5%"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.physicalDamageReduction).toBe(15);
    });
  });

  describe("Weapon Switch Handling", () => {
    it("should ignore items in left hand switch", () => {
      const items = [
        createMockItem("Main Weapon", ["+50 to Strength"], "Right Hand"),
        createMockItem(
          "Switch Weapon",
          ["+100 to Strength"],
          "Left Hand Switch"
        ),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.strength).toBe(150); // Only main weapon counted
    });

    it("should ignore items in right hand switch", () => {
      const items = [
        createMockItem("Main Weapon", ["+20 to Dexterity"], "Right Hand"),
        createMockItem(
          "Switch Weapon",
          ["+100 to Dexterity"],
          "Right Hand Switch"
        ),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.dexterity).toBe(95); // Only main weapon counted
    });
  });

  describe("Complex Item Combinations", () => {
    it("should handle items with multiple properties", () => {
      const items = [
        createMockItem("Complex Item", [
          "All Resistances +15%",
          "+25 to Strength",
          "20% Faster Cast Rate",
          "50% Better Chance of Getting Magic Items",
          "+10 to Energy",
        ]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fireRes).toBe(-55);
      expect(stats.strength).toBe(125);
      expect(stats.fasterCastRate).toBe(20);
      expect(stats.magicFind).toBe(50);
      expect(stats.energy).toBe(160);
    });

    it("should handle equipment loadout", () => {
      const items = [
        createMockItem("Shako", [
          "All Resistances +20%",
          "50% Better Chance of Getting Magic Items",
        ]),
        createMockItem("Arachnid Mesh", [
          "20% Faster Cast Rate",
          "+1 to All Skills",
        ]),
        createMockItem("Magefist", ["20% Faster Cast Rate", "Fire Resist 15%"]),
        createMockItem("Wartraveler", [
          "30% Faster Run/Walk",
          "50% Extra Gold from Monsters",
        ]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.fasterCastRate).toBe(40); // 20 + 20
      expect(stats.fasterRunWalk).toBe(30);
      expect(stats.fireRes).toBe(-35); // -70 + 20 + 15
      expect(stats.magicFind).toBe(50);
      expect(stats.goldFind).toBe(50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle items with no properties", () => {
      const items = [createMockItem("Empty Item", [])];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.strength).toBe(100); // Base only
    });

    it("should handle empty items array", () => {
      const char = createMockCharacter([]);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.strength).toBe(100);
      expect(stats.fasterCastRate).toBe(0);
    });

    it("should handle properties with no numeric values", () => {
      const items = [
        createMockItem("Item1", ["Cannot Be Frozen", "Indestructible"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      // Should not crash, just ignore these properties
      expect(stats).toBeDefined();
    });

    it("should handle very large stat values", () => {
      const items = [
        createMockItem("Item1", ["+999 to Strength", "999% Faster Cast Rate"]),
      ];
      const char = createMockCharacter(items);
      const parser = new CharacterStatParser(char);
      const stats = parser.parseAndGetCharStats();

      expect(stats.strength).toBe(1099);
      expect(stats.fasterCastRate).toBe(999);
    });
  });
});
