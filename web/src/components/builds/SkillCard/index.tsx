import React, { useMemo } from "react";
import { Card, Flex, Text, Paper, Tooltip, ActionIcon } from "@mantine/core";
import { IconInfoCircle, IconX } from "@tabler/icons-react";
import { List, RowComponentProps } from "react-window";
import type { CharacterFilters, SkillRequirement } from "../../../../hooks";
import type { SkillUsageStats } from "../../../../types";
import styles from "../VirtualList.module.css";

interface Props {
  data: {
    skillUsage: SkillUsageStats[];
  };
  filters: Pick<CharacterFilters, "skillFilter" | "filterSearchQuery">;
  updateFilters: (
    filters: Partial<{ skillFilter: SkillRequirement[] }>
  ) => void;
}

export default function SkillCard({ data, filters, updateFilters }: Props) {
  // Create memoized Set of selected skill names for O(1) lookup
  const selectedSkillsSet = useMemo(
    () => new Set(filters.skillFilter.map((s) => s.name)),
    [filters.skillFilter]
  );

  const handleSkillSelect = (skillName: string) => {
    const isCurrentlySelected = selectedSkillsSet.has(skillName);

    const newSkillFilter = isCurrentlySelected
      ? filters.skillFilter.filter((skill) => skill.name !== skillName)
      : [...filters.skillFilter, { name: skillName, minLevel: 20 }];

    updateFilters({ skillFilter: newSkillFilter });
  };

  const skillPercentages = useMemo(() => {
    if (!data.skillUsage) return [];
    const searchQuery = filters.filterSearchQuery?.toLowerCase() || "";

    // Single pass transformation and filtering
    return data.skillUsage
      .reduce(
        (acc, skill) => {
          // Early return if it doesn't match search
          if (
            searchQuery &&
            !skill.name.toLowerCase().startsWith(searchQuery)
          ) {
            return acc;
          }

          acc.push({
            name: skill.name,
            percentage: skill.pct,
            isSelected: selectedSkillsSet.has(skill.name),
          });
          return acc;
        },
        [] as Array<{ name: string; percentage: number; isSelected: boolean }>
      )
      .sort(
        (a, b) =>
          b.percentage - a.percentage ||
          Number(b.isSelected) - Number(a.isSelected)
      );
  }, [data.skillUsage, filters.filterSearchQuery, selectedSkillsSet]);

  const hasSkills = skillPercentages.length > 0;

  const ROW_HEIGHT = 35;
  const MAX_HEIGHT = 350;
  const listHeight = Math.min(skillPercentages.length * ROW_HEIGHT, MAX_HEIGHT);
  const needsScroll = skillPercentages.length * ROW_HEIGHT > MAX_HEIGHT;

  type SkillRowData = { name: string; percentage: number; isSelected: boolean };

  const SkillRow = ({
    index,
    skills,
    style,
  }: RowComponentProps<{ skills: SkillRowData[] }>) => {
    const { name, percentage, isSelected } = skills[index];
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
            handleSkillSelect(name);
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
                : "rgba(168, 85, 247, 0.35)",
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
                  src={`/icons/${name.replaceAll(" ", "_")}.png`}
                  alt={name}
                  style={{
                    width: "20px",
                    height: "20px",
                    flexShrink: 0,
                    objectFit: "contain",
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
                    handleSkillSelect(name);
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
        height: hasSkills ? undefined : "auto",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)",
      }}
    >
      <div
        style={{
          margin: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text fw={700}>SKILLS</Text>
        <Tooltip
          multiline
          label="% of characters with 20 hard points in the skill"
        >
          <ActionIcon variant="subtle" color="gray">
            <IconInfoCircle size={16} />
          </ActionIcon>
        </Tooltip>
      </div>

      {hasSkills && (
        <List
          rowComponent={SkillRow}
          rowCount={skillPercentages.length}
          rowHeight={ROW_HEIGHT}
          rowProps={{ skills: skillPercentages }}
          style={{
            height: listHeight,
            backgroundColor: "rgba(0, 0, 0, 0.15)",
            overflowY: needsScroll ? "auto" : "hidden",
          }}
          className={styles.virtualList}
        />
      )}
    </Card>
  );
}
