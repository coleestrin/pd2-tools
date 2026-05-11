import type { Character, Slot } from "./types";
import type { TopItemsBySlot } from "./shape/topItems";

// Minimal AffixMod / AffixModsBySlot types — defined here because
// aggregate/affixMods.ts is not ported (aggregation runs on the backend).
export type AffixMod = {
  modName: string;
  displayLabel: string;
  category: string;
  count: number;
  pct: number;
  medianValue: number;
  p75Value: number;
};

export type AffixModsBySlot = Record<Slot, AffixMod[]>;
import { slotFromRawItem } from "./slot";

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

export type SlotDiff = {
  slot: Slot;
  poolTopItemName: string | null;
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
  /** null if no merc data on either side */
  mercTypeMatchesPool: boolean | null;
  poolMercType: string | null;
  userMercType: string | null;
  slots: Record<Slot, SlotDiff>;
};

export type GuideSlice = {
  topItemsBySlot: TopItemsBySlot;
  affixModsBySlot: AffixModsBySlot;
  poolMercType: string | null;
};

export function diffCharacter(c: Character, g: GuideSlice): CharacterDiff {
  const slots = {} as Record<Slot, SlotDiff>;

  for (const slot of SLOTS) {
    // Find an equipped item in this slot
    const item = (c.items ?? []).find((it) => slotFromRawItem(it) === slot) ?? null;

    const poolTop = g.topItemsBySlot[slot]?.[0] ?? null;
    // Top 5 affix mods for this slot (may be empty for slots with no rare/magic/crafted data)
    const poolTopMods = (g.affixModsBySlot[slot] ?? []).slice(0, 5);

    // Build a set of modifier names the user actually has on this item
    const userMods = new Set((item?.modifiers ?? []).map((m) => m.name));

    // Determine display name for the user's item
    let userItemName: string | null = null;
    if (item) {
      if (item.name) {
        userItemName = item.name;
      } else if (item.is_runeword) {
        userItemName = `Runeword (${item.base?.name ?? "?"})`;
      } else {
        const quality = item.quality?.name ?? "Unknown";
        userItemName = `${quality} ${item.base?.name ?? "Item"}`;
      }
    }

    slots[slot] = {
      slot,
      poolTopItemName: poolTop?.itemName ?? null,
      userItemName,
      userItemQuality: item?.quality?.name ?? null,
      userMatchesPoolTop:
        !!poolTop && !!userItemName && userItemName === poolTop.itemName,
      poolTopAffixMods: poolTopMods.map((m) => ({
        modName: m.modName,
        displayLabel: m.displayLabel,
        pct: m.pct,
        userHas: userMods.has(m.modName),
      })),
    };
  }

  // Mercenary comparison. The character's merc `description` field (e.g. "Might Merc")
  // matches the MercTypeUsageRow `mercType` field (also "Might Merc"). The poolMercType
  // coming from buildSheet.mercenary.topType should be in the same format.
  const userMercType =
    (c.mercenary as { description?: string } | null)?.description ?? null;
  const poolMercType = g.poolMercType || null;

  return {
    characterName: c.character.name,
    accountName: c.accountName,
    characterLevel: c.character.level,
    className: c.character.class.name,
    mercTypeMatchesPool:
      poolMercType && userMercType ? poolMercType === userMercType : null,
    poolMercType,
    userMercType,
    slots,
  };
}

/**
 * Find a character in a sampled raw set by name. Case-insensitive match
 * against character.character.name OR character.accountName.
 */
export function findCharacterInSample(
  name: string,
  sample: Character[],
): Character | null {
  const needle = name.toLowerCase();
  return (
    sample.find(
      (c) =>
        c.character.name.toLowerCase() === needle ||
        c.accountName.toLowerCase() === needle,
    ) ?? null
  );
}

/**
 * Pull a Character out of the per-account API response.
 * The API returns `{ characters: Character[] }`.
 * Returns the first character whose character.name matches `name`
 * (case-insensitive), else the first character, else null.
 */
export function pickCharacterFromAccountResponse(
  name: string,
  response: unknown,
): Character | null {
  if (!response || typeof response !== "object") return null;
  const obj = response as Record<string, unknown>;
  if (!Array.isArray(obj.characters) || obj.characters.length === 0) return null;
  const list = obj.characters as Character[];
  const needle = name.toLowerCase();
  const exact = list.find((c) => c.character?.name?.toLowerCase() === needle);
  return exact ?? list[0];
}
