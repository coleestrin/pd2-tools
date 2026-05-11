import { Tabs, Table, Text, ScrollArea, Title, Group, Stack, Tooltip } from "@mantine/core";
import type { IAffixModRow } from "../../types/meta";
import modDictionaryRaw from "../../data/mod-dictionary.json";

// ---------------------------------------------------------------------------
// Slot ordering — matches ItemFrequencyTable / PD2 standalone's SLOT_ORDER
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mod dictionary — maps mod key → { displayLabel, category }
// ---------------------------------------------------------------------------

type ModDictionaryEntry = { displayLabel?: string; category?: string };
type ModDictionary = Record<string, ModDictionaryEntry>;

const DICT = modDictionaryRaw as ModDictionary;

/**
 * Resolve a human-readable label for a mod bucket key.
 *
 * Mod keys are one of:
 *   - "item_fastercastrate" — single-value mod, looked up in mod-dictionary
 *   - "item_addskill_tab|Combat Skills" — bucketed by tab; show the tab name
 *   - "item_singleskill|Ice Blast"      — bucketed by skill; show the skill name
 *   - "item_addclassskills|Sorceress Skills" — show the class-skills name
 * For any "<name>|<label>" form the label after "|" is used directly.
 */
function resolveLabel(modKey: string): string {
  const pipe = modKey.indexOf("|");
  if (pipe !== -1) {
    return modKey.slice(pipe + 1);
  }
  return DICT[modKey]?.displayLabel ?? modKey;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  rows: IAffixModRow[];
}

const TOP_N = 20;

export function AffixFrequencyTable({ rows }: Props) {
  // Group rows by slot
  const bySlot: Partial<Record<Slot, IAffixModRow[]>> = {};
  for (const slot of SLOTS) {
    bySlot[slot] = [];
  }
  for (const r of rows) {
    if (r.slot in bySlot) {
      (bySlot[r.slot as Slot] as IAffixModRow[]).push(r);
    }
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="baseline">
        <Title order={4}>Affix patterns</Title>
        <Tooltip label="Per-slot mod frequencies on Rare/Magic/Crafted items. The % denominator is items-in-slot, not cohort size, so the same mod appearing on every weapon in the cohort reads as 100%. Counts will differ from the Top items table above, which only includes Unique/Set/Runeword named items.">
          <Text size="xs" c="dimmed" style={{ borderBottom: "1px dotted currentColor", cursor: "help" }}>
            Rare, Magic, and Crafted items only
          </Text>
        </Tooltip>
      </Group>
      <Tabs defaultValue={SLOTS[0]}>
        <Tabs.List>
        {SLOTS.map((slot) => (
          <Tabs.Tab key={slot} value={slot}>
            {slot.charAt(0).toUpperCase() + slot.slice(1)} (
            {bySlot[slot]?.length ?? 0})
          </Tabs.Tab>
        ))}
      </Tabs.List>

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
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Mod</Table.Th>
                      <Table.Th ta="right">%</Table.Th>
                      <Table.Th ta="right">Avg</Table.Th>
                      <Table.Th ta="right">Median</Table.Th>
                      <Table.Th ta="right">p75</Table.Th>
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
    </Stack>
  );
}
