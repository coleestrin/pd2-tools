import { Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import type { IAffixModRow } from "../../types";
import modDictionaryRaw from "../../data/mod-dictionary.json";

type ModDictEntry = { displayLabel?: string };
const DICT = modDictionaryRaw as Record<string, ModDictEntry>;

// Filtered out of the cross-slot average view. All still show in the
// per-slot Affix patterns table.
const META_FLAG_KEYS = new Set(["corrupted", "desecrated", "mirrored"]);
const RESIST_MOD_KEYS = new Set([
  "fireresist",
  "coldresist",
  "lightresist",
  "poisonresist",
  "all_resist",
  "maxfireresist",
  "maxcoldresist",
  "maxlightresist",
  "maxpoisonresist",
]);
const EXCLUDED_PREFIXES = [
  "item_singleskill",
  "item_charged_skill",
  "item_skillon",
];

function isExcluded(modKey: string): boolean {
  if (META_FLAG_KEYS.has(modKey.toLowerCase())) return true;
  if (RESIST_MOD_KEYS.has(modKey)) return true;
  return EXCLUDED_PREFIXES.some((p) => modKey.startsWith(p));
}

function resolveLabel(modKey: string): string {
  const pipe = modKey.indexOf("|");
  if (pipe !== -1) return modKey.slice(pipe + 1);
  return DICT[modKey]?.displayLabel ?? modKey;
}

function aggregate(
  rows: IAffixModRow[],
): Array<{ modKey: string; count: number; avg: number }> {
  const map = new Map<string, { countSum: number; magSum: number }>();
  for (const r of rows) {
    if (isExcluded(r.modKey)) continue;
    const cur = map.get(r.modKey) ?? { countSum: 0, magSum: 0 };
    cur.countSum += r.numOccurrences;
    cur.magSum += r.avg * r.numOccurrences;
    map.set(r.modKey, cur);
  }
  return [...map.entries()]
    .map(([modKey, v]) => ({
      modKey,
      count: v.countSum,
      avg: v.countSum > 0 ? v.magSum / v.countSum : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

interface Props {
  rows: IAffixModRow[];
  topN?: number;
}

export function TopAffixAveragesPanel({ rows, topN = 8 }: Props) {
  const top = aggregate(rows).slice(0, topN);
  if (top.length === 0) return null;
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Most common affixes
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
        {top.map((r) => (
          <Paper key={r.modKey} withBorder p="sm" radius="sm">
            <Stack gap={2} align="center">
              <Text size="xs" c="dimmed" tt="uppercase" lineClamp={1}>
                {resolveLabel(r.modKey)}
              </Text>
              <Text
                fw={700}
                size="lg"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {r.avg.toFixed(1)}
              </Text>
              <Text
                size="xs"
                c="dimmed"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {r.count.toLocaleString()} rolls
              </Text>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
