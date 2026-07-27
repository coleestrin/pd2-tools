import React, { useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  MRT_ColumnDef,
  MRT_PaginationState,
  MRT_SortingState,
  useMantineReactTable,
} from "mantine-react-table";
import { IconGrave } from "@tabler/icons-react";
import { Tooltip } from "@mantine/core";
import Cookies from "js-cookie";
import { charactersAPI } from "../../../api";
import { DEFAULT_VIEW_SEASON, LEVEL_RANGE_COOKIE_KEY } from "../../../types";
import type { FullCharacterResponse } from "../../../types";
import type { CharacterFilters } from "../../../hooks";

type ApiCharacter = FullCharacterResponse;

interface TransformedCharacterRow {
  name: string;
  level: number;
  class: string;
  dead?: boolean;
  life: number;
  mana: number;
  realSks: Array<{ skill: string; level: number; [key: string]: unknown }>;
  highestSkLevel?: number;
  rank?: number;
}

interface PlayerTableProps {
  filters: CharacterFilters;
  characters?: ApiCharacter[];
  total?: number;
}

//TODO: Refactor, proper stage mgmt
export default function PlayerTable({
  filters,
  characters: initialCharacters,
  total: initialTotal,
}: PlayerTableProps) {
  // Data state for the current page of characters
  const [characterData, setCharacterData] = useState<ApiCharacter[]>([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // For initial load of the table
  const [isRefetching, setIsRefetching] = useState(false); // For subsequent page/filter changes
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 40,
  });
  const [sorting, setSorting] = useState<MRT_SortingState>([]);

  // Effect to fetch data when pagination, sorting, or filters change
  useEffect(() => {
    const fetchCharacters = async () => {
      const activeSort = sorting[0];
      const sortBy = activeSort?.id ?? "level";
      const sortOrder = activeSort
        ? activeSort.desc
          ? "desc"
          : "asc"
        : "desc";

      // If we have initial characters and this is not a pagination/sorting request,
      // use those instead of making an API call
      if (initialCharacters && pagination.pageIndex === 0 && !sorting.length) {
        setCharacterData(initialCharacters);
        setTotalRowCount(initialTotal || 0); // Use the initial total
        setIsLoading(false);
        setIsRefetching(false);
        return;
      }

      if (!characterData.length && !isError) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }

      // Only proceed with API call if we're paginating, sorting, or don't have initial data
      if (pagination.pageIndex > 0 || sorting.length || !initialCharacters) {
        try {
          const levelRangeCookie = Cookies.get(LEVEL_RANGE_COOKIE_KEY);
          const levelRange = levelRangeCookie
            ? JSON.parse(levelRangeCookie)
            : { min: 80, max: 99 };

          const jsonResponse = await charactersAPI.getCharacters(
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
              levelRange: { min: levelRange.min, max: levelRange.max },
              season: filters.season,
              sortBy,
              sortOrder,
            },
            pagination.pageIndex + 1,
            pagination.pageSize
          ); // page is 1-indexed in API

          setCharacterData(jsonResponse.characters || []);
          // Make sure to set the total count from the API response
          setTotalRowCount(jsonResponse.total || 1000); // Use actual total from API
        } catch (error) {
          console.error("Failed to fetch characters for table:", error);
          setIsError(true);
          setCharacterData([]); // Clear data on error
          setTotalRowCount(0);
        }
      }

      setIsLoading(false);
      setIsRefetching(false);
    };

    fetchCharacters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    filters,
    initialCharacters,
    initialTotal,
  ]);

  // Transform fetched data for table display
  const tableDisplayData = useMemo<TransformedCharacterRow[]>(() => {
    if (!characterData) return [];
    return characterData.map((charResponse) => ({
      name: charResponse.character?.name || "",
      level: charResponse.character?.level || 0,
      class: charResponse.character?.class?.name || "",
      dead: (charResponse as any).lbInfo?.dead, // lbInfo is in the extended response
      life: charResponse.character?.life || 0,
      mana: charResponse.character?.mana || 0,
      realSks: (charResponse.realSkills || []) as Array<{
        skill: string;
        level: number;
        [key: string]: unknown;
      }>,
      highestSkLevel: (charResponse.realSkills?.[0] as any)?.level,
      rank: (charResponse as any).lbInfo?.rank, // If using rank
    }));
  }, [characterData]);

  const columns = useMemo<MRT_ColumnDef<TransformedCharacterRow>[]>(
    () => [
      // {
      //   accessorKey: 'rank',
      //   header: 'Rank',
      // },
      {
        accessorKey: "name",
        header: "Name",
        enableSorting: false,
        Cell: ({ row }) => (
          <div style={{ display: "flex", alignItems: "center", gap: "1px" }}>
            {row.original.name}
            {row.original.dead && ( // Check if dead is true ~~~ unused now since not pulling from leaderboard
              <Tooltip label="Character is dead">
                <IconGrave
                  strokeWidth={1}
                  color="red"
                  style={{ marginLeft: "4px" }}
                />
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        accessorKey: "level",
        header: "Level",
        enableSorting: true,
        Cell: ({ row }) => (
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            {row.original.level}
            <Tooltip label={row.original.class}>
              <img
                src={`/${row.original.class}.webp`}
                alt={row.original.class}
                style={{ width: "32px", height: "28px", marginLeft: "4px" }}
              />
            </Tooltip>
          </div>
        ),
      },
      {
        accessorKey: "life",
        header: "Life",
        enableSorting: true,
      },
      {
        accessorKey: "mana",
        header: "Mana",
        enableSorting: true,
      },
      {
        accessorKey: "highestSkLevel",
        header: "Highest Skill Level",
        enableSorting: true,
        Cell: ({ row }) => {
          // Only show top 3 skills
          const topSkills = (row.original.realSks || []).slice(0, 3);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              {row.original.highestSkLevel || "N/A"}
              {topSkills.map((sk) => (
                <Tooltip
                  key={sk.skill}
                  label={`${sk.skill} (Level ${sk.level})`}
                >
                  <img
                    src={`/icons/${sk.skill.replaceAll(" ", "_")}.png`}
                    alt={sk.skill}
                    style={{
                      width: "30px",
                      height: "30px",
                      marginLeft: "1.5px",
                    }}
                  />
                </Tooltip>
              ))}
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useMantineReactTable({
    columns,
    data: tableDisplayData,
    manualPagination: true,
    manualSorting: true,
    rowCount: totalRowCount,
    onPaginationChange: setPagination,
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    enableColumnActions: false,
    enableColumnFilters: false,
    enableSorting: true,

    state: {
      isLoading: isLoading,
      showProgressBars: isRefetching,
      pagination,
      sorting,
      showAlertBanner: isError,
    },
    initialState: {
      density: "xs",
      pagination: {
        pageIndex: 0,
        pageSize: 40,
      },
    },
    mantinePaperProps: {
      style: {
        boxShadow:
          "0 4px 16px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.25)",
      },
    },
    mantineTableProps: {
      highlightOnHover: true,
      striped: "odd",
      withColumnBorders: false,
      withRowBorders: true,
      withTableBorder: false,
    },
    mantineTableContainerProps: {
      style: {
        minHeight: "1700px",
      },
    },
    mantinePaginationProps: {
      showRowsPerPage: false,
    },
    defaultColumn: {
      maxSize: 1,
      minSize: 1,
      size: 1,
    },
    enableRowVirtualization: false,
    enableTopToolbar: false,
    enableBottomToolbar: true,
    paginationDisplayMode: "default",

    mantineTableBodyRowProps: ({ row }) => {
      // Generate unique nav ID for this search session
      const navId = Math.random().toString(36).substring(2, 10);

      // Build URL with nav ID and encoded filters
      const searchParams = new URLSearchParams();
      searchParams.set("nav", navId);
      if (filters.gameMode !== "softcore")
        searchParams.set("gameMode", filters.gameMode);
      if (filters.classFilter.length)
        searchParams.set("class", filters.classFilter.join(","));
      if (filters.itemFilter.length)
        searchParams.set("items", filters.itemFilter.join(","));
      if (filters.skillFilter.length)
        searchParams.set("skills", JSON.stringify(filters.skillFilter));
      if (filters.mercTypeFilter.length)
        searchParams.set("mercTypes", filters.mercTypeFilter.join(","));
      if (filters.mercItemFilter.length)
        searchParams.set("mercItems", filters.mercItemFilter.join(","));
      if (filters.searchQuery) searchParams.set("query", filters.searchQuery);
      if (filters.season !== DEFAULT_VIEW_SEASON)
        searchParams.set("season", filters.season.toString());

      const href = `/builds/character/${encodeURIComponent(
        row.original.name
      )}?${searchParams.toString()}`;

      return {
        component: "a",
        href,
        style: {
          cursor: "pointer",
          textDecoration: "none",
          display: "table-row",
          color: "inherit",
        },
        onClick: () => {
          // Cleanup old nav contexts (keep last 15)
          const navKeys = Object.keys(sessionStorage).filter((k) =>
            k.startsWith("characterNavContext_")
          );
          if (navKeys.length > 15) {
            navKeys
              .slice(0, navKeys.length - 15)
              .forEach((k) => sessionStorage.removeItem(k));
          }

          // Store navigation context keyed by nav ID
          const characterNames = tableDisplayData.map((c) => c.name);
          const currentIndex = characterNames.indexOf(row.original.name);
          sessionStorage.setItem(
            `characterNavContext_${navId}`,
            JSON.stringify({
              list: characterNames,
              currentIndex,
            })
          );
        },
      };
    },
    muiToolbarAlertBannerProps: isError
      ? {
          color: "error",
          children: "Error loading character data. Please try again.",
        }
      : undefined,
  });

  return <MantineReactTable table={table} />;
}
