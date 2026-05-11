/**
 * Type shim. The aggregator-derived lib files (shape/topItems.ts,
 * url-state.ts) import their shared domain types from "./api"; this
 * re-exports the equivalent types from types/meta.ts so the imports
 * resolve. No fetch logic lives here; src/api/meta.ts handles that.
 */

export type {
  GameMode,
  IItemUsageRow as ItemUsageRow,
  ISkillUsageRow as SkillUsageRow,
  IMercTypeUsageRow as MercTypeUsageRow,
} from "../types/meta";

export type { IItemUsageRow as MercItemUsageRow } from "../types/meta";

// Compatibility shape: the ILevelBucket schema uses `numOccurrences` while
// the imported aggregator code reads `count`. Type allows both.
export type LevelDistribution = {
  hardcore: Array<{ level: number; count: number }>;
  softcore: Array<{ level: number; count: number }>;
};

export type CommonFilter = {
  gameMode: GameMode;
  className?: string;
  minLevel?: number;
};
