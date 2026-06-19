import fs from "fs";
import path from "path";
import { IItem } from "../types";

type ArmoryPayload = {
  items?: IItem[] | null;
};

type ArmorTable = {
  columns: string[];
  rowsByCode: Map<string, string[]>;
};

type ArmorBootData = {
  damage: { minimum: number; maximum: number };
  statBonus?: { strength?: number; dexterity?: number };
};

const PD2_GAME_DATA_DIRECTORY = path.resolve(
  process.cwd(),
  "src",
  "game-data",
  "pd2",
  "season-13"
);

let cachedArmorTable: ArmorTable | null | undefined;

function parseArmorTable(filePath: string): ArmorTable {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line, index, allLines) => {
    return line.length > 0 || index < allLines.length - 1;
  });
  const columns = (lines.shift() || "").split("\t");
  const codeIndex = columns.indexOf("code");
  if (codeIndex < 0) {
    throw new Error(`${path.basename(filePath)} is missing code column`);
  }

  const rowsByCode = new Map<string, string[]>();
  lines.forEach((line) => {
    const row = line.split("\t");
    const code = row[codeIndex];
    if (code && !rowsByCode.has(code)) {
      rowsByCode.set(code, row);
    }
  });

  return { columns, rowsByCode };
}

function getArmorTable(): ArmorTable | null {
  if (cachedArmorTable !== undefined) {
    return cachedArmorTable;
  }

  const armorPath = path.join(PD2_GAME_DATA_DIRECTORY, "Armor.txt");

  cachedArmorTable = fs.existsSync(armorPath) ? parseArmorTable(armorPath) : null;
  return cachedArmorTable;
}

function getArmorCell(table: ArmorTable, row: string[], columnName: string): string {
  const index = table.columns.indexOf(columnName);
  return index >= 0 ? row[index] || "" : "";
}

function getArmorNumber(table: ArmorTable, row: string[], columnName: string): number {
  const value = Number(getArmorCell(table, row, columnName));
  return Number.isFinite(value) ? value : 0;
}

function getBaseCodes(item: IItem): string[] {
  return [
    item.base?.id,
    item.base_code,
    item.base?.codes?.elite,
    item.base?.codes?.exceptional,
    item.base?.codes?.normal,
  ].filter((code): code is string => Boolean(code));
}

function getArmorRowForItem(item: IItem): [ArmorTable, string[]] | undefined {
  const table = getArmorTable();
  if (!table) {
    return undefined;
  }

  for (const code of getBaseCodes(item)) {
    const direct = table.rowsByCode.get(code);
    if (direct) {
      return [table, direct];
    }

    const lowerCode = code.toLowerCase();
    const row = Array.from(table.rowsByCode.entries()).find(
      ([rowCode]) => rowCode.toLowerCase() === lowerCode
    )?.[1];
    if (row) {
      return [table, row];
    }
  }

  return undefined;
}

function isEquippedBootItem(item: IItem): boolean {
  if (item.location?.zone !== "Equipped" || item.location?.equipment !== "Boots") {
    return false;
  }

  const typeCode = item.base?.type_code?.toLowerCase();
  const typeName = item.base?.type?.toLowerCase() || "";
  return typeCode === "boot" || typeName.includes("boot");
}

function getArmorBootData(item: IItem): ArmorBootData | undefined {
  const tableRow = getArmorRowForItem(item);
  if (!tableRow) {
    return undefined;
  }

  const [table, row] = tableRow;
  const minimum = getArmorNumber(table, row, "mindam");
  const maximum = getArmorNumber(table, row, "maxdam");
  if (minimum <= 0 && maximum <= 0) {
    return undefined;
  }

  const strength = getArmorNumber(table, row, "StrBonus");
  const dexterity = getArmorNumber(table, row, "DexBonus");

  return {
    damage: { minimum, maximum },
    statBonus:
      strength > 0 || dexterity > 0
        ? {
            ...(strength > 0 ? { strength } : {}),
            ...(dexterity > 0 ? { dexterity } : {}),
          }
        : undefined,
  };
}

function enrichBootItem(item: IItem): void {
  if (!isEquippedBootItem(item)) {
    return;
  }

  const bootData = getArmorBootData(item);
  if (!bootData) {
    return;
  }

  item.base.damage = {
    one_handed: item.base.damage?.one_handed || {},
    two_handed: item.base.damage?.two_handed || {},
    missile: item.base.damage?.missile || {},
    kick: bootData.damage,
  };
  item.damage = {
    one_handed: item.damage?.one_handed || {},
    two_handed: item.damage?.two_handed || {},
    missile: item.damage?.missile || {},
    kick: bootData.damage,
  };

  if (bootData.statBonus) {
    item.base.stat_bonus = {
      ...item.base.stat_bonus,
      ...bootData.statBonus,
    };
  }
}

export function enrichArmoryPayload<T extends ArmoryPayload>(payload: T): T {
  if (!Array.isArray(payload.items)) {
    return payload;
  }

  payload.items.forEach(enrichBootItem);
  return payload;
}
