import { Tabs, Table, Text, Badge, ScrollArea, Title, Group, Stack } from "@mantine/core";
import { shapeTopItemsBySlot } from "../../lib/shape/topItems";
import type { TopItemsBySlot } from "../../lib/shape/topItems";
import type { IItemUsageRow } from "../../types/meta";

const SLOTS: Array<keyof TopItemsBySlot> = [
  "weapon",
  "offhand",
  "helm",
  "armor",
  "gloves",
  "belt",
  "boots",
  "amulet",
  "ring",
];

interface Props {
  rows: IItemUsageRow[];
}

export function ItemFrequencyTable({ rows }: Props) {
  const bySlot = shapeTopItemsBySlot(rows);

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="baseline">
        <Title order={4}>Top items</Title>
        <Text size="xs" c="dimmed">
          Unique, Set, and Runeword items
        </Text>
      </Group>
      <Tabs defaultValue={SLOTS[0]}>
        <Tabs.List>
        {SLOTS.map((slot) => (
          <Tabs.Tab key={slot} value={slot}>
            {slot.charAt(0).toUpperCase() + slot.slice(1)} ({bySlot[slot].length})
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {SLOTS.map((slot) => (
        <Tabs.Panel key={slot} value={slot} pt="md">
          {bySlot[slot].length === 0 ? (
            <Text c="dimmed" fs="italic">
              No data for this slot
            </Text>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Item</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th ta="right">Count</Table.Th>
                    <Table.Th ta="right">%</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {bySlot[slot].map((item) => (
                    <Table.Tr key={`${item.itemName}|${item.itemType}`}>
                      <Table.Td>{item.itemName}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={rarityColor(item.itemType)}>
                          {item.itemType}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right">{item.count.toLocaleString()}</Table.Td>
                      <Table.Td ta="right">{item.pct.toFixed(1)}%</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Tabs.Panel>
      ))}
      </Tabs>
    </Stack>
  );
}

function rarityColor(itemType: string): string {
  switch (itemType) {
    case "Unique":
      return "yellow";
    case "Set":
      return "green";
    case "Runeword":
      return "orange";
    case "Rare":
      return "yellow";
    case "Magic":
      return "blue";
    case "Crafted":
      return "violet";
    default:
      return "gray";
  }
}
