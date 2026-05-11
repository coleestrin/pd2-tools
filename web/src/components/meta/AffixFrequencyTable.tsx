import { Tabs, Table, Text, ScrollArea } from "@mantine/core";
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
 * For `item_addskill_tab|Tab Name` keys the tab name is used directly as the
 * display label (mirrors PD2 standalone behaviour for skill-tab entries).
 * For all other keys, the mod-dictionary `displayLabel` is used with
 * the raw modKey as fallback.
 */
function resolveLabel(modKey: string): string {
  const SKILL_TAB_PREFIX = "item_addskill_tab|";
  if (modKey.startsWith(SKILL_TAB_PREFIX)) {
    return modKey.slice(SKILL_TAB_PREFIX.length);
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
  );
}
