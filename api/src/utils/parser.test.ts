//@ts-nocheck
import { charsWithUniques, allUniqueUsage } from "./parser";
import { ICharacter, IItem, CharacterData } from "../types";

type CharacterResp = CharacterData;

// Helper function to create mock items
function createMockItem(name: string, quality: string = "Unique"): IItem {
  return {
    name,
    quality: { name: quality, id: quality === "Unique" ? 7 : 1 },
    base_item: { name: "Test Base", id: 1 },
    location: { equipment: "Body Armor", x: 0, y: 0, width: 2, height: 3 },
    properties: [],
  } as unknown as IItem;
}

// Helper function to create mock character response
function createMockCharacter(
  characterName: string,
  items: IItem[]
): CharacterResp {
  return {
    character: {
      name: characterName,
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

describe("Parser Utility", () => {
  describe("charsWithUniques", () => {
    it("should return characters that have all required uniques", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Arachnid Mesh"),
          createMockItem("Enigma"),
        ]),
        createMockCharacter("Char2", [
          createMockItem("Shako"),
          createMockItem("Enigma"),
        ]),
        createMockCharacter("Char3", [
          createMockItem("Griffons"),
          createMockItem("Shako"),
        ]),
      ];

      const result = charsWithUniques(chars, ["Shako"]);

      expect(result.length).toBe(3);
      expect(result.map((c) => c.character.name)).toEqual([
        "Char1",
        "Char2",
        "Char3",
      ]);
    });

    it("should filter out characters missing required uniques", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Arachnid Mesh"),
        ]),
        createMockCharacter("Char2", [createMockItem("Enigma")]),
        createMockCharacter("Char3", [createMockItem("Shako")]),
      ];

      const result = charsWithUniques(chars, ["Shako", "Arachnid Mesh"]);

      expect(result.length).toBe(1);
      expect(result[0].character.name).toBe("Char1");
    });

    it("should handle multiple required uniques", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Arachnid Mesh"),
          createMockItem("Griffons"),
        ]),
        createMockCharacter("Char2", [
          createMockItem("Shako"),
          createMockItem("Griffons"),
        ]),
      ];

      const result = charsWithUniques(chars, [
        "Shako",
        "Arachnid Mesh",
        "Griffons",
      ]);

      expect(result.length).toBe(1);
      expect(result[0].character.name).toBe("Char1");
    });

    it("should return empty array when no characters match", () => {
      const chars = [
        createMockCharacter("Char1", [createMockItem("Shako")]),
        createMockCharacter("Char2", [createMockItem("Enigma")]),
      ];

      const result = charsWithUniques(chars, ["Griffons"]);

      expect(result.length).toBe(0);
    });

    it("should handle empty character array", () => {
      const result = charsWithUniques([], ["Shako"]);

      expect(result.length).toBe(0);
    });

    it("should handle empty required uniques array", () => {
      const chars = [
        createMockCharacter("Char1", [createMockItem("Shako")]),
        createMockCharacter("Char2", [createMockItem("Enigma")]),
      ];

      const result = charsWithUniques(chars, []);

      expect(result.length).toBe(2); // All characters match when no requirements
    });

    it("should ignore standard unique items (Torch, Anni, Gheeds)", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Hellfire Torch"),
          createMockItem("Annihilus"),
        ]),
      ];

      // Torch, Anni, and Gheeds should not count toward requirements
      const result = charsWithUniques(chars, ["Hellfire Torch"]);

      expect(result.length).toBe(0);
    });

    it("should handle non-unique quality items", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Rare Ring", "Rare"),
          createMockItem("Magic Amulet", "Magic"),
        ]),
      ];

      const result = charsWithUniques(chars, ["Shako"]);

      expect(result.length).toBe(1);
    });

    it("should handle characters with duplicate unique items", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Shako"), // Duplicate
        ]),
      ];

      const result = charsWithUniques(chars, ["Shako"]);

      expect(result.length).toBe(1);
    });
  });

  describe("allUniqueUsage", () => {
    it("should calculate usage statistics for unique items", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Arachnid Mesh"),
        ]),
        createMockCharacter("Char2", [
          createMockItem("Shako"),
          createMockItem("Griffons"),
        ]),
        createMockCharacter("Char3", [
          createMockItem("Shako"),
          createMockItem("Arachnid Mesh"),
        ]),
      ];

      const result = allUniqueUsage(chars, []);

      expect(result.length).toBe(3);
      expect(result.find((r) => r.item === "Shako")).toEqual({
        item: "Shako",
        numOccurances: 3,
        totalSample: 3,
        pct: 100,
      });
      expect(result.find((r) => r.item === "Arachnid Mesh")).toEqual({
        item: "Arachnid Mesh",
        numOccurances: 2,
        totalSample: 3,
        pct: expect.closeTo(66.67, 1),
      });
    });

    it("should filter by required uniques before calculating stats", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Enigma"),
        ]),
        createMockCharacter("Char2", [
          createMockItem("Shako"),
          createMockItem("Arachnid Mesh"),
        ]),
        createMockCharacter("Char3", [createMockItem("Griffons")]),
      ];

      const result = allUniqueUsage(chars, ["Shako"]);

      // Only Char1 and Char2 should be counted (they have Shako)
      expect(result.find((r) => r.item === "Shako")).toEqual({
        item: "Shako",
        numOccurances: 2,
        totalSample: 2,
        pct: 100,
      });
      expect(result.find((r) => r.item === "Griffons")).toBeUndefined();
    });

    it("should sort results by percentage descending", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Item1"),
        ]),
        createMockCharacter("Char2", [
          createMockItem("Shako"),
          createMockItem("Item2"),
        ]),
        createMockCharacter("Char3", [
          createMockItem("Shako"),
          createMockItem("Item1"),
        ]),
      ];

      const result = allUniqueUsage(chars, []);

      expect(result[0].item).toBe("Shako"); // 100%
      expect(result[1].item).toBe("Item1"); // 66.67%
      expect(result[2].item).toBe("Item2"); // 33.33%
    });

    it("should handle empty character array", () => {
      const result = allUniqueUsage([], []);

      expect(result.length).toBe(0);
    });

    it("should handle characters with no matching required uniques", () => {
      const chars = [
        createMockCharacter("Char1", [createMockItem("Shako")]),
        createMockCharacter("Char2", [createMockItem("Enigma")]),
      ];

      const result = allUniqueUsage(chars, ["Griffons"]);

      expect(result.length).toBe(0);
    });

    it("should ignore Torch, Anni, and Gheeds in usage stats", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Hellfire Torch"),
          createMockItem("Annihilus"),
        ]),
        createMockCharacter("Char2", [
          createMockItem("Shako"),
          createMockItem("Hellfire Torch"),
        ]),
      ];

      const result = allUniqueUsage(chars, []);

      expect(result.length).toBe(1); // Only Shako
      expect(result[0].item).toBe("Shako");
      expect(result.find((r) => r.item === "Hellfire Torch")).toBeUndefined();
      expect(result.find((r) => r.item === "Annihilus")).toBeUndefined();
      expect(result.find((r) => r.item === "Gheed's Fortune")).toBeUndefined();
    });

    it("should calculate correct percentages with different usage counts", () => {
      const chars = Array.from({ length: 10 }, (_, i) => {
        const items = [createMockItem("Shako")];
        if (i < 5) items.push(createMockItem("Item1"));
        if (i < 3) items.push(createMockItem("Item2"));
        if (i < 1) items.push(createMockItem("Item3"));
        return createMockCharacter(`Char${i}`, items);
      });

      const result = allUniqueUsage(chars, []);

      expect(result.find((r) => r.item === "Shako")?.pct).toBe(100);
      expect(result.find((r) => r.item === "Item1")?.pct).toBe(50);
      expect(result.find((r) => r.item === "Item2")?.pct).toBe(30);
      expect(result.find((r) => r.item === "Item3")?.pct).toBe(10);
    });

    it("should handle non-unique items in character inventory", () => {
      const chars = [
        createMockCharacter("Char1", [
          createMockItem("Shako"),
          createMockItem("Rare Item", "Rare"),
          createMockItem("Magic Item", "Magic"),
        ]),
      ];

      const result = allUniqueUsage(chars, []);

      expect(result.length).toBe(1);
      expect(result[0].item).toBe("Shako");
    });

    it("should handle zero division when totalSample is 0", () => {
      const chars = [createMockCharacter("Char1", [createMockItem("Shako")])];

      const result = allUniqueUsage(chars, ["Griffons"]);

      // No characters match, so totalSample = 0
      expect(result.length).toBe(0);
    });
  });
});
