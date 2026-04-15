import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Cookies from "js-cookie";
import debounce from "lodash/debounce";
import { CURRENT_SEASON, LEVEL_RANGE_COOKIE_KEY } from "../types";

export interface SkillRequirement {
  name: string;
  minLevel: number;
}

export interface CharacterFilters {
  gameMode: string;
  classFilter: string[];
  itemFilter: string[];
  skillFilter: SkillRequirement[];
  mercTypeFilter: string[];
  mercItemFilter: string[];
  searchQuery: string;
  minLevel: number;
  maxLevel: number;
  season: number;
}

interface UseCharacterFiltersReturn {
  filters: CharacterFilters;
  updateFilters: (updates: Partial<CharacterFilters>) => void;
}

const updateUrlWithoutRerender = debounce((filters: CharacterFilters) => {
  const params = new URLSearchParams();
  if (filters.gameMode !== "softcore") params.set("gameMode", filters.gameMode);
  if (filters.classFilter.length)
    params.set("class", filters.classFilter.join(","));
  if (filters.itemFilter.length)
    params.set("items", filters.itemFilter.join(","));
  if (filters.skillFilter.length)
    params.set("skills", JSON.stringify(filters.skillFilter));
  if (filters.mercTypeFilter.length)
    params.set("mercTypes", filters.mercTypeFilter.join(","));
  if (filters.mercItemFilter.length)
    params.set("mercItems", filters.mercItemFilter.join(","));
  if (filters.searchQuery) params.set("query", filters.searchQuery);
  if (filters.season !== CURRENT_SEASON)
    params.set("season", filters.season.toString());

  const newUrl = params.toString()
    ? `?${params.toString()}`
    : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
}, 500);

export function useCharacterFilters(): UseCharacterFiltersReturn {
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState<CharacterFilters>(() => {
    const levelRangeCookie = Cookies.get(LEVEL_RANGE_COOKIE_KEY);
    const levelRange = levelRangeCookie
      ? JSON.parse(levelRangeCookie)
      : { min: 80, max: 99 };

    return {
      gameMode: searchParams.get("gameMode") || "softcore",
      classFilter: searchParams.get("class")?.split(",").filter(Boolean) || [],
      itemFilter: searchParams.get("items")?.split(",").filter(Boolean) || [],
      skillFilter: (() => {
        const skillsParam = searchParams.get("skills");
        if (skillsParam) {
          try {
            return JSON.parse(decodeURIComponent(skillsParam));
          } catch {
            return [];
          }
        }
        return [];
      })(),
      mercTypeFilter:
        searchParams.get("mercTypes")?.split(",").filter(Boolean) || [],
      mercItemFilter:
        searchParams.get("mercItems")?.split(",").filter(Boolean) || [],
      searchQuery: searchParams.get("query") || "",
      minLevel: parseInt(
        searchParams.get("minLevel") || levelRange.min.toString()
      ),
      maxLevel: parseInt(
        searchParams.get("maxLevel") || levelRange.max.toString()
      ),
      season: parseInt(
        searchParams.get("season") || CURRENT_SEASON.toString(),
        10
      ),
    };
  });

  const updateFilters = useCallback((updates: Partial<CharacterFilters>) => {
    setFilters((prev) => {
      const newFilters = { ...prev, ...updates };

      // Only update URL if it's not just a level change
      if (!updates.minLevel && !updates.maxLevel) {
        updateUrlWithoutRerender(newFilters);
      }

      return newFilters;
    });
  }, []);

  return { filters, updateFilters };
}
