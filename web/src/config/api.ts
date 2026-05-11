// API Configuration
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://api.pd2.tools/api/v1";

// API Endpoints
export const API_ENDPOINTS = {
  // Characters
  characters: "/characters",
  character: "/characters",
  characterSnapshots: "/characters", // Base path, will append /:name/snapshots
  itemUsage: "/characters/stats/item-usage",
  skillUsage: "/characters/stats/skill-usage",
  mercTypeUsage: "/characters/stats/merc-type-usage",
  mercItemUsage: "/characters/stats/merc-item-usage",
  levelDistribution: "/characters/stats/level-distribution",

  // Economy
  economyItems: "/economy/items",
  economyListings: "/economy/listings",
  economyListingsCount: "/economy/listings-count",

  // Statistics
  onlinePlayers: "/statistics/online-players",
  onlinePlayersLast: "/statistics/online-players-last",
  characterCounts: "/statistics/character-counts",

  // Home
  homeSlider: "/home/slider",

  // Health
  health: "/health",

  // Leaderboard
  leaderboardLevel99: "/leaderboard/level99",
  leaderboardMirrored: "/leaderboard/mirrored",

  // Meta
  meta: "/meta",
} as const;
