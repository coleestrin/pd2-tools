import { useState, useMemo, useCallback } from "react";
import {
  Stack,
  Group,
  TextInput,
  Box,
  Table,
  Text,
  Button,
  Tooltip,
} from "@mantine/core";
import {
  IconSearch,
  IconExternalLink,
  IconAlertCircle,
} from "@tabler/icons-react";
import { SortableTableHeader } from "./SortableTableHeader";
import { SparklineChart } from "../shared";
import type {
  ItemsTableProps,
  EconomyItem,
  SortField,
  SortOrder,
} from "../../../types";

export function ItemsTable({
  items: initialItems,
  isPending,
  category,
  search: searchSuffix = "",
}: ItemsTableProps) {
  const [sortBy, setSortBy] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [search, setSearch] = useState("");

  const getSortValue = useCallback(
    (item: EconomyItem, field: SortField): number | string => {
      switch (field) {
        case "name":
          return item.item_name;
        case "price":
          return item.price_data.length > 0
            ? item.price_data[item.price_data.length - 1].price
            : 0;
        case "last7d":
          return parseFloat(item.last_7d_pct || "0");
        case "listed":
          return item.price_data.length > 0
            ? item.price_data[item.price_data.length - 1].numListings
            : 0;
        default:
          return 0;
      }
    },
    []
  );

  const sortItems = useCallback(
    (
      itemsToSort: EconomyItem[],
      field: SortField,
      order: SortOrder
    ): EconomyItem[] => {
      return [...itemsToSort].sort((a, b) => {
        let aValue = getSortValue(a, field);
        let bValue = getSortValue(b, field);

        if (aValue === undefined || aValue === null)
          aValue = order === "asc" ? Infinity : -Infinity;
        if (bValue === undefined || bValue === null)
          bValue = order === "asc" ? Infinity : -Infinity;

        if (order === "asc") {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      });
    },
    [getSortValue]
  );

  const items = useMemo(() => {
    let filteredItems = [...initialItems];

    // Apply search filter
    if (search) {
      filteredItems = filteredItems.filter((item) =>
        item.item_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply sorting
    if (sortBy) {
      filteredItems = sortItems(filteredItems, sortBy, sortOrder);
    }

    // Calculate percentage change
    return filteredItems.map((item) => {
      const price7dAgo = item.price_data[0]?.price;
      const price1dAgo = item.price_data[item.price_data.length - 1]?.price;
      const pctChange =
        price1dAgo && price7dAgo
          ? ((price1dAgo - price7dAgo) / price7dAgo) * 100
          : 0; //@ts-expect-error - mutating item object with additional property
      item.last_7d_pct = pctChange
        ? pctChange > 0
          ? `+${pctChange.toFixed(0)}`
          : pctChange.toFixed(0)
        : null;
      return item;
    });
  }, [initialItems, search, sortBy, sortOrder, sortItems]);

  const handleSort = useCallback(
    (field: SortField) => {
      const isAsc = sortBy === field && sortOrder === "asc";
      const newOrder: SortOrder = isAsc ? "desc" : "asc";
      setSortBy(field);
      setSortOrder(newOrder);
    },
    [sortBy, sortOrder]
  );

  if (isPending) return null;

  return (
    <Stack>
      {category === "Runes" && (
        <Text size="sm">
          The price of Vex and below generally does not change. Vex = 0.5, Gul =
          0.25, Ist = 0.15, Mal = 0.1, Um = 0.05, Pul = 0.03, Lem = 0.01
        </Text>
      )}
      <Group justify="space-between">
        <TextInput
          placeholder="Filter by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<IconSearch size={16} />}
          style={{ width: "100%", maxWidth: "400px" }}
        />
      </Group>
      <Box style={{ overflowX: "auto", width: "100%" }}>
        <Table highlightOnHover style={{ minWidth: "750px" }}>
          <Table.Thead>
            <Table.Tr>
              <SortableTableHeader
                sorted={sortBy === "name" ? sortOrder : null}
                onSort={() => handleSort("name")}
              >
                Name
              </SortableTableHeader>
              <SortableTableHeader
                sorted={sortBy === "price" ? sortOrder : null}
                onSort={() => handleSort("price")}
              >
                Price
              </SortableTableHeader>
              <SortableTableHeader
                sorted={sortBy === "last7d" ? sortOrder : null}
                onSort={() => handleSort("last7d")}
              >
                Last 7 days
              </SortableTableHeader>
              <SortableTableHeader
                sorted={sortBy === "listed" ? sortOrder : null}
                onSort={() => handleSort("listed")}
              >
                # Listed
              </SortableTableHeader>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => {
              const currentPriceData =
                item.price_data && item.price_data.length > 0
                  ? item.price_data[item.price_data.length - 1]
                  : { price: 0, numListings: 0 };
              const currentPrice = currentPriceData.price;
              const numListings = currentPriceData.numListings;

              return (
                <Table.Tr key={item.item_name}>
                  <Table.Td>
                    <Group justify="space-between" wrap="nowrap">
                      <a //@ts-expect-error - missing required props for anchor tag
                        href={`/economy/item/${item.item_name.toLowerCase().replaceAll(" ", "-").replaceAll("'", "")}${searchSuffix}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          flexShrink: 1,
                          minWidth: 0,
                        }}
                      >
                        <Group gap="sm" wrap="nowrap">
                          <img
                            src={item.icon_url}
                            alt={item.item_name}
                            width={27}
                            height={27}
                            style={{ objectFit: "contain" }}
                          />
                          <Text truncate>{item.item_name}</Text>
                        </Group>
                      </a>
                      {item.wiki_link && (
                        <Button
                          component="a"
                          href={item.wiki_link}
                          target="_blank"
                          variant="light"
                          size="xs"
                          styles={{
                            root: {
                              color: "#228be6",
                              height: "18px",
                              padding: "2px 6px",
                              fontSize: "10px",
                              flexShrink: 0,
                            },
                            label: { fontSize: "10px" },
                          }}
                        >
                          <Group gap={2} wrap="nowrap">
                            <Text size="10px">WIKI</Text>
                            <IconExternalLink size={10} />
                          </Group>
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>
                    {currentPrice ? Number(currentPrice).toFixed(2) : "N/A"} HR{" "}
                    {typeof numListings === "number" && numListings <= 20 && (
                      <Tooltip label="Low confidence. This price may be inaccurate due to a low number of listings.">
                        <IconAlertCircle
                          color="#FF4F4B"
                          size={16}
                          style={{ marginLeft: "4px", verticalAlign: "middle" }}
                        />
                      </Tooltip>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <SparklineChart data={item.price_data} />
                      <Text
                        style={{
                          color: item.last_7d_pct?.startsWith("+")
                            ? "#4CAF50"
                            : item.last_7d_pct?.startsWith("-")
                              ? "#F44336"
                              : "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.last_7d_pct || "+0"}%
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: "nowrap" }}>
                    {numListings >= 100 ? "100+" : `~${numListings}`}
                  </Table.Td>
                  <Table.Td>
                    <a
                      href={`https://www.projectdiablo2.com/market?name=${encodeURIComponent(item.item_name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="light"
                        rightSection={<IconExternalLink size={16} />}
                        size="sm"
                      >
                        Trade
                      </Button>
                    </a>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
    </Stack>
  );
}
