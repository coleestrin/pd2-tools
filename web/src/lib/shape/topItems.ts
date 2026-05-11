import type { ItemUsageRow } from "../api";
import { slotFromItemName } from "../slot";
import type { Slot } from "../types";

const SLOTS: Slot[] = ["helm", "armor", "weapon", "offhand", "gloves", "belt", "boots", "amulet", "ring"];

export type ShapedItem = {
  itemName: string;
  itemType: string;
  count: number;
  pct: number;
};

export type TopItemsBySlot = Record<Slot, ShapedItem[]>;

export function shapeTopItemsBySlot(rows: ItemUsageRow[]): TopItemsBySlot {
  const out = Object.fromEntries(SLOTS.map((s) => [s, [] as ShapedItem[]])) as TopItemsBySlot;
  for (const row of rows) {
    const slot = slotFromItemName(row.item);
    if (!slot) continue;
    out[slot].push({ itemName: row.item, itemType: row.itemType, count: row.numOccurrences, pct: row.pct });
  }
  for (const s of SLOTS) {
    out[s].sort((a, b) => b.count - a.count);
    out[s] = out[s].slice(0, 8);
  }
  return out;
}
