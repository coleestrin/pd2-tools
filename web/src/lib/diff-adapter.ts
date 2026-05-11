/**
 * Adapts FullCharacterResponse (from charactersAPI.getCharacter) into the
 * Character shape that diffCharacter expects, and builds a GuideSlice from
 * IMetaResponse for the cohort comparison.
 *
 * IItem only stores human-readable property strings, not the structured
 * modifiers[] array, so modifiers is set to [] in the adapted Item. The
 * "affix mod userHas" column always reports false as a result; the
 * item-match comparison still works.
 */

import type { Character, Item, Slot } from "./types";
import type { FullCharacterResponse, IItem } from "../types/character";
import type { IMetaResponse } from "../types/meta";
import { shapeTopItemsBySlot } from "./shape/topItems";
import type { GuideSlice, AffixModsBySlot, AffixMod } from "./diff";

// ---------------------------------------------------------------------------
// Character adapter
// ---------------------------------------------------------------------------

function adaptItem(raw: IItem): Item {
  // Map IItem → Item (partial; only the fields diffCharacter reads).
  const equipmentSlot = raw.location?.equipment ?? "";
  return {
    // Core identity fields
    id: 0,
    hash: "",
    base_code: "",
    category: "",
    item_level: 0,
    is_identified: true,
    is_ethereal: false,
    is_socketed: false,
    is_simple: false,
    is_ear: false,
    is_new: false,
    is_starter: false,
    graphic_id: 0,
    format_version: 0,
    socket_count: 0,
    socketed_count: 0,
    corrupted: false,
    desecrated: false,
    requirements: {},
    position: { row: 0, column: 0 },
    properties: raw.properties ?? [],
    modifiers: [], // IItem has no modifiers array: affix-mod "userHas" will be false
    // Name: IItem.name is only set on named items; otherwise undefined
    name: raw.name ?? undefined,
    // Quality
    quality: {
      id: 0,
      name: (raw.quality?.name ?? "Normal") as Item["quality"]["name"],
    },
    // is_runeword: fork calls it `runeword`
    is_runeword: raw.runeword ?? false,
    // base: diffCharacter reads base.name for display fallback
    base: {
      id: "",
      name: "",
      type: "",
      type_code: "",
      category: "",
      size: { width: 1, height: 1 },
      codes: { normal: "", exceptional: "", elite: "" },
      stackable: false,
      requirements: {},
    },
    // location: slotFromRawItem reads location.equipment
    location: {
      zone: "Equipped",
      storage: "Unknown",
      zone_id: 0,
      equipment: equipmentSlot,
      storage_id: 0,
      equipment_id: 0,
    },
  } as Item;
}

/**
 * Converts a FullCharacterResponse into the PD2 Character shape.
 * Returns null if the response is clearly empty (no character metadata).
 */
export function adaptForkCharacter(raw: FullCharacterResponse): Character | null {
  if (!raw || !raw.character) return null;

  const c = raw.character;

  return {
    accountName: raw.accountName ?? "",
    character: {
      name: c.name,
      level: c.level,
      class: {
        id: c.class?.id ?? 0,
        name: c.class?.name ?? "",
      },
      life: c.life ?? 0,
      mana: c.mana ?? 0,
      stamina: 0,
      experience: c.experience ?? 0,
      attributes: {
        vitality: c.attributes?.vitality ?? 0,
        strength: c.attributes?.strength ?? 0,
        dexterity: c.attributes?.dexterity ?? 0,
        energy: c.attributes?.energy ?? 0,
      },
      points: { stat: 0, skill: 0 },
      gold: { stash: 0, character: 0, total: 0 },
      status: {
        is_dead: c.status?.is_dead ?? false,
        is_ladder: c.status?.is_ladder ?? false,
        is_hardcore: c.status?.is_hardcore ?? false,
        is_expansion: c.status?.is_expansion ?? false,
      },
      skills: (c.skills ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        level: s.level,
      })),
    },
    items: (raw.items ?? []).map(adaptItem),
    realSkills: [],
    mercenary: raw.mercenary as Character["mercenary"],
    file: {
      header: 0,
      version: 0,
      checksum: 0,
      filesize: 0,
      updated_at: raw.lastUpdated ?? 0,
    },
    lastUpdated: raw.lastUpdated ?? 0,
  };
}

// ---------------------------------------------------------------------------
// GuideSlice builder: converts IMetaResponse into what diffCharacter expects
// ---------------------------------------------------------------------------

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

/**
 * Builds a GuideSlice from the /meta response, suitable for diffCharacter().
 *
 * topItemsBySlot comes from the item-usage rows via the existing shapeTopItemsBySlot.
 * affixModsBySlot groups the affix-mod rows by slot and maps to AffixMod shape.
 * poolMercType is the top-1 merc type from mercTypeUsage.
 */
export function buildGuideSlice(meta: IMetaResponse): GuideSlice {
  // topItemsBySlot: reuse existing shaper
  const topItemsBySlot = shapeTopItemsBySlot(meta.itemUsage);

  // affixModsBySlot: group IAffixModRow[] by slot
  const bySlot: Partial<Record<Slot, AffixMod[]>> = {};
  for (const slot of SLOTS) {
    bySlot[slot] = [];
  }

  for (const row of meta.affixMods) {
    const slot = row.slot as Slot;
    if (!bySlot[slot]) continue;
    // displayLabel: try to clean up modKey (strip the | suffix used for skill-tab keys)
    const displayLabel = row.modKey.includes("|")
      ? row.modKey.split("|")[1] ?? row.modKey
      : row.modKey;

    bySlot[slot]!.push({
      modName: row.modKey,
      displayLabel,
      category: "",
      count: row.numOccurrences,
      pct: row.pct,
      medianValue: row.median,
      p75Value: row.p75,
    });
  }

  // Sort each slot descending by pct (most common first)
  for (const slot of SLOTS) {
    bySlot[slot]!.sort((a, b) => b.pct - a.pct);
  }

  const affixModsBySlot = bySlot as AffixModsBySlot;

  const poolMercType = meta.mercTypeUsage?.[0]?.mercType ?? null;

  return { topItemsBySlot, affixModsBySlot, poolMercType };
}

// Convenience: build GuideSlice then diff in one call.
export type { GuideSlice };
