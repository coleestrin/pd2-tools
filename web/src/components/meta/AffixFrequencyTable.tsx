import { Tabs, Table, Text, ScrollArea } from "@mantine/core";
import type { IAffixModRow } from "../../types";
import modDictionaryRaw from "../../data/mod-dictionary.json";

const SLOTS = [
  "weapon",
  "offhand",
  "helm",
  "armor",
  "gloves",
  "belt",
  "boots",
  "amulet",
  "ring",
] as const;

type Slot = (typeof SLOTS)[number];

const ALL_SLOTS_TAB = "__all__";

// Filtered out of the cross-slot view; kept in per-slot views.
const META_FLAG_KEYS = new Set(["corrupted", "desecrated", "mirrored"]);

type CrossSlotRow = { modKey: string; count: number; pct: number };

function aggregateAcrossSlots(
  rows: IAffixModRow[],
): { totalItems: number; mods: CrossSlotRow[] } {
  const slotTotals = new Map<string, number>();
  const modCounts = new Map<string, number>();
  for (const r of rows) {
    if (!slotTotals.has(r.slot)) slotTotals.set(r.slot, r.totalSample);
    if (META_FLAG_KEYS.has(r.modKey.toLowerCase())) continue;
    modCounts.set(r.modKey, (modCounts.get(r.modKey) ?? 0) + r.numOccurrences);
  }
  const totalItems = [...slotTotals.values()].reduce((a, b) => a + b, 0);
  const mods: CrossSlotRow[] = [...modCounts.entries()]
    .map(([modKey, count]) => ({
      modKey,
      count,
      pct: totalItems > 0 ? (count / totalItems) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  return { totalItems, mods };
}

type ModDictionaryEntry = { displayLabel?: string; category?: string };
type ModDictionary = Record<string, ModDictionaryEntry>;

const DICT = modDictionaryRaw as ModDictionary;

// modKey is either "item_<name>" (look up in DICT) or "<name>|<label>" where
// the label after the pipe is the display text (skill-tab / single-skill /
// class-skills buckets).
function resolveLabel(modKey: string): string {
  const pipe = modKey.indexOf("|");
  if (pipe !== -1) {
    return modKey.slice(pipe + 1);
  }
  return DICT[modKey]?.displayLabel ?? modKey;
}

interface Props {
  rows: IAffixModRow[];
}

const TOP_N = 20;

export function AffixFrequencyTable({ rows }: Props) {
  const bySlot: Partial<Record<Slot, IAffixModRow[]>> = {};
  for (const slot of SLOTS) {
    bySlot[slot] = [];
  }
  for (const r of rows) {
    if (r.slot in bySlot) {
      (bySlot[r.slot as Slot] as IAffixModRow[]).push(r);
    }
  }

  const crossSlot = aggregateAcrossSlots(rows);

  return (
    <Tabs defaultValue={ALL_SLOTS_TAB}>
      <Tabs.List justify="center" style={{ flexWrap: "wrap" }}>
        <Tabs.Tab value={ALL_SLOTS_TAB}>
          All slots ({crossSlot.totalItems.toLocaleString()})
        </Tabs.Tab>
        {SLOTS.map((slot) => (
          <Tabs.Tab key={slot} value={slot}>
            {slot.charAt(0).toUpperCase() + slot.slice(1)} (
            {bySlot[slot]?.length ?? 0})
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value={ALL_SLOTS_TAB} pt="md">
        {crossSlot.mods.length === 0 ? (
          <Text c="dimmed" fs="italic">
            No affix data across any slot
          </Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover style={{ tableLayout: "fixed" }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Mod</Table.Th>
                  <Table.Th style={{ width: 80 }} ta="right">%</Table.Th>
                  <Table.Th style={{ width: 100 }} ta="right">Count</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {crossSlot.mods.slice(0, 15).map((m) => (
                  <Table.Tr key={m.modKey}>
                    <Table.Td>{resolveLabel(m.modKey)}</Table.Td>
                    <Table.Td ta="right">{m.pct.toFixed(1)}%</Table.Td>
                    <Table.Td ta="right">{m.count.toLocaleString()}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Tabs.Panel>

      {SLOTS.map((slot) => {
        const slotRows = bySlot[slot] ?? [];
        return (
          <Tabs.Panel key={slot} value={slot} pt="md">
            {slotRows.length === 0 ? (
              <Text c="dimmed" fs="italic">
                No affix data for this slot
              </Text>
            ) : (
              <ScrollArea>
                <Table striped highlightOnHover style={{ tableLayout: "fixed" }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Mod</Table.Th>
                      <Table.Th style={{ width: 70 }} ta="right">%</Table.Th>
                      <Table.Th style={{ width: 70 }} ta="right">Avg</Table.Th>
                      <Table.Th style={{ width: 80 }} ta="right">Median</Table.Th>
                      <Table.Th style={{ width: 70 }} ta="right">p75</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {slotRows.slice(0, TOP_N).map((row) => (
                      <Table.Tr key={row.modKey}>
                        <Table.Td>{resolveLabel(row.modKey)}</Table.Td>
                        <Table.Td ta="right">{row.pct.toFixed(1)}%</Table.Td>
                        <Table.Td ta="right">{row.avg.toFixed(1)}</Table.Td>
                        <Table.Td ta="right">{row.median.toFixed(1)}</Table.Td>
                        <Table.Td ta="right">{row.p75.toFixed(1)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Tabs.Panel>
        );
      })}
    </Tabs>
  );
}
