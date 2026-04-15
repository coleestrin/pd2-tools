import {
  Card,
  Title,
  SegmentedControl,
  Group,
  Text,
  Stack,
  Box,
  Skeleton,
  useMantineTheme,
  Select,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Line } from "recharts";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Bar, BarChart, PieChart, Pie, Cell } from "recharts";
import { statisticsAPI, charactersAPI } from "../api";
import type {
  TimeRange,
  PlayerHistoryItem,
  LevelDistributionData,
  GameMode,
} from "../types";
import { CURRENT_SEASON, SEASON_OPTIONS } from "../types";

export default function StatisticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1d");
  const [levelTab, setLevelTab] = useState<GameMode>("softcore");
  const [season, setSeason] = useState<number>(CURRENT_SEASON);

  const theme = useMantineTheme();

  const { isPending, error, data } = useQuery<PlayerHistoryItem[]>({
    queryKey: ["onlinePlayers"],
    queryFn: async () => {
      const response = await statisticsAPI.getOnlinePlayersHistory();
      return response.history;
    },
  });

  const chartData = useMemo(() => {
    if (!data) return [];

    const now = Date.now();
    const cutoffTime =
      now -
      {
        "1d": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "14d": 14 * 24 * 60 * 60 * 1000,
        "1mo": 30 * 24 * 60 * 60 * 1000,
        "3mo": 90 * 24 * 60 * 60 * 1000,
        all: Number.MAX_SAFE_INTEGER,
      }[timeRange];

    return data
      .filter((item) => item.timestamp >= cutoffTime)
      .map((item) => {
        const d = new Date(item.timestamp);
        // Format: YYYY-M-D HH:mm (no leading zero on month)
        const time = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        return {
          time,
          players: item.num_online_players,
        };
      });
  }, [data, timeRange]);

  // Calculate min/max for the selected window
  // const minMax = useMemo(() => {
  // 	if (!chartData.length) return null;
  // 	let min = chartData[0].players,
  // 		max = chartData[0].players;
  // 	for (const d of chartData) {
  // 		if (d.players < min) min = d.players;
  // 		if (d.players > max) max = d.players;
  // 	}
  // 	return { min, max };
  // }, [chartData]);

  const { data: levelData } = useQuery<LevelDistributionData>({
    queryKey: ["levelDistribution", levelTab, season],
    queryFn: () => charactersAPI.getLevelDistribution(levelTab, season),
  });

  // const totalPlayers = useMemo(() => {
  // 	if (!levelData) return 0;
  // 	return levelData[levelTab].reduce((sum, item) => sum + item.count, 0);
  // }, [levelData, levelTab]);

  const { data: characterCounts } = useQuery({
    queryKey: ["characterCounts"],
    queryFn: () => charactersAPI.getCharacterCounts(),
  });

  const pieChartData = useMemo(() => {
    if (!characterCounts) return [];
    return [
      { name: "Softcore", value: characterCounts.softcore },
      { name: "Hardcore", value: characterCounts.hardcore },
    ];
  }, [characterCounts]);

  const COLORS = [theme.colors.blue[5], theme.colors.red[5]];

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <Helmet>
        <title>Statistics - pd2.tools</title>
        <meta
          name="description"
          content="View Project Diablo 2 statistics including player count history"
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
        <Stack>
          <Title order={2}>Statistics</Title>

          <Card withBorder>
            <Stack>
              <Group justify="space-between" align="center">
                <Title order={3}>Player Count History</Title>
                <Group gap="xs">
                  <SegmentedControl
                    value={timeRange}
                    onChange={(value) => setTimeRange(value as TimeRange)}
                    data={[
                      { label: "1D", value: "1d" },
                      { label: "7D", value: "7d" },
                      { label: "14D", value: "14d" },
                      { label: "1M", value: "1mo" },
                      { label: "3M", value: "3mo" },
                      { label: "ALL", value: "all" },
                    ]}
                  />
                  {/* {minMax && (
										<Text size="xs" c="dimmed" style={{ minWidth: 120, textAlign: "right" }}>
											Min: <b>{minMax.min.toLocaleString()}</b> / Max: <b>{minMax.max.toLocaleString()}</b>
										</Text>
									)} */}
                </Group>
              </Group>

              <Skeleton visible={isPending} animate={true} height={450}>
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
                      <LineChart
                        data={chartData}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 25,
                        }}
                        isAnimationActive={false}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={theme.colors.dark[4]}
                        />
                        <XAxis
                          dataKey="time"
                          stroke={theme.colors.gray[6]}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                          // Show more ticks for longer ranges
                          interval={Math.max(
                            0,
                            Math.floor(chartData.length / 12) - 1
                          )}
                        />
                        <YAxis
                          stroke={theme.colors.gray[6]}
                          domain={["auto", "auto"]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.colors.dark[7],
                            border: `1px solid ${theme.colors.dark[4]}`,
                          }}
                          labelStyle={{ color: theme.colors.gray[5] }}
                          formatter={(value: number) => [
                            <span>
                              Player Count:{" "}
                              <span style={{ color: theme.colors.blue[5] }}>
                                {value.toLocaleString()}
                              </span>
                            </span>,
                          ]}
                          animationDuration={0}
                        />
                        <Line
                          type="monotone"
                          dataKey="players"
                          stroke={theme.colors.blue[5]}
                          strokeWidth={2}
                          dot={false}
                          name="Player Count"
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Box>
              </Skeleton>

              {error && (
                <Text c="red" ta="center">
                  Error loading player statistics
                </Text>
              )}
            </Stack>
          </Card>

          <Card withBorder>
            <Stack>
              <Group justify="space-between" align="center">
                <Title order={3}>Level Distribution</Title>
                <Group gap="xs">
                  <SegmentedControl
                    value={levelTab}
                    onChange={(value) =>
                      setLevelTab(value as "softcore" | "hardcore")
                    }
                    data={[
                      { label: "Softcore", value: "softcore" },
                      { label: "Hardcore", value: "hardcore" },
                    ]}
                  />
                  <Select
                    value={season.toString()}
                    onChange={(value) =>
                      setSeason(parseInt(value || CURRENT_SEASON.toString(), 10))
                    }
                    data={SEASON_OPTIONS}
                    w={120}
                  />
                  {/* {levelData && (
										<Text size="xs" c="dimmed" style={{ textAlign: "right", marginLeft: 0 }}>
											Total: <b>{totalPlayers.toLocaleString()}</b>
										</Text>
									)} */}
                </Group>
              </Group>

              <Skeleton visible={!levelData} animate={true} height={450}>
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
                        data={levelData?.[levelTab] || []}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 25,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={theme.colors.dark[4]}
                        />
                        <XAxis dataKey="level" stroke={theme.colors.gray[6]} />
                        <YAxis stroke={theme.colors.gray[6]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.colors.dark[7],
                            border: `1px solid ${theme.colors.dark[4]}`,
                          }}
                          labelStyle={{ color: theme.colors.gray[5] }}
                          labelFormatter={(value) => `Level ${value}`}
                          formatter={(value: number) => [
                            <span>
                              Characters:{" "}
                              <span style={{ color: theme.colors.blue[5] }}>
                                {value.toLocaleString()}
                              </span>
                            </span>,
                          ]}
                        />
                        <Bar dataKey="count" fill={theme.colors.blue[5]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Box>
              </Skeleton>
            </Stack>
          </Card>

          <Card
            withBorder
            style={{
              width: "100%",
              minWidth: 600,
            }}
          >
            <Stack>
              <Skeleton visible={false} animate={true} height={300}>
                <Title order={3}>Character Gamemode Distribution</Title>
                <Box h={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        isAnimationActive={false}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(1)}%`
                        }
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Skeleton>
            </Stack>
          </Card>
        </Stack>
      </Card>
    </div>
  );
}
