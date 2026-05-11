import { Tabs, Table, Text, Badge, ScrollArea } from "@mantine/core";
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
    <Tabs defaultValue={SLOTS[0]}>
      <Tabs.List justify="center" style={{ flexWrap: "wrap" }}>
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
              <Table striped highlightOnHover style={{ tableLayout: "fixed" }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Item</Table.Th>
                    <Table.Th style={{ width: 110 }}>Type</Table.Th>
                    <Table.Th style={{ width: 90 }} ta="right">Count</Table.Th>
                    <Table.Th style={{ width: 70 }} ta="right">%</Table.Th>
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
