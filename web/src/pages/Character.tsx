import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Container, Grid, Skeleton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
import { Helmet } from "react-helmet";
import { charactersAPI } from "../api";
import {
  CharacterHeader,
  DamageCalculatorSection,
  EquipmentSection,
  SkillsSection,
  StatsSection,
  LevelProgressChart,
} from "../components/character";
import {
  GAME_MODES,
  type GameMode,
  type PlayerToggle,
  type SkillsView,
} from "../types";

interface NavContext {
  list: string[];
  currentIndex: number;
}

function getGameMode(value: string | null): GameMode {
  return value === GAME_MODES.HARDCORE
    ? GAME_MODES.HARDCORE
    : GAME_MODES.SOFTCORE;
}

export default function Character() {
  const { name } = useParams<{ name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const characterName = name;
  const requestedGameMode = getGameMode(
    searchParams.get("gameMode") ?? searchParams.get("mode")
  );
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [playerToggle, setPlayerToggle] = useState<PlayerToggle>("player");
  const [skillsView, setSkillsView] = useState<SkillsView>("text");
  const [didError, setDidError] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(""); // empty string = current/live data

  useEffect(() => {
    if (!searchParams.has("season")) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("season");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Get nav ID from URL params
  const navId = searchParams.get("nav");

  // Get prev/next characters from navigation context (keyed by navId)
  const { prevCharacter, nextCharacter } = useMemo(() => {
    try {
      if (!navId) return { prevCharacter: null, nextCharacter: null };

      const ctx = sessionStorage.getItem(`characterNavContext_${navId}`);
      if (!ctx) return { prevCharacter: null, nextCharacter: null };

      const parsed: NavContext = JSON.parse(ctx);
      const currentIndex = parsed.list.indexOf(characterName || "");

      // If character not in list, try using stored index
      const idx = currentIndex !== -1 ? currentIndex : parsed.currentIndex;

      return {
        prevCharacter: idx > 0 ? parsed.list[idx - 1] : null,
        nextCharacter:
          idx < parsed.list.length - 1 ? parsed.list[idx + 1] : null,
      };
    } catch {
      return { prevCharacter: null, nextCharacter: null };
    }
  }, [characterName, navId]);

  const charQuery = useQuery({
    queryKey: ["character", characterName, requestedGameMode],
    queryFn: async () => {
      try {
        const data = await charactersAPI.getCharacter(
          characterName || "",
          requestedGameMode
        );
        if (!data) {
          setDidError(true);
        }
        return data;
      } catch (error) {
        setDidError(true);
        throw error;
      }
    },
    retry: false,
    enabled: !!characterName,
  });
  const resolvedSeason = charQuery.data?.character?.season;

  // Fetch snapshot list for dropdown
  const snapshotsListQuery = useQuery({
    queryKey: [
      "character-snapshots",
      characterName,
      requestedGameMode,
      resolvedSeason,
    ],
    queryFn: async () => {
      try {
        return await charactersAPI.getCharacterSnapshots(
          characterName || "",
          requestedGameMode,
          resolvedSeason
        );
      } catch {
        // No snapshots yet, return empty array
        return { snapshots: [], total: 0 };
      }
    },
    retry: false,
    enabled: !!characterName && resolvedSeason !== undefined,
  });

  // Fetch specific snapshot when selected
  const snapshotDataQuery = useQuery({
    queryKey: ["character-snapshot", characterName, selectedSnapshot],
    queryFn: async () => {
      if (!selectedSnapshot) return null;
      return await charactersAPI.getCharacterSnapshot(
        characterName || "",
        parseInt(selectedSnapshot, 10)
      );
    },
    retry: false,
    enabled: !!selectedSnapshot,
  });

  // Determine which data to show (current or snapshot)
  const displayData = selectedSnapshot
    ? snapshotDataQuery.data
    : charQuery.data;
  const damageCalculatorGameMode: GameMode = displayData?.character?.status
    ?.is_hardcore
    ? GAME_MODES.HARDCORE
    : GAME_MODES.SOFTCORE;
  const damageCalculatorUrl = useMemo(() => {
    if (!displayData?.character?.name) {
      return "/tools/damage-calculator";
    }

    const params = new URLSearchParams({
      character: displayData.character.name,
      mode: damageCalculatorGameMode,
    });

    return `/tools/damage-calculator?${params.toString()}`;
  }, [damageCalculatorGameMode, displayData]);

  return (
    <>
      <Helmet>
        <title>Builds - {characterName} - pd2.tools</title>
        <meta
          name="description"
          content={`View the build and complete stats of ${characterName} on Project Diablo 2`}
        />
      </Helmet>

      <Container my="md">
        {charQuery.isPending ||
        snapshotsListQuery.isPending ||
        didError ||
        !displayData ? (
          <Skeleton height="100vh">a</Skeleton>
        ) : (
          <Grid>
            <Grid.Col span={12}>
              <CharacterHeader
                characterName={displayData.character.name}
                className={displayData.character.class.name}
                level={displayData.character.level}
                lastUpdated={charQuery.data?.lastUpdated}
                isMobile={isMobile}
                prevCharacter={prevCharacter}
                nextCharacter={nextCharacter}
                accountName={charQuery.data?.accountName}
                isHardcore={charQuery.data?.character?.status?.is_hardcore}
                season={charQuery.data?.character?.season}
                snapshots={snapshotsListQuery.data?.snapshots}
                selectedSnapshot={selectedSnapshot}
                onSnapshotChange={setSelectedSnapshot}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 8 }}>
              <EquipmentSection
                playerItems={displayData?.items}
                mercenary={displayData?.mercenary}
                playerToggle={playerToggle}
                onPlayerToggleChange={setPlayerToggle}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4 }}>
              <SkillsSection
                skills={displayData.realSkills}
                hasCta={displayData.hasCta}
                skillsView={skillsView}
                onSkillsViewChange={setSkillsView}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 12 }}>
              <StatsSection
                attributes={displayData.character.attributes}
                stats={displayData.character}
                realStats={displayData.realStats}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 12 }}>
              <DamageCalculatorSection
                damageCalculation={displayData.damageCalculation}
                variant="compact"
                fullCalculatorUrl={damageCalculatorUrl}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 12 }}>
              <LevelProgressChart
                snapshots={snapshotsListQuery.data?.snapshots || []}
                currentLevel={charQuery.data?.character?.level || 0}
                currentExperience={charQuery.data?.character?.experience || 0}
                lastUpdated={charQuery.data?.lastUpdated}
              />
            </Grid.Col>
          </Grid>
        )}
      </Container>
    </>
  );
}
