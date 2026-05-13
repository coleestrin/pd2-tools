import type {
  FullCharacterResponse,
  IItem,
  IMetaResponse,
  Slot,
} from "../types";
import { shapeTopItemsBySlot, type TopItemsBySlot } from "./shape/topItems";
import modDictionaryRaw from "../data/mod-dictionary.json";

type ModDictEntry = { displayLabel?: string; category?: string };
const MOD_DICT = modDictionaryRaw as Record<string, ModDictEntry>;

const SLOTS: Slot[] = [
  "helm",
  "armor",
  "weapon",
  "offhand",
  "gloves",
  "belt",
  "boots",
  "amulet",
  "ring",
];

// Diff considers the active loadout only — weapon-swap positions are
// excluded so a character's secondary set doesn't confuse the comparison.
// Both ring positions still map to "ring"; the diff just shows whichever
// the character wears first.
const SLOT_BY_EQUIPMENT: Record<string, Slot> = {
  Helm: "helm",
  Armor: "armor",
  "Right Hand": "weapon",
  "Left Hand": "offhand",
  Gloves: "gloves",
  Belt: "belt",
  Boots: "boots",
  Amulet: "amulet",
  "Left Ring": "ring",
  "Right Ring": "ring",
};

// location.equipment is populated with phantom slot names even on inventory
// items (notably charms). Only "Equipped"-zone items map to a real slot.
function slotForItem(item: IItem): Slot | null {
  const loc = item.location;
  if (!loc) return null;
  if (loc.zone !== undefined && loc.zone !== "Equipped") return null;
  return SLOT_BY_EQUIPMENT[loc.equipment ?? ""] ?? null;
}

export type SlotDiff = {
  slot: Slot;
  poolTopItemName: string | null;
  poolTopItemType: string | null;
  userItemName: string | null;
  userItemQuality: string | null;
  userMatchesPoolTop: boolean;
  poolTopAffixMods: Array<{
    modName: string;
    displayLabel: string;
    pct: number;
    userHas: boolean;
  }>;
};

export type CharacterDiff = {
  characterName: string;
  accountName: string;
  characterLevel: number;
  className: string;
  mercTypeMatchesPool: boolean | null;
  poolMercType: string | null;
  userMercType: string | null;
  slots: Record<Slot, SlotDiff>;
};

function bucketAffixModsBySlot(meta: IMetaResponse): Record<Slot, IMetaResponse["affixMods"]> {
  const bySlot = Object.fromEntries(SLOTS.map((s) => [s, [] as IMetaResponse["affixMods"]])) as Record<
    Slot,
    IMetaResponse["affixMods"]
  >;
  for (const row of meta.affixMods) {
    if (bySlot[row.slot]) bySlot[row.slot].push(row);
  }
  for (const s of SLOTS) bySlot[s].sort((a, b) => b.pct - a.pct);
  return bySlot;
}

// Resolve a modKey to a human-readable label. Pipe-suffixed keys
// (item_addskill_tab|Combat Skills, item_singleskill|Ice Blast,
// item_addclassskills|Sorceress Skills) carry the label after the pipe.
// Everything else looks up in mod-dictionary.json; falls back to the raw key.
function affixLabel(modKey: string): string {
  if (modKey.includes("|")) return modKey.split("|")[1] ?? modKey;
  return MOD_DICT[modKey]?.displayLabel ?? modKey;
}

// Word-boundary match: avoids false positives where "Resist" matches every
// elemental resistance line. Falls back to substring match if the regex
// can't be built (label contains only special chars).
function userHasAffix(userProps: string[], label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim();
  if (!escaped) return false;
  try {
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    return userProps.some((p) => re.test(p));
  } catch {
    const lower = label.toLowerCase();
    return userProps.some((p) => p.toLowerCase().includes(lower));
  }
}

export function diffCharacter(
  raw: FullCharacterResponse,
  meta: IMetaResponse,
): CharacterDiff | null {
  if (!raw || !raw.character) return null;

  const topItemsBySlot: TopItemsBySlot = shapeTopItemsBySlot(meta.itemUsage);
  const affixModsBySlot = bucketAffixModsBySlot(meta);
  const items = raw.items ?? [];

  const slots = {} as Record<Slot, SlotDiff>;

  for (const slot of SLOTS) {
    const item = items.find((it) => slotForItem(it) === slot) ?? null;
    const poolTop = topItemsBySlot[slot]?.[0] ?? null;
    const poolTopMods = affixModsBySlot[slot].slice(0, 5);

    const userProps = item?.properties ?? [];

    let userItemName: string | null = null;
    if (item) {
      if (item.name) {
        userItemName = item.name;
      } else if (item.runeword) {
        userItemName = "Runeword";
      } else {
        userItemName = item.quality?.name ?? "Item";
      }
    }

    slots[slot] = {
      slot,
      poolTopItemName: poolTop?.itemName ?? null,
      poolTopItemType: poolTop?.itemType ?? null,
      userItemName,
      userItemQuality: item?.quality?.name ?? null,
      userMatchesPoolTop:
        !!poolTop && !!userItemName && userItemName === poolTop.itemName,
      poolTopAffixMods: poolTopMods.map((m) => {
        const label = affixLabel(m.modKey);
        return {
          modName: m.modKey,
          displayLabel: label,
          pct: m.pct,
          userHas: userHasAffix(userProps, label),
        };
      }),
    };
  }

  const mercDesc =
    typeof raw.mercenary === "object" && raw.mercenary !== null
      ? (raw.mercenary as { description?: string; type?: string }).description ??
        (raw.mercenary as { description?: string; type?: string }).type ??
        null
      : null;
  const poolMercType = meta.mercTypeUsage?.[0]?.mercType ?? null;

  return {
    characterName: raw.character.name,
    accountName: raw.accountName ?? "",
    characterLevel: raw.character.level,
    className: raw.character.class?.name ?? "",
    mercTypeMatchesPool:
      poolMercType && mercDesc ? poolMercType === mercDesc : null,
    poolMercType,
    userMercType: mercDesc,
    slots,
  };
}
