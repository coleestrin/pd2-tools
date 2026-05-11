import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Text,
  Code,
  Stack,
  Loader,
  Alert,
} from "@mantine/core";
import { Helmet } from "react-helmet";
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

  if (!hydrated) {
    return (
      <Container size="xl" py="md">
        <Title order={1}>Meta</Title>
        <Text c="dimmed">Loading…</Text>
      </Container>
    );
  }

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
      {data && (
        <Stack>
          <Text>
            Cohort size: <strong>{data.cohortSize}</strong>
          </Text>
          <Text>Top items ({data.itemUsage.length}):</Text>
          <Code block>
            {JSON.stringify(data.itemUsage.slice(0, 10), null, 2)}
          </Code>
        </Stack>
      )}
    </Container>
  );
}
