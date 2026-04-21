import React, { useMemo, useState, useEffect } from "react";
import { Card, Flex, Text, Paper, ActionIcon } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { List, RowComponentProps } from "react-window";
import type { CharacterFilters } from "../../../hooks";
import type { ItemUsageStats } from "../../../types";
import styles from "../VirtualList.module.css";
import {
  getBrightBorderColor,
  getDarkBackgroundColor,
} from "../shared/item-colors";
import {
  type ItemData,
  ItemTooltip,
} from "../shared/ItemHelpers";

interface Props {
  data: {
    mercItemUsage: ItemUsageStats[];
  };
  filters: Pick<CharacterFilters, "mercItemFilter" | "searchQuery">;
  updateFilters: (filters: Partial<{ mercItemFilter: string[] }>) => void;
}

export default function MercItemCard({ data, filters, updateFilters }: Props) {
  const [itemsData, setItemsData] = useState<Map<string, ItemData>>(new Map());

  // Load items.json and create lookup map
  useEffect(() => {
    fetch("/items.json")
      .then((res) => res.json())
      .then((items: ItemData[]) => {
        const dataMap = new Map<string, ItemData>();
        items.forEach((item) => {
          dataMap.set(item.gearId.name, item);
        });
        setItemsData(dataMap);
      })
      .catch((err) => console.error("Failed to load items.json:", err));
  }, []);

  const selectedItemsSet = useMemo(
    () => new Set(filters.mercItemFilter),
    [filters.mercItemFilter]
  );

  const handleItemSelect = (itemName: string) => {
    const isSelected = selectedItemsSet.has(itemName);
    updateFilters({
      mercItemFilter: isSelected
        ? filters.mercItemFilter.filter((i) => i !== itemName)
        : [...filters.mercItemFilter, itemName],
    });
  };

  const itemPercentages = useMemo(() => {
    if (!data.mercItemUsage) return [];
    const searchQuery = filters.searchQuery?.toLowerCase() || "";

    return data.mercItemUsage
      .reduce(
        (acc, item) => {
          if (searchQuery && !item.item.toLowerCase().startsWith(searchQuery))
            return acc;

          acc.push({
            name: item.item,
            percentage: item.pct,
            type: item.itemType,
            isSelected: selectedItemsSet.has(item.item),
          });
          return acc;
        },
        [] as Array<{
          name: string;
          percentage: number;
          type: string;
          isSelected: boolean;
        }>
      )
      .sort(
        (a, b) =>
          b.percentage - a.percentage ||
          Number(b.isSelected) - Number(a.isSelected)
      );
  }, [data.mercItemUsage, filters.searchQuery, selectedItemsSet]);

  const getItemTypeColor = (type: string) => {
    switch (type) {
      case "Unique":
        return "rgba(193, 125, 58, 0.35)";
      case "Set":
        return "rgba(30, 237, 14, 0.35)";
      case "Runeword":
        return "rgba(250, 204, 21, 0.35)";
      default:
        return "rgba(200, 200, 200, 0.1)";
    }
  };

  const hasItems = itemPercentages.length > 0;

  const ROW_HEIGHT = 35;
  const MAX_HEIGHT = 350;
  const listHeight = Math.min(itemPercentages.length * ROW_HEIGHT, MAX_HEIGHT);
  const needsScroll = itemPercentages.length * ROW_HEIGHT > MAX_HEIGHT;

  type ItemRowData = {
    name: string;
    percentage: number;
    type: string;
    isSelected: boolean;
  };

  const ItemRow = ({
    index,
    items,
    style,
  }: RowComponentProps<{ items: ItemRowData[] }>) => {
    const { name, percentage, type, isSelected } = items[index];
    const itemData = itemsData.get(name);
    const imageUrl = itemData?.imageUrl;
    const borderColor = getBrightBorderColor(type);
    const backgroundColor = getDarkBackgroundColor(type);

    return (
      <div style={style}>
        <Paper
          key={name}
          withBorder
          radius={0}
          p="5"
          style={{
            cursor: "pointer",
            borderLeft: "none",
            borderRight: "none",
            borderBottom: "none",
            position: "relative",
            overflow: "hidden",
            backgroundColor: isSelected ? "rgba(0, 255, 0, 0.2)" : undefined,
          }}
          variant="hover"
          onClick={(e) => {
            const backgroundBar = e.currentTarget.querySelector(
              'div[style*="position: absolute"]'
            ) as HTMLElement | null;
            if (backgroundBar) {
              backgroundBar.style.width = "0%";
            }
            handleItemSelect(name);
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: `${percentage}%`,
              backgroundColor: isSelected
                ? "rgba(0, 255, 0, 0.2)"
                : getItemTypeColor(type),
              zIndex: 0,
            }}
          />
          <ItemTooltip itemData={itemData} itemType={type} itemName={name}>
            <Flex
              justify="space-between"
              align="center"
              style={{ position: "relative", zIndex: 1, width: "100%" }}
            >
              <Flex align="center" gap="6px" style={{ minWidth: 0 }}>
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    flexShrink: 0,
                    border: imageUrl ? `0.25px solid ${borderColor}` : "none",
                    backgroundColor: imageUrl ? backgroundColor : "transparent",
                    borderRadius: "2px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  )}
                </div>
                <Text lineClamp={1}>{name}</Text>
              </Flex>
              {isSelected ? (
                <ActionIcon
                  size="xs"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleItemSelect(name);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : (
                <Text>{percentage.toFixed(1)}%</Text>
              )}
            </Flex>
          </ItemTooltip>
        </Paper>
      </div>
    );
  };

  return (
    <Card
      p={0}
      withBorder
      style={{
        display: "flex",
        flexDirection: "column",
        maxHeight: "400px",
        height: hasItems ? undefined : "auto",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)",
      }}
    >
      <div style={{ padding: "6px" }}>
        <Text fw={700}>MERC ITEMS</Text>
      </div>

      {hasItems && (
        <List
          rowComponent={ItemRow}
          rowCount={itemPercentages.length}
          rowHeight={ROW_HEIGHT}
          rowProps={{ items: itemPercentages }}
          style={{
            height: listHeight,
            overflowY: needsScroll ? "auto" : "hidden",
          }}
          className={styles.virtualList}
        />
      )}
    </Card>
  );
}
