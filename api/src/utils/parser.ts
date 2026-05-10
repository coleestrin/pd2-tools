import { IItem, CharacterData } from "../types";

// Uniques used in almost every build, useless statistic
const IGNORED_UNIQUES = [
  "Hellfire Torch",
  "Annihilus",
  "Call to Arms",
  "Lidless Wall",
];

function getUniquesFromItemList(items: IItem[]): string[] {
  const resp = [];

  if (!items) {
    console.log("Sort returning [] for falsy items");
    return [];
  }

  for (let i = 0; i < items.length; i++) {
    if (
      items[i].quality.name === "Unique" &&
      !IGNORED_UNIQUES.includes(items[i].name)
    ) {
      resp.push(items[i].name);
    }
  }

  return resp;
}

function hasRequiredUniques(
  items: IItem[],
  requiredUniques: string[]
): boolean {
  const uniques = getUniquesFromItemList(items);

  const reqUniqueSet = new Set(requiredUniques);

  for (let i = 0; i < uniques.length; i++) {
    if (reqUniqueSet.has(uniques[i])) {
      reqUniqueSet.delete(uniques[i]);
    }
  }

  return reqUniqueSet.size === 0;
}

export function charsWithUniques(
  chars: CharacterData[],
  mustIncludeUniques: string[]
): CharacterData[] {
  const validChars = [];

  for (let i = 0; i < chars.length; i++) {
    if (hasRequiredUniques(chars[i].items, mustIncludeUniques)) {
      validChars.push(chars[i]);
    }
  }

  return validChars;
}

export function allUniqueUsage(
  chars: CharacterData[],
  mustIncludeUniques: string[]
) {
  const uniqueUsage: Map<string, number> = new Map();
  let totalSample = 0;

  for (const char of chars) {
    if (!hasRequiredUniques(char.items, mustIncludeUniques)) continue;

    totalSample++;

    const uniques = getUniquesFromItemList(char.items);

    for (const unique of uniques) {
      const uniqueMapVal = uniqueUsage.get(unique);
      if (uniqueMapVal) {
        uniqueUsage.set(unique, uniqueMapVal + 1);
      } else {
        uniqueUsage.set(unique, 1);
      }
    }
  }

  const usageStats = Array.from(uniqueUsage.entries()).map(
    ([item, numOccurances]) => {
      const pct = totalSample > 0 ? (numOccurances / totalSample) * 100 : 0;
      return { item, numOccurances, totalSample, pct };
    }
  );

  usageStats.sort((a, b) => b.pct - a.pct);

  return usageStats;
}
