import slotByName from "../data/item-slots.json";
import type { Slot } from "./types";

export function slotFromItemName(itemName: string): Slot | null {
  const map = slotByName as Record<string, string>;
  const v = map[itemName];
  return (v ?? null) as Slot | null;
}

const SLOT_BY_EQUIPMENT: Record<string, Slot | null> = {
  Helm: "helm",
  Armor: "armor",
  "Right Hand": "weapon",
  "Right Hand Switch": "weapon",
  "Left Hand": "offhand",
  "Left Hand Switch": "offhand",
  Gloves: "gloves",
  Belt: "belt",
  Boots: "boots",
  Amulet: "amulet",
  "Left Ring": "ring",
  "Right Ring": "ring",
};

export function slotFromRawItem(item: {
  location?: { zone?: string; equipment?: string } | null;
  slot?: string;
}): Slot | null {
  // The pd2.tools API leaves `location.equipment` populated with phantom
  // gear-slot names ("Helm", "Right Hand", "Armor", "Left Ring", …) on items
  // that aren't equipped: most visibly on charms sitting in inventory.
  // The authoritative signal is `location.zone`, which is "Equipped" only
  // for actually-equipped gear. Without this gate, the diff view buckets
  // inventory charms into gear slots and the affix-mods aggregator includes
  // charm modifiers in per-slot rare/magic/crafted stats.
  if (item.location && typeof item.location === "object") {
    const zone = (item.location as { zone?: string }).zone;
    if (zone !== "Equipped") return null;
  }

  const equipment =
    (item.location && typeof item.location === "object" && "equipment" in item.location
      ? (item.location as { equipment?: string }).equipment
      : null) ?? item.slot ?? "";

  return SLOT_BY_EQUIPMENT[equipment] ?? null;
}
