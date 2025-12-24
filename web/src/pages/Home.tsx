import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import {
  Card,
  Container,
  Grid,
  Group,
  Text,
  Title,
  Button,
  ThemeIcon,
  Badge,
  Stack,
  SimpleGrid,
  Skeleton,
} from "@mantine/core";
import {
  IconDownload,
  IconSearch,
  IconTrendingUp,
  IconChartBar,
  IconAlarm,
} from "@tabler/icons-react";
import CountUp from "react-countup";
import { charactersAPI, economyAPI } from "../api";
import type { HomeStats } from "../types";

const tools = [
  {
    name: "Build Viewer",
    description:
      "Filter the ladder by class, items, and skills to check the meta, see how other players gear similar builds, or find inspiration for new builds.",
    icon: <IconSearch size={28} />,
    path: "/builds",
    buttonLabel: "View Builds",
    disabled: false,
  },
  {
    name: "Economy",
    description: "Track the price and supply of items over time.",
    icon: <IconTrendingUp size={28} />,
    path: "/economy/currency",
    buttonLabel: "Track Economy",
    disabled: false,
  },
  {
    name: "Character Exporter",
    description:
      "Copy any multiplayer character to a single player save file for build testing or boss practice offline.",
    icon: <IconDownload size={28} />,
    path: "/tools/character-export",
    buttonLabel: "Export Character",
    disabled: false,
  },
  {
    name: "Corrupted Zone Tracker",
    description:
      "Track upcoming corrupted zones and get notifications for your favorite zones.",
    icon: <IconAlarm size={28} />,
    path: "/tools/corrupted-zone-tracker",
    buttonLabel: "Track Zones",
    disabled: false,
  },
  {
    name: "Statistics",
    description: "View various Project Diablo 2 statistics.",
    icon: <IconChartBar size={28} />,
    path: "/statistics",
    buttonLabel: "View Statistics",
    disabled: false,
  },
];

