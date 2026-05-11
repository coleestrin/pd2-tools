/**
 * Type bridge for ported PD2 lib files.
 *
 * The ported files (buildSheet.ts, topItems.ts, url-state.ts) import their
 * shared domain types from "./api" (the PD2 monorepo's lib/api.ts). This
 * shim re-exports the equivalent types from the fork's own types/meta.ts so
 * those imports resolve without modification to the ported files.
 *
 * Do NOT add fetch logic here — the fork fetches via src/api/meta.ts.
 */

export type {
  GameMode,
  IItemUsageRow as ItemUsageRow,
  ISkillUsageRow as SkillUsageRow,
  IMercTypeUsageRow as MercTypeUsageRow,
} from "../types/meta";

// MercItemUsageRow is the same shape as ItemUsageRow in PD2.
export type { IItemUsageRow as MercItemUsageRow } from "../types/meta";

// LevelDistribution — the PD2 shape uses `count`, the fork uses `numOccurrences`.
// Create a compatible type so ported files compile without needing runtime changes.
// The fork's ILevelBucket uses `numOccurrences`; PD2 used `count`.
// Both the buildSheet and the shape files only read `levelDist[gameMode]`, so we
// use a union to make both shapes valid at the type level.
export type LevelDistribution = {
  hardcore: Array<{ level: number; count: number }>;
  softcore: Array<{ level: number; count: number }>;
};

// CommonFilter — used by url-state.ts
export type CommonFilter = {
  gameMode: GameMode;
  className?: string;
  minLevel?: number;
};

// Re-export GameMode separately for url-state.ts import pattern.
// (already exported above, this comment is just for clarity)
