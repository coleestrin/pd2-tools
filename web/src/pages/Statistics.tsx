import {
  Anchor,
  Box,
  Card,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Helmet } from "react-helmet";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { charactersAPI, statisticsAPI } from "../api";
import {
  getBrightBorderColor,
  getDarkBackgroundColor,
} from "../components/builds/shared/item-colors";
import {
  ItemTooltip,
  type ItemData,
} from "../components/builds/shared/ItemHelpers";
import type {
  CharacterListResponse,
  GameMode,
  ItemUsageStats,
  LevelDistributionData,
  MercTypeStats,
  PlayerHistoryItem,
  SkillUsageStats,
  TimeRange,
} from "../types";
import { DEFAULT_VIEW_SEASON, SEASON_OPTIONS } from "../types";

type MetaRangeKey = "tracked" | "endgame" | "pinnacle";

const TIME_RANGE_OPTIONS = [
  { label: "1D", value: "1d" },
  { label: "7D", value: "7d" },
  { label: "14D", value: "14d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "ALL", value: "all" },
] as const;

const META_LEVEL_RANGES: Record<
  MetaRangeKey,
  { label: string; copy: string; min: number; max: number }
> = {
  tracked: {
    label: "80-99",
    copy: "All tracked ladder characters in the frontend sample.",
    min: 80,
    max: 99,
  },
  endgame: {
    label: "90-99",
    copy: "Established endgame characters only.",
    min: 90,
    max: 99,
  },
  pinnacle: {
    label: "95-99",
    copy: "Late ladder pushers and finished builds.",
    min: 95,
    max: 99,
  },
};

const MERC_TYPE_DISPLAY: Record<string, string> = {
  "Fire Arrow": "A1 Vigor",
  "Cold Arrow": "A1 Meditation",
  "Physical Arrow": "A1 Slow Movement",
  "Defensive Auras": "A2 Defiance",
  "Offensive Auras": "A2 Blessed Aim",
  Combat: "A2 Thorns",
  "Fire Spells": "A3 Cleansing",
  "Cold Spells": "A3 Prayer",
  "Lightning Spells": "A3 Holy Shock",
  Dark: "A4 Amplify Damage",
  Light: "A4 Sanctuary",
  "Might Merc": "A5 Might",
  Warcries: "A5 Battle Orders",
};

const META_SNAPSHOT_CLASSES = [
  "Amazon",
  "Assassin",
  "Barbarian",
  "Druid",
  "Necromancer",
  "Paladin",
  "Sorceress",
] as const;

const META_SNAPSHOT_ROW_COUNT = META_SNAPSHOT_CLASSES.length;

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0";
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function getHistoryCutoff(timeRange: TimeRange): number {
  const now = Date.now();

  switch (timeRange) {
    case "1d":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "14d":
      return now - 14 * 24 * 60 * 60 * 1000;
    case "1mo":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "3mo":
      return now - 90 * 24 * 60 * 60 * 1000;
    case "all":
    default:
      return 0;
  }
}

function formatHistoryTick(timestamp: number, timeRange: TimeRange): string {
  const date = new Date(timestamp);

  if (timeRange === "1d") {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (timeRange === "7d" || timeRange === "14d") {
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatTooltipTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function getMercTypeDisplay(rawType: string): string {
  return MERC_TYPE_DISPLAY[rawType] || rawType;
}

function getSkillIconPath(skillName: string): string {
  return `/icons/${skillName.replaceAll(" ", "_")}.png`;
}

function getMercIconPath(rawType: string): string {
  const displayName = getMercTypeDisplay(rawType);
  const parts = displayName.split(" ");
  return `/icons/${parts.slice(1).join("_")}.png`;
}

function getBuildsHref(
  gameMode: GameMode,
  season: number,
  levelRange: { min: number; max: number },
  filter:
    | { type: "class"; value: string }
    | { type: "item"; value: string }
    | { type: "skill"; value: string }
    | { type: "mercType"; value: string }
    | { type: "mercItem"; value: string }
): string {
  const params = new URLSearchParams();

  if (gameMode !== "softcore") {
    params.set("gameMode", gameMode);
  }

  if (season !== DEFAULT_VIEW_SEASON) {
    params.set("season", season.toString());
  }

  params.set("minLevel", levelRange.min.toString());
  params.set("maxLevel", levelRange.max.toString());

  switch (filter.type) {
    case "class":
      params.set("class", filter.value);
      break;
    case "item":
      params.set("items", filter.value);
      break;
    case "skill":
      params.set(
        "skills",
        JSON.stringify([{ name: filter.value, minLevel: 20 }])
      );
      break;
    case "mercType":
      params.set("mercTypes", filter.value);
      break;
    case "mercItem":
      params.set("mercItems", filter.value);
      break;
  }

  return `/builds?${params.toString()}`;
}

function SummaryStat({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <Box
      style={{
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        padding: "12px 14px",
        background: "rgba(255, 255, 255, 0.02)",
        boxShadow: `inset 0 1px 0 ${accent}18`,
      }}
    >
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={6}>
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        {note}
      </Text>
    </Box>
  );
}

function SectionPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card
      withBorder
      p="xs"
      radius="sm"
      style={{
        background: "rgba(37, 38, 43, 0.52)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.015)",
      }}
    >
      <Stack gap={6}>
        <Box>
          <Text fw={700} size="sm">
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" c="dimmed" mt={2}>
              {subtitle}
            </Text>
          ) : null}
        </Box>
        {children}
      </Stack>
    </Card>
  );
}