export default function Home() {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [charactersData, exportCount, economyItems, listingsCount] =
          await Promise.allSettled([
            charactersAPI.getCharacterCounts(),
            charactersAPI.getExportCount(),
            economyAPI.getItems(),
            economyAPI.getListingsCount(),
          ]);

        const totalCharacters =
          charactersData.status === "fulfilled"
            ? (charactersData.value.hardcore || 0) +
              (charactersData.value.softcore || 0)
            : 0;

        const totalExports =
          exportCount.status === "fulfilled" ? exportCount.value.count || 0 : 0;

        const totalEconomyItems =
          economyItems.status === "fulfilled" &&
          economyItems.value?.items &&
          Array.isArray(economyItems.value.items)
            ? economyItems.value.items.length
            : 0;

        const totalListings =
          listingsCount.status === "fulfilled"
            ? listingsCount.value.total || 0
            : 0;

        setStats({
          totalCharacters,
          totalExports,
          totalEconomyItems,
          totalListings,
        });
      } catch (err) {
        console.error("Failed to fetch home page stats:", err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <>
      <Helmet>
        <title>pd2.tools</title>
        <meta
          name="description"
          content="Find and analyze new Project Diablo 2 builds, the meta, economy, and more on pd2.tools"
        />
      </Helmet>

      <Container size="lg" py="sm" style={{ width: "100%" }}>
        <Title order={2} ta="center" mb="xs" mt="lg">
          Project Diablo 2 Tools & Stats
        </Title>
        <Text ta="center" c="dimmed" mb="lg">
          Discover builds, track item prices, export multiplayer characters, and
          more. All data is refreshed regularly using live data from the Project
          Diablo 2 API.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="lg" mb="xl">
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack align="center" gap={2}>
              <Text size="xs" c="dimmed">
                Characters Tracked
              </Text>
              {loading ? (
                <Skeleton height={28} width={80} />
              ) : (
                <Title
                  order={3}
                  style={{ height: 28, display: "flex", alignItems: "center" }}
                >
                  <CountUp
                    end={stats?.totalCharacters ?? 0}
                    duration={1}
                    separator=","
                  />
                </Title>
              )}
            </Stack>
          </Card>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack align="center" gap={2}>
              <Text size="xs" c="dimmed">
                Characters Exported
              </Text>
              {loading ? (
                <Skeleton height={28} width={80} />
              ) : (
                <Title
                  order={3}
                  style={{ height: 28, display: "flex", alignItems: "center" }}
                >
                  <CountUp
                    end={stats?.totalExports ?? 0}
                    duration={1}
                    separator=","
                  />
                </Title>
              )}
            </Stack>
          </Card>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack align="center" gap={2}>
              <Text size="xs" c="dimmed">
                Economy Items Tracked
              </Text>
              {loading ? (
                <Skeleton height={28} width={80} />
              ) : (
                <Title
                  order={3}
                  style={{ height: 28, display: "flex", alignItems: "center" }}
                >
                  <CountUp
                    end={stats?.totalEconomyItems ?? 0}
                    duration={1}
                    separator=","
                  />
                </Title>
              )}
            </Stack>
          </Card>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack align="center" gap={2}>
              <Text size="xs" c="dimmed">
                Item Listings Tracked
              </Text>
              {loading ? (
                <Skeleton height={28} width={80} />
              ) : (
                <Title
                  order={3}
                  style={{ height: 28, display: "flex", alignItems: "center" }}
                >
                  <CountUp
                    end={stats ? stats.totalListings : 0}
                    duration={1}
                    separator=","
                  />
                </Title>
              )}
            </Stack>
          </Card>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Stack align="center" gap={2}>
              <Text size="xs" c="dimmed">
                Active Tools
              </Text>
              {loading ? (
                <Skeleton height={28} width={80} />
              ) : (
                <Title
                  order={3}
                  style={{ height: 28, display: "flex", alignItems: "center" }}
                >
                  5
                </Title>
              )}
            </Stack>
          </Card>
        </SimpleGrid>

        <Title order={3} size="h2" ta="center" mb="lg" mt="sm">
          Tools
        </Title>
        <Grid gutter="xl">
          {tools.map((tool, index) => (
            <Grid.Col
              span={{ base: 12, sm: 6, md: 4, lg: 4 }}
              key={tool.name + index}
            >
              <Card
                shadow="lg"
                padding="xl"
                radius="lg"
                withBorder
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  opacity: tool.disabled ? 0.6 : 1,
                  position: "relative",
                  transition: "box-shadow 0.2s, transform 0.2s",
                  boxShadow: "0 2px 16px 0 rgba(0,0,0,0.18)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform =
                    "translateY(-4px) scale(1.03)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
              >
                {tool.disabled && (
                  <Badge
                    color="gray"
                    variant="light"
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      zIndex: 1,
                    }}
                  >
                    Soon
                  </Badge>
                )}
                <Group justify="center" mt="xs" mb="md">
                  <ThemeIcon
                    variant="gradient"
                    gradient={{ from: "indigo", to: "cyan", deg: 135 }}
                    size={70}
                    radius="xl"
                    style={{
                      boxShadow:
                        "0 0 0 4px #23243a, 0 2px 8px 0 rgba(0,0,0,0.18)",
                      marginBottom: 8,
                    }}
                  >
                    {React.cloneElement(tool.icon, { size: "2.2rem" })}
                  </ThemeIcon>
                </Group>
                <Title
                  order={4}
                  ta="center"
                  fz="lg"
                  fw={700}
                  style={{ letterSpacing: 0.5, marginBottom: 4 }}
                >
                  {tool.name}
                </Title>
                <Text
                  size="sm"
                  c="dimmed"
                  ta="center"
                  mt="sm"
                  mb="lg"
                  style={{
                    flexGrow: 1,
                    minHeight: "60px",
                    lineHeight: 1.6,
                    fontWeight: 500,
                    color: "#bfc9d1",
                  }}
                >
                  {tool.description}
                </Text>
                {tool.disabled ? (
                  <Button
                    fullWidth
                    variant="light"
                    mt="auto"
                    disabled
                    leftSection={React.cloneElement(tool.icon, {
                      size: "1rem",
                      style: { opacity: 0.5 },
                    })}
                    style={{
                      borderRadius: 8,
                      fontWeight: 600,
                      letterSpacing: 0.2,
                      marginTop: 8,
                    }}
                  >
                    {tool.disabledButtonLabel || "Coming Soon"}
                  </Button>
                ) : (
                  <Button
                    component="a"
                    href={tool.path}
                    fullWidth
                    variant="gradient"
                    gradient={{ from: "indigo", to: "cyan", deg: 135 }}
                    mt="auto"
                    leftSection={React.cloneElement(tool.icon, {
                      size: "1rem",
                    })}
                    style={{
                      borderRadius: 8,
                      fontWeight: 600,
                      letterSpacing: 0.2,
                      marginTop: 8,
                      color: "#fff",
                    }}
                  >
                    {tool.buttonLabel || `Open ${tool.name}`}
                  </Button>
                )}
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        <p
          style={{
            fontSize: "0.8em",
            color: "#6c757d",
            textAlign: "center",
            marginTop: "10px",
            paddingTop: "10px",
            paddingBottom: "10px",
          }}
        >
          pd2.tools is not affiliated with the Project Diablo 2 team.
        </p>
      </Container>
    </>
  );
}

