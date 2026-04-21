import { apiClient } from "./client";
import { API_ENDPOINTS } from "../config/api";
import { DEFAULT_VIEW_SEASON } from "../types";

export interface AccountLevel99Entry {
  account_name: string;
  count: number;
  game_mode: string;
  season: number;
  last_updated: number;
}

export interface MirroredItemEntry {
  item_name: string;
  item_base_name: string;
  count: number;
  properties_signature: string;
  example_item_json: any;
  example_character_name: string;
  game_mode: string;
  season: number;
  last_updated: number;
}

export interface AccountLevel99Response {
  leaderboard: AccountLevel99Entry[];
  gameMode: string;
  season: number;
  total: number;
}

export interface MirroredItemResponse {
  leaderboard: MirroredItemEntry[];
  gameMode: string;
  season: number;
  total: number;
}

export const leaderboardAPI = {
  /**
   * Get level 99 account leaderboard
   */
  async getLevel99Leaderboard(
    gameMode: string = "softcore",
    season: number = DEFAULT_VIEW_SEASON
  ): Promise<AccountLevel99Response> {
    return apiClient.get<AccountLevel99Response>(
      API_ENDPOINTS.leaderboardLevel99,
      {
        gameMode,
        season,
      }
    );
  },

  /**
   * Get mirrored item leaderboard
   */
  async getMirroredLeaderboard(
    gameMode: string = "softcore",
    season: number = DEFAULT_VIEW_SEASON
  ): Promise<MirroredItemResponse> {
    return apiClient.get<MirroredItemResponse>(
      API_ENDPOINTS.leaderboardMirrored,
      {
        gameMode,
        season,
      }
    );
  },
};
