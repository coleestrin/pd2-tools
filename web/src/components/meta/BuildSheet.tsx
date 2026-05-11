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

type SkillRole = "core" | "synergy";
type SkillClassification = Record<string, Record<string, SkillRole>>;
const SKILL_CLASSIFICATION = skillClassificationRaw as SkillClassification;
import type { IClassifiedSkillRow } from "../../types/meta";
import type { ILevelDistribution } from "../../types/meta";

// ---------------------------------------------------------------------------
// Level distribution mini-chart (Mantine Box bars, no extra chart library)
// ---------------------------------------------------------------------------

function LevelDistributionChart({ dist }: { dist: ILevelDistribution }) {
  // The cohort is always one game mode, so exactly one side is non-empty.
  // Drop empty buckets so we only render levels that actually have data —
  // gives every bar room to breathe regardless of how wide the level range is.
  const buckets = (dist.softcore.length > 0 ? dist.softcore : dist.hardcore)
    .filter((b) => b.numOccurrences > 0);

  if (buckets.length === 0) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        — no level data —
      </Text>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.numOccurrences));
  // Reserve a fixed area for bars + labels so the chart's height is
  // predictable and the page above doesn't reflow when the cohort changes.
  const BAR_AREA_HEIGHT = 96;

  return (
    <Group
      gap={6}
      align="flex-end"
      wrap="nowrap"
      style={{ height: BAR_AREA_HEIGHT + 22 }}
    >
      {buckets.map((b) => {
        const barHeight = maxCount > 0 ? (b.numOccurrences / maxCount) * BAR_AREA_HEIGHT : 0;
        return (
          <Tooltip
            key={b.level}
            label={`L${b.level}: ${b.numOccurrences.toLocaleString()}`}
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

// ---------------------------------------------------------------------------
// BuildSheet
// ---------------------------------------------------------------------------

interface Props {
  skillUsage: IClassifiedSkillRow[];
  levelDistribution?: ILevelDistribution;
  className: string;
}

export function BuildSheet({ skillUsage, levelDistribution, className }: Props) {
  const [showPrereqs, setShowPrereqs] = useState(false);
  const [showSynergies, setShowSynergies] = useState(false);

  const classMap = SKILL_CLASSIFICATION[className] ?? {};

  // All skills any cohort member actually built into (>= 20 hard points —
  // matches pd2.tools/builds' threshold).
  const allBuildRows = skillUsage
    .filter((r) => r.numAtTwenty > 0)
    .sort((a, b) => b.pctAtTwenty - a.pctAtTwenty);

  // Per-skill role from the static wiki-scraped classification
  // (web/src/data/skill-classification.json). Skills not in the table fall
  // back to "core" so anything unexpected stays visible by default.
  const roleOf = (name: string): SkillRole => classMap[name] ?? "core";
  const coreRows = allBuildRows.filter((r) => roleOf(r.name) === "core");
  const synergyRows = allBuildRows.filter((r) => roleOf(r.name) === "synergy");

  // Prereq-only view: skills no one builds, but are commonly 1-pt prereqs.
  const prereqOnlyRows = skillUsage.filter(
    (r) => r.numAtTwenty === 0 && r.numAsPrereq > 0,
  );

  // Single popularity-sorted list. Synergies are interleaved with cores by
  // pctAtTwenty rather than appended as a separate block, so a hammerdin
  // cohort's Blessed Aim (typically 95%+) sits at the top alongside Blessed
  // Hammer instead of being shoved below low-prevalence cores. Synergies are
  // hidden by default for a compact entry view; the toggle opts them in.
  const visibleBuildRows = showSynergies
    ? allBuildRows
    : allBuildRows.filter((r) => roleOf(r.name) === "core");
  const display = [
    ...visibleBuildRows,
    ...(showPrereqs ? prereqOnlyRows : []),
  ];

  // Top-3 cores get yellow highlight regardless of how synergies interleave
  // with them once the toggle is on.
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
              — no skill data —
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

          <Text size="xs" c="dimmed" fs="italic">
            Prereq detection uses skill-tree data from{" "}
            <a
              href="https://wiki.projectdiablo2.com"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "underline" }}
            >
              wiki.projectdiablo2.com
            </a>{" "}
            (CC-BY-SA).
          </Text>
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
