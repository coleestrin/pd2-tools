import React, { useMemo } from "react";
import { Card, Flex, Text, Paper, ActionIcon, Tooltip } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { List, RowComponentProps } from "react-window";
import type { CharacterFilters } from "../../../hooks";
import styles from "../VirtualList.module.css";

const classes = [
  "Amazon",
  "Sorceress",
  "Assassin",
  "Barbarian",
  "Druid",
  "Necromancer",
  "Paladin",
];

type Breakdown = {
  Amazon: number;
  Sorceress: number;
  Assassin: number;
  Barbarian: number;
  Druid: number;
  Necromancer: number;
  Paladin: number;
  total: number;
};

interface Props {
  breakdown: Record<string, number>;
  filters: Pick<CharacterFilters, "classFilter" | "filterSearchQuery">;
  updateFilters: (filters: Partial<{ classFilter: string[] }>) => void;
}

export default function ClassCard({
  breakdown,
  filters,
  updateFilters,
}: Props) {
  // Create memoized Set for O(1) lookups
  const selectedClassesSet = useMemo(
    () => new Set(filters.classFilter),
    [filters.classFilter]
  );

  const handleClassSelect = (className: string) => {
    const newClassFilter = selectedClassesSet.has(className)
      ? filters.classFilter.filter((c) => c !== className)
      : [...filters.classFilter, className];
    updateFilters({ classFilter: newClassFilter });
  };

  const filteredClasses = useMemo(() => {
    const searchQuery = filters.filterSearchQuery?.toLowerCase() || "";
    const total = breakdown.total || 0;

    // Single pass for filtering, mapping, and sorting
    return classes
      .reduce(
        (acc, charClass) => {
          // Skip if percentage is 0
          const count = breakdown[charClass as keyof Breakdown] || 0;
          if (count === 0) return acc;

          // Skip if doesn't match search
          if (searchQuery && !charClass.toLowerCase().startsWith(searchQuery)) {
            return acc;
          }

          acc.push({
            name: charClass,
            percentage: total > 0 ? (count / total) * 100 : 0,
            isSelected: selectedClassesSet.has(charClass),
          });
          return acc;
        },
        [] as Array<{
          name: string;
          percentage: number;
          isSelected: boolean;
        }>
      )
      .sort((a, b) => b.percentage - a.percentage);
  }, [breakdown, filters.filterSearchQuery, selectedClassesSet]);

  const hasClasses = filteredClasses.length > 0;

  const ROW_HEIGHT = 35;
  const MAX_HEIGHT = 300;
  const listHeight = Math.min(filteredClasses.length * ROW_HEIGHT, MAX_HEIGHT);
  const needsScroll = filteredClasses.length * ROW_HEIGHT > MAX_HEIGHT;

  type ClassRowData = { name: string; percentage: number; isSelected: boolean };

  const ClassRow = ({
    index,
    classes,
    style,
  }: RowComponentProps<{ classes: ClassRowData[] }>) => {
    const { name, percentage, isSelected } = classes[index];
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
            handleClassSelect(name);
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
                : "rgba(59, 130, 246, 0.35)",
              zIndex: 0,
            }}
          />
          <Tooltip label={name} position="right" openDelay={250} withArrow>
            <Flex
              justify="space-between"
              align="center"
              style={{ position: "relative", zIndex: 1 }}
            >
              <Flex align="center" gap="6px" style={{ minWidth: 0 }}>
                <img
                  src={`/${name}.webp`}
                  alt={name}
                  style={{
                    width: "20px",
                    height: "20px",
                    flexShrink: 0,
                  }}
                />
                <Text lineClamp={1}>{name}</Text>
              </Flex>
              {isSelected ? (
                <ActionIcon
                  size="xs"
                  variant="default"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClassSelect(name);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : (
                <Text>{percentage.toFixed(1)}%</Text>
              )}
            </Flex>
          </Tooltip>
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
        height: hasClasses ? undefined : "auto",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)",
      }}
    >
      <div
        style={{
          padding: "6px",
        }}
      >
        <Text fw={700}>CLASSES</Text>
      </div>

      {hasClasses ? (
        <List
          rowComponent={ClassRow}
          rowCount={filteredClasses.length}
          rowHeight={ROW_HEIGHT}
          rowProps={{ classes: filteredClasses }}
          style={{
            height: listHeight,
            overflowY: needsScroll ? "auto" : "hidden",
          }}
          className={styles.virtualList}
        />
      ) : (
        <></>
      )}
    </Card>
  );
}
