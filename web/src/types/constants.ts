// Game modes
export const GAME_MODES = {
  SOFTCORE: "softcore",
  HARDCORE: "hardcore",
} as const;

export type GameMode = (typeof GAME_MODES)[keyof typeof GAME_MODES];

// Season configuration
export const CURRENT_SEASON = 13;
export const EARLIEST_SUPPORTED_SEASON = 11;
export const SUPPORTED_SEASONS = Array.from(
  { length: CURRENT_SEASON - EARLIEST_SUPPORTED_SEASON + 1 },
  (_, index) => CURRENT_SEASON - index
);
export const SEASON_OPTIONS = SUPPORTED_SEASONS.map((season) => ({
  value: season.toString(),
  label: `Season ${season}`,
}));
export const SHORT_SEASON_OPTIONS = SUPPORTED_SEASONS.map((season) => ({
  value: season.toString(),
  label: `S${season}`,
}));
export const SEASON_STORAGE_KEY_SUFFIX = `s${CURRENT_SEASON}`;

// Time ranges for statistics
export type TimeRange = "1d" | "7d" | "14d" | "1mo" | "3mo" | "all";

// Character page views
export type PlayerToggle = "player" | "merc";
export type SkillsView = "tree" | "text";

// Table sorting
export type SortOrder = "asc" | "desc";
export type SortField = "name" | "price" | "last7d" | "listed";
