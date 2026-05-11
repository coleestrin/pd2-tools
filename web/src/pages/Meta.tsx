import { Container, Title, Text } from "@mantine/core";
import { Helmet } from "react-helmet";

export default function Meta() {
  return (
    <Container size="xl" py="md">
      <Helmet>
        <title>Meta — PD2 Tools</title>
        <meta
          name="description"
          content="Build aggregator: top gear, affixes, and charms used by Project Diablo 2 ladder players for a given class and skills."
        />
      </Helmet>
      <Title order={1} mb="sm">
        Meta
      </Title>
      <Text c="dimmed">Build aggregator — coming soon.</Text>
    </Container>
  );
}
