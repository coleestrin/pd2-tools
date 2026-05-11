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

export interface IMetaResponse {
  cohortSize: number;
  itemUsage: IItemUsageRow[];
  skillUsage: ISkillUsageRow[];
  mercTypeUsage: IMercTypeUsageRow[];
  mercItemUsage: IItemUsageRow[];
  levelDistribution: ILevelDistribution;
}
