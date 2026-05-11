/**
 * Request + response types for the /meta endpoint.
 *
 * The frontend passes a cohort filter (className + gameMode + minLevel +
 * skills) and receives all the aggregations needed to render the meta page:
 * top items per slot, skill usage, mercenary, level distribution. The shape
 * is intentionally close to what api.pd2.tools' public /stats/* endpoints
 * return, since this code path replaces those calls for our /meta page.
 */

export type GameMode = "hardcore" | "softcore";

export interface ISkillRequirement {
  /** Skill name as it appears in the Skills lookup table. */
  name: string;
  /** Base skill points (CharacterSkills.skill_level) must be >= this value. */
  minLevel: number;
}

export interface IMetaQuery {
  gameMode: GameMode;
  className: string;
  minLevel: number;
  /** Empty array allowed: returns class-only cohort. */
  skills: ISkillRequirement[];
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

export interface ILevelBucket {
  level: number;
  numOccurrences: number;
}

export interface ISkillUsageRow {
  name: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

/**
 * Classified skill-usage row: extends the simple ISkillUsageRow with
 * prereq/build breakdown. Returned by aggregateSkillUsageClassified.
 *
 * numAsBuild + numAsPrereq === numOccurrences for every row.
 * numAtTwenty <= numOccurrences (hard-points threshold subset).
 * pctBuild     = numAsBuild   / totalSample * 100
 * pct          = numOccurrences / totalSample * 100
 * pctAtTwenty  = numAtTwenty  / totalSample * 100
 */
export interface IClassifiedSkillRow {
  name: string;
  /** Characters in the cohort who have any base level >= 1. */
  numOccurrences: number;
  /** Characters where the skill counts as part of their build
   *  (base > 1, OR base = 1 and not a prereq-only unlock). */
  numAsBuild: number;
  /** Characters where the skill is 1pt and only present to
   *  unlock another skill they've actually invested in. */
  numAsPrereq: number;
  /** Characters with base_level >= 20 hard points in the skill. Matches
   *  pd2.tools/builds' `analyzeSkillUsage` threshold; cleanest "is this
   *  the build's focus skill?" signal. */
  numAtTwenty: number;
  totalSample: number;
  /** numOccurrences / totalSample * 100 */
  pct: number;
  /** numAsBuild / totalSample * 100 */
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

export interface ILevelDistribution {
  hardcore: ILevelBucket[];
  softcore: ILevelBucket[];
}

/**
 * One row in the affix-mod frequency table.
 *
 * `modKey` is an opaque bucket key: for most mods it equals the modifier
 * `name` (e.g. "item_fastercastrate"). For `item_addskill_tab` entries it
 * is suffixed with the tab name:
 *   "item_addskill_tab|Combat Skills (Paladin Only)"
 * Do not display raw; use mod-dictionary.json for displayLabel on the FE.
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
 * One row in the average-build-stats summary. Currently populated from
 * character.attributes + character.life / mana (the same totals the Stats
 * panel shows), so `modName` is one of: strength, dexterity, vitality,
 * energy, life, mana. `charsWithMod` and `pctOfChars` are kept on the
 * shape for forward-compat with a future per-mod variant.
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
  /** Classified skill usage: prereq/build breakdown per skill, sorted by pctBuild desc. */
  skillUsage: IClassifiedSkillRow[];
  mercTypeUsage: IMercTypeUsageRow[];
  mercItemUsage: IItemUsageRow[];
  levelDistribution: ILevelDistribution;
  affixMods: IAffixModRow[];
  /** Top-N most-prevalent build stats across the cohort. */
  avgStats: IAvgStatRow[];
}
