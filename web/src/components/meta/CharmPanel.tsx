import { Card, Text } from "@mantine/core";

/**
 * Placeholder for charm aggregation.
 *
 * TODO (Task 22 post-merge): Add a /api/v1/meta/charms endpoint that returns
 * per-character charm count + size patterns from CharacterItems. The PD2
 * standalone aggregates these client-side from the full character array;
 * the fork needs a backend route since it doesn't load raw character data FE-side.
 */
export function CharmPanel() {
  return (
    <Card withBorder p="md">
      <Text c="dimmed" fs="italic" size="sm">
        Charm aggregation — coming in a follow-up. The PD2 standalone shows
        common charm count / size patterns; we'll add a /api/v1/meta/charms
        endpoint to surface this.
      </Text>
    </Card>
  );
}