function RankingRow({
  icon,
  label,
  nameColor,
  percentage,
  countLabel,
  accent,
  meta,
  divider = false,
}: {
  icon?: ReactNode;
  label: string;
  nameColor?: string;
  percentage: number;
  countLabel?: string;
  accent: string;
  meta?: string;
  divider?: boolean;
}) {
  return (
    <Box
      style={{
        position: "relative",
        padding: "7px 0 8px",
        borderTop: divider ? "1px solid rgba(255, 255, 255, 0.06)" : "none",
      }}
    >
      <Group
        justify="space-between"
        align="center"
        wrap="nowrap"
        style={{ minWidth: 0 }}
      >
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          {icon ? <Box style={{ flexShrink: 0 }}>{icon}</Box> : null}
          <Box style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" c={nameColor} lineClamp={1}>
              {label}
            </Text>
            {meta ? (
              <Text size="10.5px" c="dimmed" lineClamp={1} mt={1}>
                {meta}
              </Text>
            ) : null}
          </Box>
        </Group>

        <Box style={{ flexShrink: 0, textAlign: "right" }}>
          <Text fw={700} size="sm">
            {formatPercent(percentage)}
          </Text>
          {countLabel ? (
            <Text size="10.5px" c="dimmed">
              {countLabel}
            </Text>
          ) : null}
        </Box>
      </Group>

      <div
        style={{
          height: "2px",
          marginTop: "6px",
          borderRadius: "999px",
          background: "rgba(255, 255, 255, 0.07)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.max(8, Math.min(100, percentage))}%`,
            borderRadius: "inherit",
            background: accent,
          }}
        />
      </div>
    </Box>
  );
}

