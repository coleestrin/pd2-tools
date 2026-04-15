import {
  Card,
  Title,
  SegmentedControl,
  Group,
  Stack,
  Select,
  Skeleton,
  useMantineTheme,
  Badge,
  Table,
  Text,
  Tabs,
  Anchor,
  Tooltip,
  Box,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { leaderboardAPI } from "../api";
import type {
  AccountLevel99Entry,
  MirroredItemEntry,
} from "../api/leaderboard";
import { CURRENT_SEASON, SHORT_SEASON_OPTIONS } from "../types";

const getRarityColor = (item: any): string | null => {
  if (!item) return null;
  if (item.is_runeword) return "#FACC15";
  switch (item.quality?.name?.toLowerCase()) {
    case "unique":
      return "#c17d3a";
    case "set":
      return "#1eed0e";
    case "rare":
      return "#ffff00";
    case "magic":
      return "#4545ff";
    case "crafted":
      return "#ffa800";
    default:
      return null;
  }
};

const getRarityBorderColor = (item: any): string =>
  getRarityColor(item) || "#374151";

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getRarityGradient = (item: any): string => {
  const color = getRarityColor(item);
  if (!color) return "transparent";
  return `linear-gradient(to bottom, ${hexToRgba(color, 0.25)} 0%, ${hexToRgba(color, 0.08)} 20%, transparent 35%)`;
};

const ItemsWithImages = new Set([
  "Stalker's Cull",
  "Atma's Scarab",
  "Bul-Kathos' Wedding Band",
  "Crescent Moon",
  "Dwarf Star",
  "Highlord's Wrath",
  "Mara's Kaleidoscope",
  "Nature's Peace",
  "Raven Frost",
  "Saracen's Chance",
  "The Cat's Eye",
  "The Rising Sun",
  "Wisp Projector",
  "Templar's Might",
  "Lidless Wall",
  "Arachnid Mesh",
  "Dracul's Grasp",
  "Verdungo's Hearty Cord",
  "Nightwing's Veil",
  "Soul Drainer",
  "Arkaine's Valor",
  "Kira's Guardian",
  "Ormus' Robes",
  "Magefist",
  "Snowclash",
  "String of Ears",
  "Thundergod's Vigor",
  "Merman's Sprocket",
  "Veil of Steel",
  "Trang-Oul's Claws",
  "Tyrael's Might",
  "Griffon's Eye",
  "Harlequin Crest",
  "Mang Song's Lesson",
  "Waterwalk",
  "Silkweave",
  "Gravepalm",
  "Stormshield",
  "Medusa's Gaze",
  "Boneflame",
  "Occultist",
  "Frostburn",
  "Trang-Oul's Scales",
  "The Grandfather",
  "Skin of the Vipermagi",
  "Steelrend",
  "Spirit Ward",
  "Laying of Hands",
  "Crown of Ages",
  "Martyrdom",
  "Ravenlore",
  "Denmother",
  "Plague",
]);

const getItemImageUrl = (item: any): string => {
  if (!item?.base?.type_code) {
    return `https://projectdiablo2.com/image/items/inv${item?.base?.codes?.normal || item?.base?.id + (item?.graphic_id < 1 ? 1 : item?.graphic_id)}.png`;
  }
  if (item.name === "Annihilus") return "/equipment_icons/anni.png";
  if (item.name === "Hellfire Torch") return "/equipment_icons/torch.png";
  if (item.name.includes("Charm"))
    return `/equipment_icons/${item.base.type_code}.png`;
  if (item.name.includes("Gheed")) return `/equipment_icons/lcha.png`;
  if (item.name.includes("Arrows")) return `/equipment_icons/arrows.png`;
  if (item.name.includes("Bolts")) return `/equipment_icons/bolts.png`;
  if (ItemsWithImages.has(item.name))
    return `/equipment_icons/${item.name.replaceAll(" ", "_")}.png`;
  return `https://projectdiablo2.com/image/items/inv${item?.base?.codes?.normal || item?.base?.id + (item?.graphic_id < 1 ? 1 : item?.graphic_id)}.png`;
};

const ItemTooltip = ({ item }) => {
  if (!item) return null;
  return (
    <div
      style={{
        fontSize: "15px",
        background: getRarityGradient(item),
        padding: "12px",
        borderRadius: "4px",
      }}
    >
      <div
        style={{ color: getRarityColor(item) || "#ffffff", fontWeight: "bold" }}
      >
        {item.name}
        {item.is_ethereal && " (Ethereal)"}
      </div>
      <div style={{ color: "#a0a0a0" }}>{item.base?.name}</div>
      {item.damage?.one_handed && (
        <>
          <div style={{ color: "#ffffff" }}>
            One-Hand Damage: {item.damage.one_handed.minimum}-
            {item.damage.one_handed.maximum}
          </div>
          <div
            style={{ borderBottom: "1px solid #666", margin: "4px 0" }}
          ></div>
        </>
      )}
      {item.damage?.two_handed && (
        <>
          <div style={{ color: "#ffffff" }}>
            Two-Hand Damage: {item.damage.two_handed.minimum}-
            {item.damage.two_handed.maximum}
          </div>
          <div
            style={{ borderBottom: "1px solid #666", margin: "4px 0" }}
          ></div>
        </>
      )}
      {item.modifiers?.map((mod, idx) => (
        <div
          key={idx}
          style={{
            color:
              mod.label === "Mirrored"
                ? "#89019e"
                : mod.label === "Desecrated" || mod?.desecrated
                  ? "#9c6f1b"
                  : mod.label === "Corrupted" || mod?.corrupted
                    ? "#ff0000"
                    : "#ffffff",
          }}
        >
          {mod.label === "Corrupt" ? "" : mod.label}{" "}
          {mod?.max ? (
            <span style={{ color: "#6B7280" }}>
              [{mod.min} - {mod.max}]
            </span>
          ) : (
            ""
          )}
        </div>
      ))}
      {item.socketed && !item?.is_runeword && item.socketed?.length > 0 && (
        <>
          <div
            style={{ borderBottom: "1px solid #666", margin: "4px 0" }}
          ></div>
          <div
            style={{
              color:
                item?.corruptions?.[0] === "item_numsockets"
                  ? "#ff0000"
                  : "#a0a0a0",
            }}
          >
            Socketed ({item.socketed.length}):
          </div>
          {item.socketed.map((socket, idx) => (
            <div
              key={idx}
              style={{ color: "#ffffff", paddingLeft: "8px", fontSize: "14px" }}
            >
              {socket.name}
              {socket.modifiers?.map((modifier, modIdx) => (
                <div
                  key={modIdx}
                  style={{ color: "#6B7280", fontSize: "14px" }}
                >
                  {modifier.label}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      <div style={{ marginTop: "8px", color: "#a0a0a0" }}>
        Required Level: {item.requirements?.level}
        {item.requirements?.strength > 0 && (
          <div>Required Strength: {item.requirements.strength}</div>
        )}
        {item.requirements?.dexterity > 0 && (
          <div>Required Dexterity: {item.requirements.dexterity}</div>
        )}
      </div>
    </div>
  );
};

const PodiumCard = ({
  rank,
  item,
  title,
  subtitle,
  stats,
  width = "77px",
  height = "77px",
}) => {
  const rankColors = {
    1: { bg: "#FFD700", medal: "🥇" },
    2: { bg: "#C0C0C0", medal: "🥈" },
    3: { bg: "#CD7F32", medal: "🥉" },
  };
  const color = rankColors[rank];

  return (
    <Card
      withBorder
      style={{
        width: "200px",
        borderTop: `3px solid ${color.bg}`,
        transition: "transform 0.2s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.transform = "translateY(-4px)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
    >
      <Stack gap="xs" justify="flex-start">
        <div>
          <Text ta="center" size="xl">
            {color.medal}
          </Text>
          <Text ta="center" size="xs" c="dimmed" fw={700}>
            RANK {rank}
          </Text>
          {item && (
            <Tooltip
              label={<ItemTooltip item={item} />}
              multiline
              position="right"
              styles={{
                tooltip: {
                  backgroundColor: "rgba(0, 0, 0, 0.95)",
                  border: `1px solid ${getRarityBorderColor(item)}`,
                  padding: 0,
                  maxWidth: "400px",
                },
              }}
            >
              <Box
                style={{
                  margin: "8px auto",
                  width,
                  height,
                  border: `1px solid ${getRarityBorderColor(item)}`,
                  background: getRarityColor(item)
                    ? `linear-gradient(to top, ${hexToRgba(getRarityColor(item)!, 0.15)} 0%, ${hexToRgba(getRarityColor(item)!, 0.08)} 35%, transparent 70%)`
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <img
                  src={getItemImageUrl(item)}
                  alt={item.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "scale-down",
                    opacity: item.is_ethereal ? 0.375 : 1,
                  }}
                />
              </Box>
            </Tooltip>
          )}
          <Text
            ta="center"
            fw={700}
            size="sm"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              ta="center"
              size="xs"
              c="dimmed"
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </Text>
          )}
        </div>
        {stats}
      </Stack>
    </Card>
  );
};

function GenericLeaderboardTable({
  queryKey,
  queryFn,
  emptyMessage,
  renderPodium,
  renderRow,
}) {
  const { isPending, error, data } = useQuery({ queryKey, queryFn });
  if (isPending) return null;
  if (error) return <Text c="red">Error loading leaderboard</Text>;
  if (!data || data.leaderboard.length === 0)
    return <Text c="dimmed">{emptyMessage}</Text>;

  const top3 = data.leaderboard.slice(0, 3);
  const rest = data.leaderboard.slice(3);

  return (
    <Stack gap="xl">
      {top3.length > 0 && (
        <Box>
          <Text size="lg" fw={700} mb="md" ta="center">
            TOP 3
          </Text>
          <Group justify="center" align="flex-end" gap="lg">
            {top3[1] && renderPodium(top3[1], 2, top3[0])}
            {top3[0] && renderPodium(top3[0], 1, top3[0])}
            {top3[2] && renderPodium(top3[2], 3, top3[0])}
          </Group>
        </Box>
      )}
      {rest.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb="xs" ta="center">
            REST OF LEADERBOARD
          </Text>
          <Table striped highlightOnHover>
            <Table.Tbody>{rest.map(renderRow)}</Table.Tbody>
          </Table>
        </div>
      )}
    </Stack>
  );
}

function Level99LeaderboardTable({ gameMode, season }) {
  return (
    <GenericLeaderboardTable
      queryKey={["level99Leaderboard", gameMode, season]}
      queryFn={() => leaderboardAPI.getLevel99Leaderboard(gameMode, season)}
      emptyMessage="No level 99 accounts found"
      renderPodium={(entry: AccountLevel99Entry, rank) => (
        <PodiumCard
          rank={rank}
          item={null}
          title={
            <Anchor
              href={`/builds/account/${entry.account_name}`}
              target="_blank"
              size="sm"
            >
              {entry.account_name}
            </Anchor>
          }
          subtitle={null}
          stats={
            <div>
              <Text ta="center" fw={700} size="lg" c="green">
                {entry.count}
              </Text>
              <Text ta="center" size="xs" c="dimmed" mb={4}>
                Level 99 Characters
              </Text>
            </div>
          }
        />
      )}
      renderRow={(entry: AccountLevel99Entry, index) => (
        <Table.Tr key={entry.account_name}>
          <Table.Td style={{ whiteSpace: "nowrap", minWidth: "50px" }}>
            <Badge variant="light" color="blue" style={{ minWidth: "45px" }}>
              #{index + 4}
            </Badge>
          </Table.Td>
          <Table.Td>
            <Anchor
              href={`/builds/account/${entry.account_name}`}
              target="_blank"
              fw={500}
              size="sm"
            >
              {entry.account_name}
            </Anchor>
          </Table.Td>
          <Table.Td>
            <Text fw={700} c="green" size="sm">
              {entry.count}
            </Text>
          </Table.Td>
        </Table.Tr>
      )}
    />
  );
}

function MirroredItemLeaderboardTable({ gameMode, season }) {
  return (
    <GenericLeaderboardTable
      queryKey={["mirroredLeaderboard", gameMode, season]}
      queryFn={() => leaderboardAPI.getMirroredLeaderboard(gameMode, season)}
      emptyMessage="No mirrored items found"
      renderPodium={(entry: MirroredItemEntry, rank) => (
        <PodiumCard
          rank={rank}
          item={entry.example_item_json}
          title={entry.item_name}
          subtitle={entry.item_base_name}
          stats={
            <div>
              <Text ta="center" fw={700} size="lg" c="violet">
                {entry.count}
              </Text>
              <Text ta="center" size="xs" c="dimmed" mb={4}>
                Copies Found
              </Text>
              <Text ta="center" size="xs" c="dimmed" mt={4}>
                Example:{" "}
                <Anchor
                  href={`/builds/character/${entry.example_character_name}`}
                  target="_blank"
                  size="xs"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "inline",
                  }}
                >
                  {entry.example_character_name}
                </Anchor>
              </Text>
            </div>
          }
        />
      )}
      renderRow={(entry: MirroredItemEntry, index) => (
        <Table.Tr key={`${entry.properties_signature}-${index}`}>
          <Table.Td style={{ whiteSpace: "nowrap", minWidth: "50px" }}>
            <Badge variant="light" color="blue" style={{ minWidth: "45px" }}>
              #{index + 4}
            </Badge>
          </Table.Td>
          <Table.Td>
            <Tooltip
              label={<ItemTooltip item={entry.example_item_json} />}
              multiline
              position="right"
              styles={{
                tooltip: {
                  backgroundColor: "rgba(0, 0, 0, 0.95)",
                  border: `1px solid ${getRarityBorderColor(entry.example_item_json)}`,
                  padding: 0,
                  maxWidth: "400px",
                },
              }}
            >
              <div style={{ cursor: "pointer" }}>
                <Text fw={500} size="sm">
                  {entry.item_name}
                </Text>
                <Text size="xs" c="dimmed">
                  {entry.item_base_name}
                </Text>
              </div>
            </Tooltip>
          </Table.Td>
          <Table.Td>
            <Text fw={700} c="violet" size="sm">
              {entry.count} copies
            </Text>
          </Table.Td>
        </Table.Tr>
      )}
    />
  );
}

export default function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useMantineTheme();

  const [gameMode, setGameMode] = useState<"softcore" | "hardcore">(
    (searchParams.get("mode") as any) || "softcore"
  );
  const [season, setSeason] = useState<number>(
    parseInt(searchParams.get("season") || CURRENT_SEASON.toString(), 10)
  );
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<
    string | null
  >(searchParams.get("tab") || "mirrored");

  useEffect(() => {
    const params = new URLSearchParams();
    if (gameMode !== "softcore") params.set("mode", gameMode);
    if (season !== CURRENT_SEASON) params.set("season", season.toString());
    if (activeLeaderboardTab !== "mirrored")
      params.set("tab", activeLeaderboardTab || "mirrored");
    setSearchParams(params, { replace: true });
  }, [gameMode, season, activeLeaderboardTab, setSearchParams]);

  // Pre-fetch all leaderboard data to track loading state
  const { isPending: level99Loading } = useQuery({
    queryKey: ["level99Leaderboard", gameMode, season],
    queryFn: () => leaderboardAPI.getLevel99Leaderboard(gameMode, season),
    enabled: activeLeaderboardTab === "level99",
  });

  const { isPending: mirroredLoading } = useQuery({
    queryKey: ["mirroredLeaderboard", gameMode, season],
    queryFn: () => leaderboardAPI.getMirroredLeaderboard(gameMode, season),
    enabled: activeLeaderboardTab === "mirrored",
  });

  const isAnyLoading =
    (activeLeaderboardTab === "level99" && level99Loading) ||
    (activeLeaderboardTab === "mirrored" && mirroredLoading);

  const cardWidthStyles = {
    width: "95%",
    maxWidth: "900px",
    margin: "0 auto",
    [`@media (min-width: ${theme.breakpoints.sm})`]: { width: "85%" },
    [`@media (min-width: ${theme.breakpoints.lg})`]: { width: "60%" },
  };

  return (
    <>
      <Helmet>
        <title>Leaderboard - pd2.tools</title>
        <meta
          name="description"
          content="Track top players, items, and achievements across Project Diablo 2."
        />
      </Helmet>

      <Card
        withBorder
        styles={{
          root: {
            ...cardWidthStyles,
            marginTop: theme.spacing.md,
            marginBottom: theme.spacing.md,
            padding: theme.spacing.sm,
            [`@media (min-width: ${theme.breakpoints.sm})`]: {
              width: "85%",
              padding: theme.spacing.md,
            },
            [`@media (min-width: ${theme.breakpoints.lg})`]: {
              width: "60%",
              padding: theme.spacing.lg,
            },
          },
        }}
      >
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Title order={2}>Leaderboard</Title>
            <Group gap="sm">
              <Select
                data={SHORT_SEASON_OPTIONS}
                value={season.toString()}
                onChange={(value) => value && setSeason(parseInt(value, 10))}
                style={{ width: "80px" }}
                size="sm"
              />
              <SegmentedControl
                value={gameMode}
                onChange={(value) => setGameMode(value as any)}
                data={[
                  { label: "SC", value: "softcore" },
                  { label: "HC", value: "hardcore" },
                ]}
                size="sm"
              />
            </Group>
          </Group>

          {isAnyLoading ? (
            <Skeleton height={500} />
          ) : (
            <Tabs
              value={activeLeaderboardTab}
              onChange={setActiveLeaderboardTab}
            >
              <Tabs.List>
                <Tabs.Tab value="mirrored">Most Mirrored Items</Tabs.Tab>
                <Tabs.Tab value="level99">Most Level 99 Accounts</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="mirrored" pt="md">
                <MirroredItemLeaderboardTable
                  gameMode={gameMode}
                  season={season}
                />
              </Tabs.Panel>

              <Tabs.Panel value="level99" pt="md">
                <Level99LeaderboardTable gameMode={gameMode} season={season} />
              </Tabs.Panel>
            </Tabs>
          )}
        </Stack>
      </Card>
    </>
  );
}
