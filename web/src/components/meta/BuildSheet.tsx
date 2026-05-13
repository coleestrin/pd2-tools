import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { CollapsibleSection } from "./CollapsibleSection";
import skillClassificationRaw from "../../data/skill-classification.json";
import type { IClassifiedSkillRow, LevelDistributionData } from "../../types";

type SkillRole = "core" | "synergy";
type SkillClassification = Record<string, Record<string, SkillRole>>;
const SKILL_CLASSIFICATION = skillClassificationRaw as SkillClassification;

function LevelDistributionChart({ dist }: { dist: LevelDistributionData }) {
  const buckets = (dist.softcore.length > 0 ? dist.softcore : dist.hardcore)
    .filter((b) => b.count > 0);

  if (buckets.length === 0) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        No level data
      </Text>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.count));
  const BAR_AREA_HEIGHT = 96;

  return (
    <Group
      gap={6}
      align="flex-end"
      wrap="nowrap"
      style={{ height: BAR_AREA_HEIGHT + 22 }}
    >
      {buckets.map((b) => {
        const barHeight = maxCount > 0 ? (b.count / maxCount) * BAR_AREA_HEIGHT : 0;
        return (
          <Tooltip
            key={b.level}
            label={`L${b.level}: ${b.count.toLocaleString()}`}
            position="top"
            withArrow
          >
            <Stack
              gap={4}
              align="center"
              justify="flex-end"
              style={{ cursor: "default", height: "100%", minWidth: 16, flex: 1 }}
            >
              <Box
                style={{
                  width: "100%",
                  maxWidth: 28,
                  height: Math.max(3, barHeight),
                  background: "var(--mantine-color-blue-6)",
                  borderRadius: 3,
                }}
              />
              <Text
                size="xs"
                c="dimmed"
                lh={1}
                style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}
              >
                {b.level}
              </Text>
            </Stack>
          </Tooltip>
        );
      })}
    </Group>
  );
}

interface Props {
  skillUsage: IClassifiedSkillRow[];
  levelDistribution?: LevelDistributionData;
  className: string;
}

export function BuildSheet({ skillUsage, levelDistribution, className }: Props) {
  const [showPrereqs, setShowPrereqs] = useState(false);
  const [showSynergies, setShowSynergies] = useState(false);

  const classMap = SKILL_CLASSIFICATION[className] ?? {};

  // 20-hard-point threshold matches pd2.tools/builds.
  const allBuildRows = skillUsage
    .filter((r) => r.numAtTwenty > 0)
    .sort((a, b) => b.pctAtTwenty - a.pctAtTwenty);

  const roleOf = (name: string): SkillRole => classMap[name] ?? "core";
  const coreRows = allBuildRows.filter((r) => roleOf(r.name) === "core");
  const synergyRows = allBuildRows.filter((r) => roleOf(r.name) === "synergy");

  // Prereq-only view: skills no one builds, but are commonly 1-pt prereqs.
  const prereqOnlyRows = skillUsage.filter(
    (r) => r.numAtTwenty === 0 && r.numAsPrereq > 0,
  );

  // Synergies hidden by default; toggle interleaves them by pctAtTwenty.
  const visibleBuildRows = showSynergies
    ? allBuildRows
    : allBuildRows.filter((r) => roleOf(r.name) === "core");
  const display = [
    ...visibleBuildRows,
    ...(showPrereqs ? prereqOnlyRows : []),
  ];

  const topCoreNames = new Set(coreRows.slice(0, 3).map((r) => r.name));

  return (
    <Stack gap="md">
      <CollapsibleSection title="Core Skills">
        <Stack gap="sm">
          {(synergyRows.length > 0 || prereqOnlyRows.length > 0) && (
            <Group justify="flex-end" gap="xs">
              {synergyRows.length > 0 && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  color="gray"
                  onClick={() => setShowSynergies((v) => !v)}
                >
                  {showSynergies
                    ? `Hide synergies (${synergyRows.length})`
                    : `Show synergies (${synergyRows.length})`}
                </Button>
              )}
              {prereqOnlyRows.length > 0 && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  color="gray"
                  onClick={() => setShowPrereqs((v) => !v)}
                >
                  {showPrereqs
                    ? `Hide prerequisites (${prereqOnlyRows.length})`
                    : `Show prerequisites (${prereqOnlyRows.length})`}
                </Button>
              )}
            </Group>
          )}

          {display.length === 0 ? (
            <Text size="sm" c="dimmed" fs="italic">
              No skill data
            </Text>
          ) : (
        <Table striped highlightOnHover withColumnBorders={false} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Skill</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Chars at 20+</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>
                <Tooltip label="% of cohort with 20+ hard points in this skill (same threshold pd2.tools/builds uses).">
                  <span style={{ borderBottom: "1px dotted currentColor", cursor: "help" }}>
                    Hard %
                  </span>
                </Tooltip>
              </Table.Th>
              <Table.Th style={{ textAlign: "right" }}>
                <Tooltip label="% with any base level in this skill (includes 1-pt prereqs).">
                  <span style={{ borderBottom: "1px dotted currentColor", cursor: "help" }}>
                    Any %
                  </span>
                </Tooltip>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {display.map((sk) => {
              const isPrereqRow = sk.numAtTwenty === 0;
              const isSynergyRow = !isPrereqRow && roleOf(sk.name) === "synergy";
              const isTopBuild = topCoreNames.has(sk.name);
              const typeBadge = isPrereqRow
                ? { label: "Prereq", color: "gray", variant: "outline" as const }
                : isSynergyRow
                  ? { label: "Synergy", color: "gray", variant: "light" as const }
                  : null;
              return (
                <Table.Tr key={sk.name}>
                  <Table.Td
                    c={isPrereqRow || isSynergyRow ? "dimmed" : isTopBuild ? "yellow.4" : undefined}
                    fw={isTopBuild ? 700 : undefined}
                    fs={isPrereqRow ? "italic" : undefined}
                  >
                    {sk.name}
                  </Table.Td>
                  <Table.Td>
                    {typeBadge && (
                      <Badge
                        size="xs"
                        variant={typeBadge.variant}
                        color={typeBadge.color}
                      >
                        {typeBadge.label}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }} c="dimmed">
                    {sk.numAtTwenty.toLocaleString()}
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }} fw={isTopBuild ? 600 : undefined}>
                    {sk.pctAtTwenty.toFixed(1)}%
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }} c="dimmed">
                    {sk.pct.toFixed(1)}%
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

        </Stack>
      </CollapsibleSection>

      {levelDistribution && (
        <CollapsibleSection title="Level distribution">
          <LevelDistributionChart dist={levelDistribution} />
        </CollapsibleSection>
      )}
    </Stack>
  );
}
