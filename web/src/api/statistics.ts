import { apiClient } from "./client";
import { API_ENDPOINTS } from "../config/api";
import type {
  OnlinePlayersResponse,
  OnlinePlayersLastResponse,
  OnlinePlayersData,
} from "../types";

export const statisticsAPI = {
  /**
   * Get online players history
   */
  async getOnlinePlayersHistory(): Promise<OnlinePlayersResponse> {
    const history = await apiClient.get<OnlinePlayersData[]>(
      API_ENDPOINTS.onlinePlayers
    );
    const latest = history[history.length - 1];

    return {
      current: latest?.num_online_players || 0,
      history,
    };
  },

  /**
   * Get latest online player count
   */
  async getOnlinePlayersLast(): Promise<OnlinePlayersLastResponse> {
    return apiClient.get<OnlinePlayersLastResponse>(
      API_ENDPOINTS.onlinePlayersLast
    );
  },

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string }> {
    return apiClient.get<{ status: string }>(API_ENDPOINTS.health);
  },
};
