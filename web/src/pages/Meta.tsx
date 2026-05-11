import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Stack,
  Skeleton,
  Alert,
  Button,
  Text,
} from "@mantine/core";
import { Helmet } from "react-helmet";
import { ItemFrequencyTable } from "../components/meta/ItemFrequencyTable";
import { AffixFrequencyTable } from "../components/meta/AffixFrequencyTable";
import { BuildSheet } from "../components/meta/BuildSheet";
import { CharmPanel } from "../components/meta/CharmPanel";
import { DataFreshness } from "../components/meta/DataFreshness";
import { MatchBanner } from "../components/meta/MatchBanner";
import { DiffView } from "../components/meta/DiffView";
import { CollapsibleSection } from "../components/meta/CollapsibleSection";
import { AvgStatsPanel } from "../components/meta/AvgStatsPanel";
import { TopAffixAveragesPanel } from "../components/meta/TopAffixAveragesPanel";
import { useMetaData } from "../hooks/useMetaData";
import { FilterForm } from "../components/meta/FilterForm";
import {
  DEFAULT_UI_STATE,
  paramsToUiState,
  uiStateToParams,
  type UiState,
} from "../lib/url-state";

export default function Meta() {
  const [uiState, setUiState] = useState<UiState>(DEFAULT_UI_STATE);
  // Prevents rendering FilterForm with the server-side default before URL is read.
  const [hydrated, setHydrated] = useState(false);
  // Track when data was last fetched for the DataFreshness badge.
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    setUiState(paramsToUiState(new URLSearchParams(window.location.search)));
    setHydrated(true);
  }, []);

  function handleSubmit(s: UiState) {
    setUiState(s);
    const search = uiStateToParams(s).toString();
    window.history.replaceState(
      null,
      "",
      search ? "?" + search : window.location.pathname,
    );
  }

  const { data, isLoading, error, refetch } = useMetaData({
    gameMode: uiState.filter.gameMode,
    className: uiState.filter.className ?? "",
    minLevel: uiState.filter.minLevel ?? 80,
    skills: uiState.skills,
  });
  const noClass = !uiState.filter.className;

  // Record the fetch time whenever new data arrives.
  useEffect(() => {
    if (data) {
      setFetchedAt(new Date());
    }
  }, [data]);

  if (!hydrated) {
    return (
      <Container size="xl" py="md">
        <Title order={1} ta="center">Meta</Title>
        <Stack mt="sm">
          <Skeleton height={28} width={300} />
          <Skeleton height={20} width={200} />
          <Skeleton height={400} />
        </Stack>
      </Container>
    );
  }

  const activeClassName = uiState.filter.className ?? "Paladin";

  return (
    <Container size="xl" py="md">
      <Helmet>
        <title>Meta - pd2.tools</title>
        <meta
          name="description"
          content="Build aggregator: top gear, affixes, and charms used by Project Diablo 2 ladder players for a given class and skills."
        />
      </Helmet>
      <Title order={1} ta="center" mb="sm">
        Meta
      </Title>

      <FilterForm initial={uiState} onSubmit={handleSubmit} />

      {noClass && (
        <Alert color="blue" variant="light" mt="md" maw={1050} mx="auto" ta="center">
          Pick a class and a build, then hit Generate to see the current meta snapshot.
        </Alert>
      )}
      {!noClass && isLoading && (
        <Stack mt="md">
          <Skeleton height={28} width={300} />
          <Skeleton height={20} width={200} />
          <Skeleton height={400} />
        </Stack>
      )}
      {error && !isLoading && (
        <Alert color="red" title="Failed to load build data" mt="md">
          <Stack gap="xs">
            <Text size="sm">{error.message}</Text>
            <Button size="xs" variant="light" onClick={() => refetch()}>
              Retry
            </Button>
          </Stack>
        </Alert>
      )}
      {data && uiState.mode === "diff" && uiState.diffName ? (
        <DiffView
          characterName={uiState.diffName}
          meta={data}
          className={activeClassName}
          gameMode={uiState.filter.gameMode}
        />
      ) : data && data.cohortSize === 0 ? (
        <Alert color="yellow" title="No characters match" mt="md">
          <Text size="sm">
            No {activeClassName} characters match this filter. Try lowering the
            min level, removing skills, or switching game mode.
          </Text>
        </Alert>
      ) : data ? (
        <Stack gap="lg" mt="md">
          <MatchBanner
            cohortSize={data.cohortSize}
            className={activeClassName}
          />
          <DataFreshness
            cohortSize={data.cohortSize}
            fetchedAt={fetchedAt}
          />
          <CollapsibleSection
            title="Average build stats"
            subtitle="Cohort averages from each character's stats page"
          >
            <Stack gap="md">
              <AvgStatsPanel rows={data.avgStats} />
              <TopAffixAveragesPanel rows={data.affixMods} />
              <Text size="xs" c="dimmed" fs="italic" ta="center">
                Resistances aren't shown. Practically every end-game build
                caps at 75 all-res, so an average wouldn't tell you anything
                new.
              </Text>
            </Stack>
          </CollapsibleSection>
          <BuildSheet
            skillUsage={data.skillUsage}
            levelDistribution={data.levelDistribution}
            className={activeClassName}
          />
          <CollapsibleSection
            title="Top items"
            subtitle="Unique, Set, and Runeword items"
          >
            <ItemFrequencyTable rows={data.itemUsage} />
          </CollapsibleSection>
          <CollapsibleSection
            title="Affix patterns"
            subtitle="Rare, Magic, and Crafted items only"
          >
            <AffixFrequencyTable rows={data.affixMods} />
          </CollapsibleSection>
          <CollapsibleSection title="Charms">
            <CharmPanel />
          </CollapsibleSection>
        </Stack>
      ) : null}
    </Container>
  );
}