export default function StatisticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [gameMode, setGameMode] = useState<GameMode>("softcore");
  const [levelSeason, setLevelSeason] = useState<number>(DEFAULT_VIEW_SEASON);
  const [metaSeason, setMetaSeason] = useState<number>(DEFAULT_VIEW_SEASON);
  const [metaRangeKey, setMetaRangeKey] = useState<MetaRangeKey>("tracked");

  const theme = useMantineTheme();
  const metaLevelRange = META_LEVEL_RANGES[metaRangeKey];
  const modeColor =
    gameMode === "softcore" ? theme.colors.blue[5] : theme.colors.red[5];

  const onlineHistoryQuery = useQuery<PlayerHistoryItem[]>({
    queryKey: ["onlinePlayers"],
    queryFn: async () => {
      const response = await statisticsAPI.getOnlinePlayersHistory();
      return response.history;
    },
  });

  const levelDistributionQuery = useQuery<LevelDistributionData>({
    queryKey: ["levelDistribution", gameMode, levelSeason],
    queryFn: () => charactersAPI.getLevelDistribution(gameMode, levelSeason),
  });

  const characterCountsQuery = useQuery({
    queryKey: ["characterCounts"],
    queryFn: () => charactersAPI.getCharacterCounts(),
  });

  const itemCatalogQuery = useQuery<Map<string, ItemData>>({
    queryKey: ["statisticsItemCatalog"],
    queryFn: async () => {
      const response = await fetch("/items.json");
      const items = (await response.json()) as ItemData[];
      return new Map(items.map((item) => [item.gearId.name, item]));
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  const metaSummaryQuery = useQuery<CharacterListResponse>({
    queryKey: [
      "statisticsMetaSummary",
      gameMode,
      metaSeason,
      metaLevelRange.min,
      metaLevelRange.max,
    ],
    queryFn: () =>
      charactersAPI.getCharacters(
        gameMode,
        {
          season: metaSeason,
          levelRange: {
            min: metaLevelRange.min,
            max: metaLevelRange.max,
          },
        },
        1,
        1
      ),
  });

  const skillUsageQuery = useQuery<SkillUsageStats[]>({
    queryKey: [
      "statisticsSkillUsage",
      gameMode,
      metaSeason,
      metaLevelRange.min,
      metaLevelRange.max,
    ],
    queryFn: () =>
      charactersAPI.getSkillUsage(gameMode, {
        season: metaSeason,
        levelRange: {
          min: metaLevelRange.min,
          max: metaLevelRange.max,
        },
      }),
  });

  const itemUsageQuery = useQuery<ItemUsageStats[]>({
    queryKey: [
      "statisticsItemUsage",
      gameMode,
      metaSeason,
      metaLevelRange.min,
      metaLevelRange.max,
    ],
    queryFn: () =>
      charactersAPI.getItemUsage(gameMode, {
        season: metaSeason,
        levelRange: {
          min: metaLevelRange.min,
          max: metaLevelRange.max,
        },
      }),
  });

  const mercTypeUsageQuery = useQuery<MercTypeStats[]>({
    queryKey: [
      "statisticsMercTypeUsage",
      gameMode,
      metaSeason,
      metaLevelRange.min,
      metaLevelRange.max,
    ],
    queryFn: () =>
      charactersAPI.getMercTypeUsage(gameMode, {
        season: metaSeason,
        levelRange: {
          min: metaLevelRange.min,
          max: metaLevelRange.max,
        },
      }),
  });

  const mercItemUsageQuery = useQuery<ItemUsageStats[]>({
    queryKey: [
      "statisticsMercItemUsage",
      gameMode,
      metaSeason,
      metaLevelRange.min,
      metaLevelRange.max,
    ],
    queryFn: () =>
      charactersAPI.getMercItemUsage(gameMode, {
        season: metaSeason,
        levelRange: {
          min: metaLevelRange.min,
          max: metaLevelRange.max,
        },
      }),
  });

  const historyWindow = useMemo(() => {
    const history = [...(onlineHistoryQuery.data || [])].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const cutoff = getHistoryCutoff(timeRange);

    return history.filter((item) => item.timestamp >= cutoff);
  }, [onlineHistoryQuery.data, timeRange]);

  const chartData = useMemo(
    () =>
      historyWindow.map((item) => ({
        label: formatHistoryTick(item.timestamp, timeRange),
        players: item.num_online_players,
        timestamp: item.timestamp,
      })),
    [historyWindow, timeRange]
  );

  const onlineSummary = useMemo(() => {
    if (!historyWindow.length) {
      return {
        current: 0,
        peak: 0,
        low: 0,
        average: 0,
        updatedAt: null as number | null,
      };
    }

    const players = historyWindow.map((item) => item.num_online_players);
    const total = players.reduce((sum, value) => sum + value, 0);
    const latest = historyWindow[historyWindow.length - 1];

    return {
      current: latest.num_online_players,
      peak: Math.max(...players),
      low: Math.min(...players),
      average: Math.round(total / players.length),
      updatedAt: latest.timestamp,
    };
  }, [historyWindow]);

  const levelDistribution = useMemo(
    () => levelDistributionQuery.data?.[gameMode] ?? [],
    [levelDistributionQuery.data, gameMode]
  );

  const levelSummary = useMemo(() => {
    if (!levelDistribution.length) {
      return {
        total: 0,
        level99Count: 0,
        averageLevel: 0,
        mostCommonLevel: null as number | null,
      };
    }

    const total = levelDistribution.reduce((sum, row) => sum + row.count, 0);
    const weightedLevels = levelDistribution.reduce(
      (sum, row) => sum + row.level * row.count,
      0
    );
    const level99Count =
      levelDistribution.find((row) => row.level === 99)?.count || 0;
    const mostCommonLevel = levelDistribution.reduce((best, row) =>
      row.count > best.count ? row : best
    ).level;

    return {
      total,
      level99Count,
      averageLevel: total ? weightedLevels / total : 0,
      mostCommonLevel,
    };
  }, [levelDistribution]);

  const pieChartData = useMemo(() => {
    if (!characterCountsQuery.data) return [];

    return [
      { name: "Softcore", value: characterCountsQuery.data.softcore },
      { name: "Hardcore", value: characterCountsQuery.data.hardcore },
    ];
  }, [characterCountsQuery.data]);

  const totalCharacterCount = useMemo(
    () =>
      (characterCountsQuery.data?.softcore || 0) +
      (characterCountsQuery.data?.hardcore || 0),
    [characterCountsQuery.data]
  );

  const softcoreShare = totalCharacterCount
    ? ((characterCountsQuery.data?.softcore || 0) / totalCharacterCount) * 100
    : 0;
  const hardcoreShare = totalCharacterCount
    ? ((characterCountsQuery.data?.hardcore || 0) / totalCharacterCount) * 100
    : 0;

  const classBreakdown = useMemo(() => {
    const total = metaSummaryQuery.data?.total || 0;
    const breakdown = metaSummaryQuery.data?.breakdown || {};

    return META_SNAPSHOT_CLASSES.map((className) => {
      const count = breakdown[className] || 0;

      return {
        className,
        count,
        pct: total ? (count / total) * 100 : 0,
        accent: modeColor,
        href: getBuildsHref(gameMode, metaSeason, metaLevelRange, {
          type: "class",
          value: className,
        }),
      };
    }).sort((a, b) => b.count - a.count);
  }, [gameMode, metaLevelRange, metaSeason, metaSummaryQuery.data, modeColor]);

  const topSkills = useMemo(
    () =>
      (skillUsageQuery.data || [])
        .filter((skill) => skill.pct > 0)
        .slice(0, META_SNAPSHOT_ROW_COUNT),
    [skillUsageQuery.data]
  );

  const topItems = useMemo(
    () =>
      (itemUsageQuery.data || [])
        .filter((item) => item.pct > 0)
        .slice(0, META_SNAPSHOT_ROW_COUNT),
    [itemUsageQuery.data]
  );

  const topMercTypes = useMemo(
    () =>
      (mercTypeUsageQuery.data || [])
        .filter((mercType) => mercType.pct > 0)
        .slice(0, META_SNAPSHOT_ROW_COUNT),
    [mercTypeUsageQuery.data]
  );

  const topMercItems = useMemo(
    () =>
      (mercItemUsageQuery.data || [])
        .filter((item) => item.pct > 0)
        .slice(0, META_SNAPSHOT_ROW_COUNT),
    [mercItemUsageQuery.data]
  );

  const metaLoading =
    metaSummaryQuery.isPending ||
    skillUsageQuery.isPending ||
    itemUsageQuery.isPending ||
    mercTypeUsageQuery.isPending ||
    mercItemUsageQuery.isPending;

  const hasMetaData =
    classBreakdown.length > 0 ||
    topSkills.length > 0 ||
    topItems.length > 0 ||
    topMercTypes.length > 0 ||
    topMercItems.length > 0;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <Helmet>
        <title>Statistics - pd2.tools</title>
        <meta
          name="description"
          content="View Project Diablo 2 statistics including player count history and tracked ladder build meta."
        />
      </Helmet>

      <Card
        withBorder
        styles={{
          root: {
            width: "95%",
            maxWidth: "1300px",
            margin: `${theme.spacing.md} auto`,
            minHeight: "600px",
            padding: theme.spacing.sm,
            [`@media (min-width: ${theme.breakpoints.sm})`]: {
              width: "90%",
              padding: theme.spacing.md,
            },
            [`@media (min-width: ${theme.breakpoints.lg})`]: {
              width: "75%",
              padding: theme.spacing.lg,
            },
          },
        }}
      >
        <Stack gap="md">
          <Box>
            <Title order={2}>Statistics</Title>
          </Box>

          <Card withBorder>
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Box>
                  <Title order={3}>Player Count History</Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Online player trend over the selected time window.
                  </Text>
                </Box>

                <SegmentedControl
                  value={timeRange}
                  onChange={(value) => setTimeRange(value as TimeRange)}
                  data={TIME_RANGE_OPTIONS}
                />
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
                <SummaryStat
                  label="Current"
                  value={formatNumber(onlineSummary.current)}
                  note={
                    onlineSummary.updatedAt
                      ? `Updated ${formatTooltipTimestamp(onlineSummary.updatedAt)}`
                      : "No recent sample"
                  }
                  accent={theme.colors.blue[5]}
                />
                <SummaryStat
                  label="Peak"
                  value={formatNumber(onlineSummary.peak)}
                  note={`Highest point in the ${timeRange.toUpperCase()} window`}
                  accent={theme.colors.cyan[5]}
                />
                <SummaryStat
                  label="Average"
                  value={formatNumber(onlineSummary.average)}
                  note="Average sampled player count"
                  accent={theme.colors.violet[5]}
                />
                <SummaryStat
                  label="Low"
                  value={formatNumber(onlineSummary.low)}
                  note="Lowest sampled player count"
                  accent={theme.colors.gray[5]}
                />
              </SimpleGrid>

              <Skeleton
                visible={onlineHistoryQuery.isPending}
                animate
                height={450}
              >
                <Box h={450}>
                  <ResponsiveContainer width="100%" height={450}>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 5, right: 24, left: 8, bottom: 25 }}
                    >
                      <defs>
                        <linearGradient
                          id="playerHistoryFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={theme.colors.blue[5]}
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="70%"
                            stopColor={theme.colors.blue[5]}
                            stopOpacity={0.08}
                          />
                          <stop
                            offset="100%"
                            stopColor={theme.colors.blue[5]}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.colors.dark[4]}
                      />
                      <XAxis
                        dataKey="label"
                        stroke={theme.colors.gray[6]}
                        angle={chartData.length > 18 ? -35 : 0}
                        textAnchor={chartData.length > 18 ? "end" : "middle"}
                        height={chartData.length > 18 ? 62 : 36}
                        tickMargin={10}
                        minTickGap={28}
                        interval={Math.max(
                          0,
                          Math.floor(chartData.length / 8) - 1
                        )}
                      />
                      <YAxis
                        stroke={theme.colors.gray[6]}
                        domain={["auto", "auto"]}
                        tickFormatter={(value: number) =>
                          value.toLocaleString()
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme.colors.dark[7],
                          border: `1px solid ${theme.colors.dark[4]}`,
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: theme.colors.gray[4] }}
                        itemStyle={{ color: theme.colors.gray[1] }}
                        labelFormatter={(_, payload) => {
                          const point = payload?.[0]?.payload as
                            | { timestamp: number }
                            | undefined;

                          return point
                            ? formatTooltipTimestamp(point.timestamp)
                            : "";
                        }}
                        formatter={(value: number) => [
                          value.toLocaleString(),
                          "Players",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="players"
                        stroke={theme.colors.blue[5]}
                        strokeWidth={2}
                        fill="url(#playerHistoryFill)"
                        activeDot={{
                          r: 4,
                          strokeWidth: 0,
                          fill: theme.colors.blue[4],
                        }}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Skeleton>

              {onlineHistoryQuery.error ? (
                <Text c="red" ta="center">
                  Error loading player statistics.
                </Text>
              ) : null}
            </Stack>
          </Card>

          <Card withBorder>
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Box>
                  <Title order={3}>Level Distribution</Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Character levels for the selected mode and season.
                  </Text>
                </Box>

                <Group gap="xs">
                  <SegmentedControl
                    value={gameMode}
                    onChange={(value) => setGameMode(value as GameMode)}
                    data={[
                      { label: "Softcore", value: "softcore" },
                      { label: "Hardcore", value: "hardcore" },
                    ]}
                  />
                  <Select
                    value={levelSeason.toString()}
                    onChange={(value) =>
                      setLevelSeason(
                        parseInt(value || DEFAULT_VIEW_SEASON.toString(), 10)
                      )
                    }
                    data={SEASON_OPTIONS}
                    w={120}
                  />
                </Group>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
                <SummaryStat
                  label="Tracked Characters"
                  value={formatNumber(levelSummary.total)}
                  note={`Season ${levelSeason} ${gameMode}`}
                  accent={modeColor}
                />
                <SummaryStat
                  label="Level 99"
                  value={formatNumber(levelSummary.level99Count)}
                  note="Characters at max level"
                  accent={theme.colors.yellow[5]}
                />
                <SummaryStat
                  label="Average Level"
                  value={levelSummary.averageLevel.toFixed(1)}
                  note="Weighted average of the sample"
                  accent={theme.colors.grape[5]}
                />
                <SummaryStat
                  label="Most Common Level"
                  value={
                    levelSummary.mostCommonLevel != null
                      ? levelSummary.mostCommonLevel.toString()
                      : "-"
                  }
                  note="Largest single level bucket"
                  accent={theme.colors.teal[5]}
                />
              </SimpleGrid>

              <Skeleton
                visible={levelDistributionQuery.isPending}
                animate
                height={450}
              >
                <Box
                  h={450}
                  style={{
                    minWidth: 0,
                    overflowX: "auto",
                    overflowY: "hidden",
                    width: "100%",
                    maxWidth: "100vw",
                  }}
                >
                  <div style={{ minWidth: 600 }}>
                    <ResponsiveContainer width="100%" height={450}>
                      <BarChart
                        data={levelDistribution}
                        margin={{ top: 5, right: 24, left: 8, bottom: 25 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={theme.colors.dark[4]}
                        />
                        <XAxis dataKey="level" stroke={theme.colors.gray[6]} />
                        <YAxis
                          stroke={theme.colors.gray[6]}
                          tickFormatter={(value: number) =>
                            value.toLocaleString()
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.colors.dark[7],
                            border: `1px solid ${theme.colors.dark[4]}`,
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: theme.colors.gray[4] }}
                          labelFormatter={(value) => `Level ${value}`}
                          formatter={(value: number) => [
                            value.toLocaleString(),
                            "Characters",
                          ]}
                        />
                        <Bar
                          dataKey="count"
                          fill={modeColor}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Box>
              </Skeleton>
            </Stack>
          </Card>

          <Card withBorder>
            <Stack gap="md">
              <Box>
                <Title order={3}>Character Gamemode Distribution</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  Overall tracked characters split between softcore and
                  hardcore.
                </Text>
              </Box>

              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                <Skeleton
                  visible={characterCountsQuery.isPending}
                  animate
                  height={300}
                >
                  <Box h={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          labelLine={{ stroke: theme.colors.gray[5] }}
                          label={({
                            name,
                            percent,
                            x,
                            y,
                            textAnchor,
                            fill,
                          }) => (
                            <text
                              x={x}
                              y={y}
                              fill={fill || theme.colors.gray[1]}
                              textAnchor={textAnchor}
                              dominantBaseline="central"
                              style={{ fontSize: "12px", fontWeight: 600 }}
                            >
                              {`${name} ${formatPercent((percent || 0) * 100)}`}
                            </text>
                          )}
                          isAnimationActive={false}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell
                              key={`${entry.name}-${index}`}
                              fill={
                                index === 0
                                  ? theme.colors.blue[5]
                                  : theme.colors.red[5]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.colors.dark[7],
                            border: `1px solid ${theme.colors.dark[4]}`,
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: theme.colors.gray[1] }}
                          itemStyle={{ color: theme.colors.gray[1] }}
                          formatter={(value: number) => {
                            const pct = totalCharacterCount
                              ? (value / totalCharacterCount) * 100
                              : 0;

                            return [
                              `${value.toLocaleString()} (${formatPercent(pct)})`,
                              "Characters",
                            ];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Skeleton>

                <Stack gap="sm">
                  <SummaryStat
                    label="Softcore"
                    value={formatNumber(characterCountsQuery.data?.softcore)}
                    note={`${formatPercent(softcoreShare)} of tracked characters`}
                    accent={theme.colors.blue[5]}
                  />
                  <SummaryStat
                    label="Hardcore"
                    value={formatNumber(characterCountsQuery.data?.hardcore)}
                    note={`${formatPercent(hardcoreShare)} of tracked characters`}
                    accent={theme.colors.red[5]}
                  />
                  <SummaryStat
                    label="Total Tracked"
                    value={formatNumber(totalCharacterCount)}
                    note="Combined characters across both modes"
                    accent={theme.colors.gray[5]}
                  />
                </Stack>
              </SimpleGrid>
            </Stack>
          </Card>

          <Card withBorder>
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={3}>Meta Snapshot</Title>

                <Group gap="xs">
                  <SegmentedControl
                    value={gameMode}
                    onChange={(value) => setGameMode(value as GameMode)}
                    data={[
                      { label: "Softcore", value: "softcore" },
                      { label: "Hardcore", value: "hardcore" },
                    ]}
                  />
                  <SegmentedControl
                    value={metaRangeKey}
                    onChange={(value) => setMetaRangeKey(value as MetaRangeKey)}
                    data={[
                      { label: "80-99", value: "tracked" },
                      { label: "90-99", value: "endgame" },
                      { label: "95-99", value: "pinnacle" },
                    ]}
                  />
                  <Select
                    value={metaSeason.toString()}
                    onChange={(value) =>
                      setMetaSeason(
                        parseInt(value || DEFAULT_VIEW_SEASON.toString(), 10)
                      )
                    }
                    data={SEASON_OPTIONS}
                    w={128}
                  />
                </Group>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
                <SummaryStat
                  label="Sample Size"
                  value={formatNumber(metaSummaryQuery.data?.total)}
                  note="Characters included in this snapshot"
                  accent={modeColor}
                />
                <SummaryStat
                  label="Top Class Share"
                  value={
                    classBreakdown[0]
                      ? formatPercent(classBreakdown[0].pct)
                      : "0.0%"
                  }
                  note={classBreakdown[0]?.className || "No class data"}
                  accent={classBreakdown[0]?.accent || modeColor}
                />
                <SummaryStat
                  label="Top Skill Share"
                  value={
                    topSkills[0] ? formatPercent(topSkills[0].pct) : "0.0%"
                  }
                  note={topSkills[0]?.name || "No skill data"}
                  accent={theme.colors.violet[5]}
                />
                <SummaryStat
                  label="Top Item Share"
                  value={topItems[0] ? formatPercent(topItems[0].pct) : "0.0%"}
                  note={topItems[0]?.item || "No item data"}
                  accent={theme.colors.orange[5]}
                />
              </SimpleGrid>

              <Skeleton visible={metaLoading} animate>
                {hasMetaData ? (
                  <SimpleGrid cols={{ base: 1, lg: 2, xl: 3 }} spacing="xs">
                    <SectionPanel title="Top Classes">
                      <Stack gap="xs">
                        {classBreakdown.map((row, index) => (
                          <Anchor
                            key={row.className}
                            href={row.href}
                            underline="never"
                            style={{ color: "inherit" }}
                          >
                            <RankingRow
                              icon={
                                <img
                                  src={`/${row.className}.webp`}
                                  alt=""
                                  aria-hidden="true"
                                  style={{
                                    width: "1.9rem",
                                    height: "1.7rem",
                                    objectFit: "contain",
                                    opacity: 0.92,
                                  }}
                                />
                              }
                              label={row.className}
                              percentage={row.pct}
                              accent={row.accent}
                              divider={index > 0}
                            />
                          </Anchor>
                        ))}
                      </Stack>
                    </SectionPanel>

                    <SectionPanel title="Top Skills">
                      <Stack gap="xs">
                        {topSkills.map((skill, index) => (
                          <Anchor
                            key={skill.name}
                            href={getBuildsHref(
                              gameMode,
                              metaSeason,
                              metaLevelRange,
                              {
                                type: "skill",
                                value: skill.name,
                              }
                            )}
                            underline="never"
                            style={{ color: "inherit" }}
                          >
                            <RankingRow
                              icon={
                                <img
                                  src={getSkillIconPath(skill.name)}
                                  alt=""
                                  aria-hidden="true"
                                  style={{
                                    width: "1.5rem",
                                    height: "1.5rem",
                                    objectFit: "contain",
                                  }}
                                />
                              }
                              label={skill.name}
                              percentage={skill.pct}
                              countLabel={`${formatNumber(skill.numOccurrences)} chars`}
                              accent={theme.colors.violet[5]}
                              divider={index > 0}
                            />
                          </Anchor>
                        ))}
                      </Stack>
                    </SectionPanel>

                    <SectionPanel title="Top Items">
                      <Stack gap="xs">
                        {topItems.map((item, index) => {
                          const itemData = itemCatalogQuery.data?.get(
                            item.item
                          );
                          const imageUrl = itemData?.imageUrl;
                          const borderColor = getBrightBorderColor(
                            item.itemType
                          );
                          const backgroundColor = getDarkBackgroundColor(
                            item.itemType
                          );

                          return (
                            <ItemTooltip
                              key={`${item.item}-${item.itemType}`}
                              itemData={itemData}
                              itemType={item.itemType}
                              itemName={item.item}
                            >
                              <Anchor
                                href={getBuildsHref(
                                  gameMode,
                                  metaSeason,
                                  metaLevelRange,
                                  {
                                    type: "item",
                                    value: item.item,
                                  }
                                )}
                                underline="never"
                                style={{ color: "inherit", display: "block" }}
                              >
                                <RankingRow
                                  icon={
                                    <Box
                                      style={{
                                        width: "1.55rem",
                                        height: "1.55rem",
                                        border: imageUrl
                                          ? `0.5px solid ${borderColor}`
                                          : "none",
                                        backgroundColor: imageUrl
                                          ? backgroundColor
                                          : "transparent",
                                        borderRadius: "3px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt=""
                                          aria-hidden="true"
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                          }}
                                        />
                                      ) : null}
                                    </Box>
                                  }
                                  label={item.item}
                                  nameColor={borderColor}
                                  percentage={item.pct}
                                  countLabel={`${formatNumber(item.numOccurrences)} equips`}
                                  accent={
                                    item.itemType === "Runeword"
                                      ? theme.colors.yellow[5]
                                      : item.itemType === "Set"
                                        ? theme.colors.green[5]
                                        : theme.colors.orange[5]
                                  }
                                  meta={item.itemType}
                                  divider={index > 0}
                                />
                              </Anchor>
                            </ItemTooltip>
                          );
                        })}
                      </Stack>
                    </SectionPanel>

                    <SectionPanel title="Mercenary Aura">
                      <Stack gap="xs">
                        {topMercTypes.map((mercType, index) => (
                          <Anchor
                            key={mercType.mercType}
                            href={getBuildsHref(
                              gameMode,
                              metaSeason,
                              metaLevelRange,
                              {
                                type: "mercType",
                                value: mercType.mercType,
                              }
                            )}
                            underline="never"
                            style={{ color: "inherit" }}
                          >
                            <RankingRow
                              icon={
                                <img
                                  src={getMercIconPath(mercType.mercType)}
                                  alt=""
                                  aria-hidden="true"
                                  style={{
                                    width: "1.5rem",
                                    height: "1.5rem",
                                    objectFit: "contain",
                                  }}
                                />
                              }
                              label={getMercTypeDisplay(mercType.mercType)}
                              percentage={mercType.pct}
                              countLabel={`${formatNumber(mercType.numOccurrences)} chars`}
                              accent={theme.colors.blue[4]}
                              meta={mercType.mercType}
                              divider={index > 0}
                            />
                          </Anchor>
                        ))}
                      </Stack>
                    </SectionPanel>

                    <SectionPanel title="Mercenary Gear">
                      <Stack gap="xs">
                        {topMercItems.map((item, index) => {
                          const itemData = itemCatalogQuery.data?.get(
                            item.item
                          );
                          const imageUrl = itemData?.imageUrl;
                          const borderColor = getBrightBorderColor(
                            item.itemType
                          );
                          const backgroundColor = getDarkBackgroundColor(
                            item.itemType
                          );

                          return (
                            <ItemTooltip
                              key={`${item.item}-${item.itemType}-merc`}
                              itemData={itemData}
                              itemType={item.itemType}
                              itemName={item.item}
                            >
                              <Anchor
                                href={getBuildsHref(
                                  gameMode,
                                  metaSeason,
                                  metaLevelRange,
                                  {
                                    type: "mercItem",
                                    value: item.item,
                                  }
                                )}
                                underline="never"
                                style={{ color: "inherit", display: "block" }}
                              >
                                <RankingRow
                                  icon={
                                    <Box
                                      style={{
                                        width: "1.55rem",
                                        height: "1.55rem",
                                        border: imageUrl
                                          ? `0.5px solid ${borderColor}`
                                          : "none",
                                        backgroundColor: imageUrl
                                          ? backgroundColor
                                          : "transparent",
                                        borderRadius: "3px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt=""
                                          aria-hidden="true"
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain",
                                          }}
                                        />
                                      ) : null}
                                    </Box>
                                  }
                                  label={item.item}
                                  nameColor={borderColor}
                                  percentage={item.pct}
                                  countLabel={`${formatNumber(item.numOccurrences)} equips`}
                                  accent={
                                    item.itemType === "Runeword"
                                      ? theme.colors.yellow[5]
                                      : item.itemType === "Set"
                                        ? theme.colors.green[5]
                                        : theme.colors.orange[5]
                                  }
                                  meta={item.itemType}
                                  divider={index > 0}
                                />
                              </Anchor>
                            </ItemTooltip>
                          );
                        })}
                      </Stack>
                    </SectionPanel>
                  </SimpleGrid>
                ) : (
                  <Text c="dimmed" ta="center">
                    No meta data is available for this sample yet.
                  </Text>
                )}
              </Skeleton>
            </Stack>
          </Card>
        </Stack>
      </Card>
    </div>
  );
}
