import fs from "fs";
import path from "path";
import type { DamageRange, IItem, IModifier } from "../types";

type ElementalItemDamageElement = "fire" | "cold" | "lightning" | "magic";

type GameTable = {
  columns: string[];
  rowsByKey: Map<string, string[]>;
};

type PropertyExpansionSlot = {
  func: number;
  stat: string;
};

export type ExpandedItemStatLedger = Record<string, number>;

const PD2_GAME_DATA_DIRECTORY = path.resolve(
  process.cwd(),
  "src",
  "game-data",
  "pd2",
  "season-13"
);

const PROPERTY_ALIASES: Record<string, string> = {
  firedam: "dmg-fire",
  colddam: "dmg-cold",
  ltngdam: "dmg-ltng",
  lightdam: "dmg-ltng",
  lightningdam: "dmg-ltng",
  magicdam: "dmg-mag",
  poisondam: "dmg-pois",
};

const COLLAPSED_MIN_STAT_MAX_STATS: Record<string, string> = {
  firemindam: "firemaxdam",
  lightmindam: "lightmaxdam",
  magicmindam: "magicmaxdam",
  coldmindam: "coldmaxdam",
  poisonmindam: "poisonmaxdam",
};

const COLLAPSED_MIN_STAT_LENGTH_STATS: Record<string, string> = {
  coldmindam: "coldlength",
  poisonmindam: "poisonlength",
};

const ELEMENTAL_DAMAGE_STATS: Record<
  ElementalItemDamageElement,
  { min: string; max: string }
> = {
  fire: { min: "firemindam", max: "firemaxdam" },
  cold: { min: "coldmindam", max: "coldmaxdam" },
  lightning: { min: "lightmindam", max: "lightmaxdam" },
  magic: { min: "magicmindam", max: "magicmaxdam" },
};

const gameTableCache = new Map<string, GameTable>();
let propertyExpansionCache: Map<string, PropertyExpansionSlot[]> | undefined;
let itemStatNamesCache: Set<string> | undefined;

function loadGameTable(fileName: string, keyColumn: string): GameTable {
  const cached = gameTableCache.get(fileName);
  if (cached) {
    return cached;
  }

  const filePath = path.join(PD2_GAME_DATA_DIRECTORY, fileName);
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.trimEnd().split(/\r?\n/);
  const columns = (lines.shift() || "").split("\t");
  const keyIndex = columns.indexOf(keyColumn);
  if (keyIndex < 0) {
    throw new Error(`${fileName} is missing key column ${keyColumn}`);
  }

  const rowsByKey = new Map<string, string[]>();
  lines.forEach((line) => {
    const row = line.split("\t");
    const key = row[keyIndex];
    if (key && !rowsByKey.has(key)) {
      rowsByKey.set(key, row);
    }
  });

  const table = { columns, rowsByKey };
  gameTableCache.set(fileName, table);
  return table;
}

function getGameCell(
  table: GameTable,
  row: string[],
  columnName: string
): string {
  const index = table.columns.indexOf(columnName);
  return index >= 0 ? row[index] || "" : "";
}

function getPropertyExpansions(): Map<string, PropertyExpansionSlot[]> {
  if (propertyExpansionCache) {
    return propertyExpansionCache;
  }

  const table = loadGameTable("Properties.txt", "code");
  const expansions = new Map<string, PropertyExpansionSlot[]>();

  table.rowsByKey.forEach((row, code) => {
    const slots: PropertyExpansionSlot[] = [];
    for (let index = 1; index <= 7; index += 1) {
      const stat = getGameCell(table, row, `stat${index}`);
      if (!stat) {
        continue;
      }

      const func = Number(getGameCell(table, row, `func${index}`));
      if (!Number.isFinite(func)) {
        continue;
      }

      slots.push({ func, stat });
    }

    if (slots.length > 0) {
      expansions.set(code, slots);
    }
  });

  propertyExpansionCache = expansions;
  return expansions;
}

