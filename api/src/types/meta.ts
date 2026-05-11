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
  /** Empty array allowed — returns class-only cohort. */
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
 * `modKey` is an opaque bucket key — for most mods it equals the modifier
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

export interface IMetaResponse {
  cohortSize: number;
  itemUsage: IItemUsageRow[];
  skillUsage: ISkillUsageRow[];
  mercTypeUsage: IMercTypeUsageRow[];
  mercItemUsage: IItemUsageRow[];
  levelDistribution: ILevelDistribution;
  affixMods: IAffixModRow[];
}
