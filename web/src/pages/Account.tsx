import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Title,
  Text,
  Stack,
  Card,
  Group,
  Skeleton,
  Tooltip,
  Badge,
  SegmentedControl,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
import { Helmet } from "react-helmet";
import { IconUser } from "@tabler/icons-react";
import RelativeTime from "@yaireo/relative-time";
import {
  DEFAULT_VIEW_SEASON,
  GAME_MODES,
  type FullCharacterResponse,
} from "../types";

const relativeTime = new RelativeTime();

function getCharacterHref(char: FullCharacterResponse) {
  const name = char.character?.name;
  if (!name) {
    return "/builds";
  }

  const params = new URLSearchParams();
  const isHardcore = char.character.status?.is_hardcore;
  const season = char.character.season;

  if (isHardcore) {
    params.set("gameMode", GAME_MODES.HARDCORE);
  }
  if (season && season !== DEFAULT_VIEW_SEASON) {
    params.set("season", String(season));
  }

  const queryString = params.toString();
  const path = `/builds/character/${encodeURIComponent(name)}`;

  return queryString ? `${path}?${queryString}` : path;
}

export default function Account() {
  const { accountName } = useParams<{ accountName: string }>();
  const [modeFilter, setModeFilter] = useState<string>("all");
  const isMobile = useMediaQuery("(max-width: 768px)");

  const accountQuery = useQuery({
    queryKey: ["account", accountName],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/characters/accounts/${accountName}`
      );
      if (!response.ok) {
        throw new Error("Account not found");
      }
      const data = await response.json();
      return data as { characters: FullCharacterResponse[]; total: number };
    },
    retry: false,
    enabled: !!accountName,
  });

  // Filter and count characters by game mode
  const { filteredCharacters, hardcoreCount, softcoreCount } = useMemo(() => {
    if (!accountQuery.data?.characters) {
      return { filteredCharacters: [], hardcoreCount: 0, softcoreCount: 0 };
    }

    const chars = accountQuery.data.characters;
    const hcCount = chars.filter(
      (c) => c.character?.status?.is_hardcore
    ).length;
    const scCount = chars.filter(
      (c) => !c.character?.status?.is_hardcore
    ).length;

    const filtered =
      modeFilter === "all"
        ? chars
        : modeFilter === "hardcore"
          ? chars.filter((c) => c.character?.status?.is_hardcore)
          : chars.filter((c) => !c.character?.status?.is_hardcore);

    return {
      filteredCharacters: filtered,
      hardcoreCount: hcCount,
      softcoreCount: scCount,
    };
  }, [accountQuery.data?.characters, modeFilter]);

  return (
    <>
      <Helmet>
        <title>Account - {accountName} - pd2.tools</title>
        <meta
          name="description"
          content={`View all characters for account ${accountName} on Project Diablo 2`}
        />
      </Helmet>

      <Container my="md">
        <Stack gap="md">
          <Group gap="sm">
            <IconUser size={32} />
            <Title order={1}>Account: {accountName}</Title>
          </Group>

          {accountQuery.isPending ? (
            <Stack gap="md">
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </Stack>
          ) : accountQuery.isError ? (
            <Card withBorder padding="lg">
              <Text c="dimmed" ta="center">
                No characters found for this account, or they haven't been
                indexed yet.
                <br />
                <br />
                Characters are only indexed if they are level 80+ and on the
                ladder.
              </Text>
            </Card>
          ) : (
            <>
              <Group justify="space-between" wrap="wrap">
                <Text c="dimmed">
                  Total characters: {accountQuery.data.total}
                </Text>
                <SegmentedControl
                  value={modeFilter}
                  onChange={setModeFilter}
                  data={[
                    { label: `All (${accountQuery.data.total})`, value: "all" },
                    { label: `Hardcore (${hardcoreCount})`, value: "hardcore" },
                    { label: `Softcore (${softcoreCount})`, value: "softcore" },
                  ]}
                />
              </Group>
              <Stack gap="md">
                {filteredCharacters.map((char) => {
                  if (!char.character) return null;

                  const topSkills = (char.realSkills || []).slice(
                    0,
                    3
                  ) as Array<{
                    skill: string;
                    level: number;
                  }>;
                  const isHardcore = char.character.status?.is_hardcore;

                  return (
                    <Card
                      key={char.character.name}
                      withBorder
                      padding="lg"
                      component="a"
                      href={getCharacterHref(char)}
                      style={{
                        cursor: "pointer",
                        textDecoration: "none",
                        color: "inherit",
                        borderWidth: "1px",
                      }}
                    >
                      <Stack gap="sm">
                        {/* Top row: Character info and badges */}
                        <Group justify="space-between" wrap="wrap">
                          <Group gap="md">
                            <img
                              src={`/${char.character.class.name}.webp`}
                              alt={char.character.class.name}
                              style={{ width: "48px", height: "42px" }}
                            />
                            <div>
                              <Group gap="xs">
                                <Text fw={500} size="lg">
                                  {char.character.name}
                                </Text>
                                {isHardcore !== undefined && (
                                  <Badge
                                    color={isHardcore ? "red" : "blue"}
                                    variant="filled"
                                    size="sm"
                                  >
                                    {isHardcore ? "HC" : "SC"}
                                  </Badge>
                                )}
                                {char.character.season && (
                                  <Badge
                                    color="grape"
                                    variant="filled"
                                    size="sm"
                                  >
                                    S{char.character.season}
                                  </Badge>
                                )}
                              </Group>
                              <Text c="dimmed" size="sm">
                                {char.character.class.name}
                              </Text>
                            </div>
                          </Group>
                          {!isMobile && char.lastUpdated && (
                            <Text size="xs" c="dimmed">
                              Updated{" "}
                              {relativeTime.from(new Date(char.lastUpdated))}
                            </Text>
                          )}
                        </Group>

                        {/* Stats row */}
                        <Group gap={isMobile ? "md" : "xl"} wrap="wrap">
                          <div>
                            <Text size="sm" c="dimmed">
                              Level
                            </Text>
                            <Text
                              fw={500}
                              c={
                                char.character.level === 99
                                  ? "green"
                                  : undefined
                              }
                            >
                              {char.character.level}
                            </Text>
                          </div>
                          <div>
                            <Text size="sm" c="dimmed">
                              Life
                            </Text>
                            <Text
                              fw={500}
                              style={{ color: "rgb(239, 78, 78)" }}
                            >
                              {char.character.life}
                            </Text>
                          </div>
                          <div>
                            <Text size="sm" c="dimmed">
                              Mana
                            </Text>
                            <Text
                              fw={500}
                              style={{ color: "rgb(36, 135, 235)" }}
                            >
                              {char.character.mana}
                            </Text>
                          </div>
                          {topSkills.length > 0 && !isMobile && (
                            <div>
                              <Text size="sm" c="dimmed">
                                Top Skills
                              </Text>
                              <Group gap="xs" mt={4}>
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
                                      }}
                                    />
                                  </Tooltip>
                                ))}
                              </Group>
                            </div>
                          )}
                        </Group>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            </>
          )}
        </Stack>
      </Container>
    </>
  );
}
