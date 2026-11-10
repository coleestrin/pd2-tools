import { useState, useEffect, useRef } from "react";
import { charactersAPI } from "../api";
import type { CharacterFilters } from "./useCharacterFilters";
import type {
  FullCharacterResponse,
  ItemUsageStats,
  SkillUsageStats,
  MercTypeStats,
} from "../types";

export interface CharacterData {
  characters: FullCharacterResponse[];
  itemUsage: ItemUsageStats[];
  skillUsage: SkillUsageStats[];
  mercTypeUsage: MercTypeStats[];
  mercItemUsage: ItemUsageStats[];
  breakdown: Record<string, number>;
  total: number;
}

interface UseCharacterDataReturn {
  data: CharacterData | null;
  error: Error | null;
  isLoading: boolean;
}

export function useCharacterData(
  filters: CharacterFilters
): UseCharacterDataReturn {
  const [data, setData] = useState<CharacterData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const hasInitiallyFetched = useRef(false);
  const isLoading = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      //if (isLoading.current) return;

      isLoading.current = true;
      const requestId = ++requestIdRef.current;

      try {
        const [
          charactersData,
          itemsData,
          skillsData,
          mercTypesData,
          mercItemsData,
        ] = await Promise.all([
          charactersAPI.getCharacters(
            filters.gameMode,
            {
              requiredClasses: filters.classFilter,
              requiredItems: filters.itemFilter,
              requiredSkills:
                filters.skillFilter.length > 0
                  ? filters.skillFilter
                  : undefined,
              requiredMercTypes: filters.mercTypeFilter,
              requiredMercItems: filters.mercItemFilter,
              levelRange: { min: filters.minLevel, max: filters.maxLevel },
              season: filters.season,
              query: filters.searchQuery || undefined,
            },
            1,
            40
          ),
          charactersAPI.getItemUsage(filters.gameMode, {
            requiredClasses: filters.classFilter,
            levelRange: { min: filters.minLevel, max: filters.maxLevel },
            requiredItems: filters.itemFilter,
            requiredSkills:
              filters.skillFilter.length > 0 ? filters.skillFilter : undefined,
            requiredMercTypes: filters.mercTypeFilter,
            requiredMercItems: filters.mercItemFilter,
            season: filters.season,
          }),
          charactersAPI.getSkillUsage(filters.gameMode, {
            requiredClasses: filters.classFilter,
            levelRange: { min: filters.minLevel, max: filters.maxLevel },
            requiredItems: filters.itemFilter,
            requiredSkills:
              filters.skillFilter.length > 0 ? filters.skillFilter : undefined,
            requiredMercTypes: filters.mercTypeFilter,
            requiredMercItems: filters.mercItemFilter,
            season: filters.season,
          }),
          charactersAPI.getMercTypeUsage(filters.gameMode, {
            requiredClasses: filters.classFilter,
            levelRange: { min: filters.minLevel, max: filters.maxLevel },
            requiredItems: filters.itemFilter,
            requiredSkills:
              filters.skillFilter.length > 0 ? filters.skillFilter : undefined,
            requiredMercTypes: filters.mercTypeFilter,
            requiredMercItems: filters.mercItemFilter,
            season: filters.season,
          }),
          charactersAPI.getMercItemUsage(filters.gameMode, {
            requiredClasses: filters.classFilter,
            levelRange: { min: filters.minLevel, max: filters.maxLevel },
            requiredItems: filters.itemFilter,
            requiredSkills:
              filters.skillFilter.length > 0 ? filters.skillFilter : undefined,
            requiredMercTypes: filters.mercTypeFilter,
            requiredMercItems: filters.mercItemFilter,
            season: filters.season,
          }),
        ]);

        if (mounted && requestId === requestIdRef.current) {
          setData({
            characters: charactersData.characters,
            itemUsage: itemsData,
            skillUsage: skillsData,
            mercTypeUsage: mercTypesData,
            mercItemUsage: mercItemsData,
            breakdown: charactersData.breakdown,
            total: charactersData.total,
          });
          setError(null);
          hasInitiallyFetched.current = true;
        }
      } catch (err) {
        if (mounted && requestId === requestIdRef.current) {
          setError(err as Error);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          isLoading.current = false;
        }
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, [
    filters.gameMode,
    filters.classFilter,
    filters.itemFilter,
    filters.skillFilter,
    filters.mercTypeFilter,
    filters.mercItemFilter,
    filters.minLevel,
    filters.maxLevel,
    filters.season,
    filters.searchQuery,
  ]);

  return {
    data,
    error,
    isLoading: !hasInitiallyFetched.current,
  };
}
