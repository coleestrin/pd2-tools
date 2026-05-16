import { Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import type { IAvgStatRow } from "../../types";

const CORE_STAT_LABELS: Record<string, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  vitality: "Vitality",
  energy: "Energy",
  life: "Life",
  mana: "Mana",
};

function label(modName: string): string {
  return CORE_STAT_LABELS[modName] ?? modName;
}

interface Props {
  rows: IAvgStatRow[];
}

export function AvgStatsPanel({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        No stats data for this cohort
      </Text>
    );
  }

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs">
      {rows.map((r) => (
        <Paper key={r.modName} withBorder p="sm" radius="sm">
          <Stack gap={2} align="center">
            <Text size="xs" c="dimmed" tt="uppercase" lineClamp={1}>
              {label(r.modName)}
            </Text>
            <Text
              fw={700}
              size="lg"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(r.avgValue).toLocaleString()}
            </Text>
          </Stack>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
