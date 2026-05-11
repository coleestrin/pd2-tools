/**
 * Request + response types for the /api/v1/meta endpoint.
 *
 * Intentionally mirrored from api/src/types/meta.ts — web/ and api/ are
 * independent npm packages with no shared types module. Keep in sync with
 * the backend's IMetaResponse / IMetaQuery / friends.
 *
 * One addition vs the backend type: IMetaQuery includes an optional `season`
 * field, matching the query param the /meta route accepts at runtime even
 * though the backend IMetaQuery type omits it.
 */

export type GameMode = "hardcore" | "softcore";

export interface ISkillRequirement {
  name: string;
  minLevel: number;
}

export interface IMetaQuery {
  gameMode: GameMode;
  className: string;
  minLevel: number;
  /** Empty array allowed — returns class-only cohort. */
  skills: ISkillRequirement[];
  season?: number;
}

export type ItemType =
  | "Unique"
  | "Set"
  | "Runeword"
  | "Rare"
  | "Magic"
  | "Crafted";

export interface IItemUsageRow {
  item: string;
  itemType: ItemType;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

export interface ISkillUsageRow {
  name: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

/**
 * Classified skill-usage row — mirrors api/src/types/meta.ts IClassifiedSkillRow.
 * numAsBuild + numAsPrereq === numOccurrences for every row.
 * numAtTwenty <= numOccurrences (hard-points threshold subset).
 */
export interface IClassifiedSkillRow {
  name: string;
  numOccurrences: number;
  numAsBuild: number;
  numAsPrereq: number;
  /** Characters with base_level >= 20 hard points in the skill —
   *  matches pd2.tools/builds' threshold. The cleanest "is this the
   *  build's focus skill?" signal. */
  numAtTwenty: number;
  totalSample: number;
  pct: number;
  pctBuild: number;
  /** numAtTwenty / totalSample * 100 */
  pctAtTwenty: number;
}

export interface IMercTypeUsageRow {
  mercType: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

export interface ILevelBucket {
  level: number;
  numOccurrences: number;
}

export interface ILevelDistribution {
  hardcore: ILevelBucket[];
  softcore: ILevelBucket[];
}

/**
 * One row in the affix-mod frequency table.
 *
 * `modKey` is an opaque bucket key — for most mods it equals the modifier
 * `name` (e.g. "item_fastercastrate"). For `item_addskill_tab` entries it
 * is suffixed with the tab name:
 *   "item_addskill_tab|Combat Skills (Paladin Only)"
 * Use mod-dictionary.json to resolve a displayLabel; fall back to modKey.
 */
export interface IAffixModRow {
  slot: string;
  modKey: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
  avg: number;
  median: number;
  p75: number;
}

/**
 * One row in the average-build-stats summary. Mirrors api/src/types/meta.ts
 * IAvgStatRow. Computed per-character (sum across equipped items + non-unique
 * charms) and averaged across the cohort with zeros included.
 */
export interface IAvgStatRow {
  modName: string;
  avgValue: number;
  charsWithMod: number;
  pctOfChars: number;
}

export interface IMetaResponse {
  cohortSize: number;
  itemUsage: IItemUsageRow[];
  /** Classified skill usage with prereq/build breakdown, sorted by pctBuild desc. */
  skillUsage: IClassifiedSkillRow[];
  mercTypeUsage: IMercTypeUsageRow[];
  mercItemUsage: IItemUsageRow[];
  levelDistribution: ILevelDistribution;
  affixMods: IAffixModRow[];
  avgStats: IAvgStatRow[];
}
