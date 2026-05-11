import { Container, Title, Text, Code, Stack, Loader, Alert } from "@mantine/core";
import { Helmet } from "react-helmet";
import { useMetaData } from "../hooks/useMetaData";

export default function Meta() {
  // Hardcoded filter for now — Task 15 (FilterForm) replaces this with
  // state-driven input. Softcore Hammerdin is a reliable cohort in dev.
  const { data, isLoading, error } = useMetaData({
    gameMode: "softcore",
    className: "Paladin",
    minLevel: 1,
    skills: [{ name: "Blessed Hammer", minLevel: 20 }],
  });

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
      <Text c="dimmed" mb="lg">
        Build aggregator — Task 13 checkpoint (data path wired).
      </Text>

      {isLoading && <Loader />}
      {error && (
        <Alert color="red" title="Error">
          {error.message}
        </Alert>
      )}
      {data && (
        <Stack>
          <Text>Cohort size: <strong>{data.cohortSize}</strong></Text>
          <Text>Top items ({data.itemUsage.length}):</Text>
          <Code block>{JSON.stringify(data.itemUsage.slice(0, 10), null, 2)}</Code>
        </Stack>
      )}
    </Container>
  );
}
