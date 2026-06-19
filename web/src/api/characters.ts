import { apiClient } from "./client";
import { API_ENDPOINTS } from "../config/api";
import { DAMAGE_CALCULATOR_PAYLOAD_VERSION } from "../types";
import type {
  FullCharacterResponse,
  CharacterFilter,
  CharacterListResponse,
  ItemUsageStats,
  SkillUsageStats,
  MercTypeStats,
  LevelDistributionData,
  CharacterCounts,
  CharacterSnapshotsResponse,
} from "../types";

export const charactersAPI = {
  /**
   * Get filtered list of characters
   */
  async getCharacters(
    gameMode: string = "softcore",
    filter: CharacterFilter = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<CharacterListResponse> {
    return apiClient.get<CharacterListResponse>(API_ENDPOINTS.characters, {
      gameMode,
      page,
      pageSize,
      classes: filter.requiredClasses?.join(","),
      items: filter.requiredItems?.join(","),
      skills:
        filter.requiredSkills && filter.requiredSkills.length > 0
          ? encodeURIComponent(JSON.stringify(filter.requiredSkills))
          : undefined,
      mercTypes: filter.requiredMercTypes?.join(","),
      mercItems: filter.requiredMercItems?.join(","),
      minLevel: filter.levelRange?.min,
      maxLevel: filter.levelRange?.max,
      season: filter.season,
    });
  },

  /**
   * Get single character by name
   */
  async getCharacter(
    name: string,
    gameMode: string = "softcore",
    season?: number
  ): Promise<FullCharacterResponse | null> {
    return apiClient.get<FullCharacterResponse | null>(
      `${API_ENDPOINTS.character}/${name}`,
      {
        gameMode,
        season,
        damageCalculatorVersion: DAMAGE_CALCULATOR_PAYLOAD_VERSION,
      }
    );
  },

  /**
   * Get all snapshots for a character
   */
  async getCharacterSnapshots(
    name: string,
    gameMode: string = "softcore",
    season?: number
  ): Promise<CharacterSnapshotsResponse> {
    return apiClient.get<CharacterSnapshotsResponse>(
      `${API_ENDPOINTS.characterSnapshots}/${name}/snapshots`,
      {
        gameMode,
        season,
      }
    );
  },

  /**
   * Get specific snapshot by ID
   */
  async getCharacterSnapshot(
    name: string,
    snapshotId: number
  ): Promise<FullCharacterResponse | null> {
    return apiClient.get<FullCharacterResponse | null>(
      `${API_ENDPOINTS.characterSnapshots}/${name}/snapshots/${snapshotId}`
    );
  },

  /**
   * Get item usage statistics
   */
  async getItemUsage(
    gameMode: string = "softcore",
    filter: CharacterFilter = {}
  ): Promise<ItemUsageStats[]> {
    return apiClient.get<ItemUsageStats[]>(API_ENDPOINTS.itemUsage, {
      gameMode,
      classes: filter.requiredClasses?.join(","),
      items: filter.requiredItems?.join(","),
      skills:
        filter.requiredSkills && filter.requiredSkills.length > 0
          ? encodeURIComponent(JSON.stringify(filter.requiredSkills))
          : undefined,
      mercTypes: filter.requiredMercTypes?.join(","),
      mercItems: filter.requiredMercItems?.join(","),
      minLevel: filter.levelRange?.min,
      maxLevel: filter.levelRange?.max,
      season: filter.season,
    });
  },

  /**
   * Get skill usage statistics
   */
  async getSkillUsage(
    gameMode: string = "softcore",
    filter: CharacterFilter = {}
  ): Promise<SkillUsageStats[]> {
    return apiClient.get<SkillUsageStats[]>(API_ENDPOINTS.skillUsage, {
      gameMode,
      classes: filter.requiredClasses?.join(","),
      items: filter.requiredItems?.join(","),
      skills:
        filter.requiredSkills && filter.requiredSkills.length > 0
          ? encodeURIComponent(JSON.stringify(filter.requiredSkills))
          : undefined,
      mercTypes: filter.requiredMercTypes?.join(","),
      mercItems: filter.requiredMercItems?.join(","),
      minLevel: filter.levelRange?.min,
      maxLevel: filter.levelRange?.max,
      season: filter.season,
    });
  },

  /**
   * Get mercenary type usage statistics
   */
  async getMercTypeUsage(
    gameMode: string = "softcore",
    filter: CharacterFilter = {}
  ): Promise<MercTypeStats[]> {
    return apiClient.get<MercTypeStats[]>(API_ENDPOINTS.mercTypeUsage, {
      gameMode,
      classes: filter.requiredClasses?.join(","),
      items: filter.requiredItems?.join(","),
      skills:
        filter.requiredSkills && filter.requiredSkills.length > 0
          ? encodeURIComponent(JSON.stringify(filter.requiredSkills))
          : undefined,
      mercTypes: filter.requiredMercTypes?.join(","),
      mercItems: filter.requiredMercItems?.join(","),
      minLevel: filter.levelRange?.min,
      maxLevel: filter.levelRange?.max,
      season: filter.season,
    });
  },

  /**
   * Get mercenary item usage statistics
   */
  async getMercItemUsage(
    gameMode: string = "softcore",
    filter: CharacterFilter = {}
  ): Promise<ItemUsageStats[]> {
    return apiClient.get<ItemUsageStats[]>(API_ENDPOINTS.mercItemUsage, {
      gameMode,
      classes: filter.requiredClasses?.join(","),
      items: filter.requiredItems?.join(","),
      skills:
        filter.requiredSkills && filter.requiredSkills.length > 0
          ? encodeURIComponent(JSON.stringify(filter.requiredSkills))
          : undefined,
      mercTypes: filter.requiredMercTypes?.join(","),
      mercItems: filter.requiredMercItems?.join(","),
      minLevel: filter.levelRange?.min,
      maxLevel: filter.levelRange?.max,
      season: filter.season,
    });
  },

  /**
   * Get level distribution
   */
  async getLevelDistribution(
    gameMode: string = "softcore",
    season?: number
  ): Promise<LevelDistributionData> {
    return apiClient.get<LevelDistributionData>(
      API_ENDPOINTS.levelDistribution,
      {
        gameMode,
        season,
      }
    );
  },

  /**
   * Get character counts (HC/SC)
   */
  async getCharacterCounts(): Promise<CharacterCounts> {
    return apiClient.get<CharacterCounts>(API_ENDPOINTS.characterCounts);
  },

  /**
   * Manually refresh character data from PD2 API
   */
  async refreshCharacter(name: string): Promise<FullCharacterResponse> {
    return apiClient.post<FullCharacterResponse>(
      `${API_ENDPOINTS.character}/${name}/refresh`
    );
  },
};
