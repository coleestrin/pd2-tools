import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Stack,
  Loader,
  Alert,
} from "@mantine/core";
import { Helmet } from "react-helmet";
import { ItemFrequencyTable } from "../components/meta/ItemFrequencyTable";
import { AffixFrequencyTable } from "../components/meta/AffixFrequencyTable";
import { BuildSheet } from "../components/meta/BuildSheet";
import { CharmPanel } from "../components/meta/CharmPanel";
import { DataFreshness } from "../components/meta/DataFreshness";
import { MatchBanner } from "../components/meta/MatchBanner";
import { DiffView } from "../components/meta/DiffView";
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

  const { data, isLoading, error } = useMetaData({
    gameMode: uiState.filter.gameMode,
    className: uiState.filter.className ?? "Paladin",
    minLevel: uiState.filter.minLevel ?? 80,
    skills: uiState.skills,
  });

  // Record the fetch time whenever new data arrives.
  useEffect(() => {
    if (data) {
      setFetchedAt(new Date());
    }
  }, [data]);

  if (!hydrated) {
    return (
      <Container size="xl" py="md">
        <Title order={1}>Meta</Title>
        <Loader size="sm" mt="sm" />
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
      <Title order={1} mb="sm">
        Meta
      </Title>

      <FilterForm initial={uiState} onSubmit={handleSubmit} />

      {isLoading && <Loader />}
      {error && (
        <Alert color="red" title="Error">
          {error.message}
        </Alert>
      )}
      {data && uiState.mode === "diff" && uiState.diffName ? (
        <DiffView
          characterName={uiState.diffName}
          meta={data}
          className={activeClassName}
          gameMode={uiState.filter.gameMode}
        />
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
          <BuildSheet
            skillUsage={data.skillUsage}
            levelDistribution={data.levelDistribution}
          />
          <ItemFrequencyTable rows={data.itemUsage} />
          <AffixFrequencyTable rows={data.affixMods} />
          <CharmPanel />
        </Stack>
      ) : null}
    </Container>
  );
}
