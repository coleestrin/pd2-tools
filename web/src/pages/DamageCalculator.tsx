import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Flex,
  Group,
  rem,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconBug, IconCalculator } from "@tabler/icons-react";
import { charactersAPI } from "../api";
import { DamageCalculatorSection } from "../components/character";
import {
  DAMAGE_CALCULATOR_PAYLOAD_VERSION,
  GAME_MODES,
  type GameMode,
} from "../types";

function getGameMode(value: string | null): GameMode {
  return value === GAME_MODES.HARDCORE
    ? GAME_MODES.HARDCORE
    : GAME_MODES.SOFTCORE;
}

const BUG_REPORT_CHANNEL_URL =
  "https://discordapp.com/channels/1311407302149931128/1311407430122475580";

export default function DamageCalculator() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCharacterName = (searchParams.get("character") || "").trim();
  const queryGameMode = getGameMode(searchParams.get("mode"));

  const [characterName, setCharacterName] = useState(queryCharacterName);
  const [gameMode, setGameMode] = useState<GameMode>(queryGameMode);

  useEffect(() => {
    if (!searchParams.has("season")) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("season");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setCharacterName(queryCharacterName);
    setGameMode(queryGameMode);
  }, [queryCharacterName, queryGameMode]);

  const characterQuery = useQuery({
    queryKey: [
      "damage-calculator-character",
      DAMAGE_CALCULATOR_PAYLOAD_VERSION,
      queryCharacterName,
      queryGameMode,
    ],
    queryFn: () =>
      charactersAPI.getCharacter(queryCharacterName, queryGameMode),
    enabled: queryCharacterName.length > 0,
    staleTime: 0,
    retry: false,
  });

  const characterPageUrl = useMemo(() => {
    if (!characterQuery.data?.character?.name) {
      return null;
    }

    const loadedMode = characterQuery.data.character.status?.is_hardcore
      ? GAME_MODES.HARDCORE
      : GAME_MODES.SOFTCORE;
    const params = new URLSearchParams();

    if (loadedMode !== GAME_MODES.SOFTCORE) {
      params.set("gameMode", loadedMode);
    }

    const queryString = params.toString();
    const path = `/builds/character/${encodeURIComponent(
      characterQuery.data.character.name
    )}`;

    return queryString ? `${path}?${queryString}` : path;
  }, [characterQuery.data]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = characterName.trim();
    if (!trimmedName) {
      return;
    }

    const nextParams = new URLSearchParams({ character: trimmedName });

    if (gameMode !== GAME_MODES.SOFTCORE) {
      nextParams.set("mode", gameMode);
    }

    setSearchParams(nextParams);
  };

  const loadedCharacter = characterQuery.data?.character;
  const isLoadingCharacter =
    queryCharacterName.length > 0 && characterQuery.isPending;

  return (
    <>
      <Helmet>
        <title>Damage Calculator - pd2.tools</title>
        <meta
          name="description"
          content="Calculate Project Diablo 2 character damage components and combined instant or over-time totals using equipment, skills, stats, auras, mercenary auras, and transformations."
        />
      </Helmet>

      <Container size={rem(1180)} px={{ base: "md", sm: "xl" }} mb="xl">
        <Stack gap="lg">
          <Card withBorder radius="lg" p="lg">
            <Stack gap="md">
              <Flex
                justify="space-between"
                align={{ base: "stretch", sm: "flex-start" }}
                direction={{ base: "column", sm: "row" }}
                gap="md"
              >
                <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs">
                    <IconCalculator size={28} />
                    <Title order={1}>Damage Calculator</Title>
                  </Group>
                  <Text c="dimmed" maw={760}>
                    Load a tracked character and compare modeled damage
                    components, instant totals, and over-time totals across
                    weapons, attack skills, player auras, mercenary auras, and
                    transformations.
                  </Text>
                  {loadedCharacter ? (
                    <Group gap="xs">
                      <Badge variant="light">
                        {loadedCharacter.class.name}
                      </Badge>
                      <Badge variant="light">
                        Level {loadedCharacter.level}
                      </Badge>
                      <Badge variant="light">
                        {loadedCharacter.status?.is_hardcore ? "HC" : "SC"}
                      </Badge>
                      {loadedCharacter.season ? (
                        <Badge variant="light">
                          Season {loadedCharacter.season}
                        </Badge>
                      ) : null}
                    </Group>
                  ) : null}
                </Stack>
                <Button
                  component="a"
                  href={BUG_REPORT_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconBug size={18} />}
                  styles={{
                    root: {
                      flexShrink: 0,
                      backgroundColor: "rgba(121, 80, 242, 0.16)",
                      border: `${rem(1)} solid rgba(177, 151, 252, 0.42)`,
                      color: "#d0bfff",
                      "&:hover": {
                        backgroundColor: "rgba(121, 80, 242, 0.24)",
                      },
                    },
                  }}
                >
                  Make a #bug-report
                </Button>
              </Flex>

              <form onSubmit={handleSubmit}>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                  <TextInput
                    label="Character"
                    placeholder="Character name"
                    value={characterName}
                    onChange={(event) =>
                      setCharacterName(event.currentTarget.value)
                    }
                  />
                  <Select
                    label="Mode"
                    value={gameMode}
                    onChange={(value) => setGameMode(getGameMode(value))}
                    data={[
                      { value: GAME_MODES.SOFTCORE, label: "Softcore" },
                      { value: GAME_MODES.HARDCORE, label: "Hardcore" },
                    ]}
                    allowDeselect={false}
                  />
                  <Button
                    type="submit"
                    mt={{ base: 0, md: 24 }}
                    leftSection={<IconCalculator size={18} />}
                    disabled={!characterName.trim()}
                  >
                    Load Character
                  </Button>
                </SimpleGrid>
              </form>

              {characterPageUrl ? (
                <Text size="sm" c="dimmed">
                  Viewing {loadedCharacter?.name}.{" "}
                  <Anchor
                    href={characterPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open character page
                  </Anchor>
                </Text>
              ) : null}
            </Stack>
          </Card>

          {!queryCharacterName ? (
            <Alert icon={<IconAlertCircle size={18} />} variant="light">
              Enter a character name to load its current equipment, skills,
              stats, mercenary, and modeled damage profiles.
            </Alert>
          ) : isLoadingCharacter ? (
            <Skeleton height={520} radius="md" />
          ) : characterQuery.isError || !characterQuery.data ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              Character data could not be loaded. Check the character name,
              and game mode.
            </Alert>
          ) : !loadedCharacter ? (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
              This character is unavailable from the armory.
            </Alert>
          ) : (
            <DamageCalculatorSection
              damageCalculation={characterQuery.data.damageCalculation}
            />
          )}
        </Stack>
      </Container>
    </>
  );
}
