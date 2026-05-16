export type GameMode = "hardcore" | "softcore";

export interface ISkillRequirement {
  name: string;
  minLevel: number;
}

export interface IMetaQuery {
  gameMode: GameMode;
  className: string;
  minLevel: number;
  skills: ISkillRequirement[];
}

export type ItemType = "Unique" | "Set" | "Runeword";

export type Slot =
  | "helm"
  | "armor"
  | "weapon"
  | "offhand"
  | "gloves"
  | "belt"
  | "boots"
  | "amulet"
  | "ring";

export interface IItemUsageRow {
  item: string;
  itemType: ItemType;
  numOccurrences: number;
  totalSample: number;
  pct: number;
  slot: Slot | null;
}

export interface ILevelBucket {
  level: number;
  count: number;
}

export interface ISkillUsageRow {
  name: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

export interface IClassifiedSkillRow {
  name: string;
  numOccurrences: number;
  numAsBuild: number;
  numAsPrereq: number;
  numAtTwenty: number;
  totalSample: number;
  pct: number;
  pctBuild: number;
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

// modKey is either the raw mod name (e.g. "item_fastercastrate", look up
// in mod-dictionary.json) or "<name>|<label>" for the three bucketed mods:
// item_addskill_tab, item_singleskill, item_addclassskills. For piped keys
// the label after "|" is the display text directly.
export interface IAffixModRow {
  slot: Slot;
  modKey: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
  avg: number;
  median: number;
  p75: number;
}

// modName is one of: strength, dexterity, vitality, energy, life, mana.
// charsWithMod / pctOfChars are kept for a future per-mod variant.
export interface IAvgStatRow {
  modName: string;
  avgValue: number;
  charsWithMod: number;
  pctOfChars: number;
}

export interface IMetaResponse {
  cohortSize: number;
  itemUsage: IItemUsageRow[];
  skillUsage: IClassifiedSkillRow[];
  mercTypeUsage: IMercTypeUsageRow[];
  mercItemUsage: IItemUsageRow[];
  levelDistribution: ILevelDistribution;
  affixMods: IAffixModRow[];
  avgStats: IAvgStatRow[];
}
