import { apiClient } from "./client";
import { API_ENDPOINTS } from "../config/api";
import type { IMetaQuery, IMetaResponse } from "../types";

export const metaAPI = {
  /**
   * Fetch meta aggregations for a cohort filter.
   *
   * skills is URL-encoded JSON (matches how characters.ts serialises
   * requiredSkills) so the backend can JSON.parse(decodeURIComponent(...)).
   */
  async fetchMeta(query: IMetaQuery): Promise<IMetaResponse> {
    return apiClient.get<IMetaResponse>(API_ENDPOINTS.meta, {
      gameMode: query.gameMode,
      className: query.className,
      minLevel: query.minLevel,
      skills:
        query.skills.length > 0
          ? encodeURIComponent(JSON.stringify(query.skills))
          : undefined,
      season: query.season,
    });
  },
};