function getItemStatNames(): Set<string> {
  if (itemStatNamesCache) {
    return itemStatNamesCache;
  }

  itemStatNamesCache = new Set(
    Array.from(loadGameTable("ItemStatCost.txt", "Stat").rowsByKey.keys())
  );
  return itemStatNamesCache;
}

function getModifierNumber(
  modifier: Pick<IModifier, "values">,
  index: number
): number | undefined {
  const value = modifier.values?.[index];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return undefined;
}

function addStat(ledger: ExpandedItemStatLedger, stat: string, value: number) {
  ledger[stat] = (ledger[stat] || 0) + value;
}

function addStatIfPresent(
  ledger: ExpandedItemStatLedger,
  stat: string,
  value: number | undefined
) {
  if (value === undefined) {
    return;
  }

  addStat(ledger, stat, value);
}

function expandPropertyModifier(
  ledger: ExpandedItemStatLedger,
  modifier: IModifier,
  slots: PropertyExpansionSlot[]
) {
  slots.forEach((slot) => {
    if (slot.func === 1 || slot.func === 3) {
      addStatIfPresent(ledger, slot.stat, getModifierNumber(modifier, 0));
      return;
    }

    if (slot.func === 15) {
      addStatIfPresent(ledger, slot.stat, getModifierNumber(modifier, 0));
      return;
    }

    if (slot.func === 16) {
      addStatIfPresent(ledger, slot.stat, getModifierNumber(modifier, 1));
      return;
    }

    if (slot.func === 17) {
      addStatIfPresent(ledger, slot.stat, getModifierNumber(modifier, 2));
    }
  });
}

function expandDirectStatModifier(
  ledger: ExpandedItemStatLedger,
  modifier: IModifier
): void {
  if (!getItemStatNames().has(modifier.name)) {
    return;
  }

  const minValue = getModifierNumber(modifier, 0);
  addStatIfPresent(ledger, modifier.name, minValue);

  const pairedMaxStat = COLLAPSED_MIN_STAT_MAX_STATS[modifier.name];
  if (pairedMaxStat) {
    addStatIfPresent(ledger, pairedMaxStat, getModifierNumber(modifier, 1));
  }

  const pairedLengthStat = COLLAPSED_MIN_STAT_LENGTH_STATS[modifier.name];
  if (pairedLengthStat) {
    addStatIfPresent(ledger, pairedLengthStat, getModifierNumber(modifier, 2));
  }
}

function normalizeDamageRange(range: DamageRange): DamageRange {
  return {
    min: Math.max(0, range.min),
    max: Math.max(Math.max(0, range.min), range.max),
  };
}

export function expandItemStats(item: Pick<IItem, "modifiers">) {
  const ledger: ExpandedItemStatLedger = {};
  const propertyExpansions = getPropertyExpansions();

  (item.modifiers || []).forEach((modifier) => {
    const propertyCode = PROPERTY_ALIASES[modifier.name] || modifier.name;
    const slots = propertyExpansions.get(propertyCode);
    if (slots) {
      expandPropertyModifier(ledger, modifier, slots);
      return;
    }

    expandDirectStatModifier(ledger, modifier);
  });

  return ledger;
}

export function getExpandedItemElementalDamageRanges(
  item: Pick<IItem, "modifiers">
): Partial<Record<ElementalItemDamageElement, DamageRange>> {
  const ledger = expandItemStats(item);
  const ranges: Partial<Record<ElementalItemDamageElement, DamageRange>> = {};

  (
    Object.entries(ELEMENTAL_DAMAGE_STATS) as Array<
      [ElementalItemDamageElement, { min: string; max: string }]
    >
  ).forEach(([element, stats]) => {
    const min = ledger[stats.min] || 0;
    const max = ledger[stats.max] || 0;
    if (min === 0 && max === 0) {
      return;
    }

    ranges[element] = normalizeDamageRange({ min, max });
  });

  return ranges;
}
