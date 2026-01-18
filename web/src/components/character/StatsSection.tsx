import { ActionIcon, Card, Text, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import type { StatsSectionProps } from "../../types";

// Color definitions for consistency
const COLORS = {
  life: "rgb(239, 78, 78)",
  mana: "rgb(36, 135, 235)",
  strength: "rgb(239, 78, 78)",
  dexterity: "rgb(49, 180, 56)",
  vitality: "rgb(239, 78, 78)",
  energy: "rgb(36, 135, 235)",
  fire: "rgb(148, 0, 0)",
  cold: "rgb(54, 99, 145)",
  lightning: "rgb(255, 217, 0)",
  poison: "#00991c",
} as const;

interface StatRowProps {
  label: string;
  value: number | string;
  secondValue?: number | string;
  color?: string;
  separator?: string;
  isLast?: boolean;
}

function StatRow({
  label,
  value,
  secondValue,
  color,
  separator = "/",
  isLast = false,
}: StatRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <Text size="sm">{label}</Text>
      <Text size="sm" fw={500}>
        <span style={{ color: color }}>{value}</span>
        {secondValue !== undefined && (
          <>
            {" "}
            {separator} <span style={{ color: color }}>{secondValue}</span>
          </>
        )}
      </Text>
    </div>
  );
}

interface StatGroupProps {
  title: string;
  tooltip?: React.ReactNode;
  children: React.ReactNode;
}

function StatGroup({ title, tooltip, children }: StatGroupProps) {
  return (
    <div style={{ minWidth: "180px", flex: "1 1 0" }}>
      <Text fw={700} size="sm" ta="center" mb="xs">
        {title}
        {tooltip && (
          <Tooltip multiline label={tooltip} withArrow>
            <IconInfoCircle
              size={12}
              style={{ marginLeft: "6px", cursor: "help", opacity: 0.7 }}
            />
          </Tooltip>
        )}
      </Text>
      <div>{children}</div>
    </div>
  );
}

export function StatsSection({
  attributes,
  stats,
  realStats: realStatsInput,
}: StatsSectionProps) {
  const realStats = realStatsInput || {
    strength: attributes.strength,
    dexterity: attributes.dexterity,
    vitality: attributes.vitality,
    energy: attributes.energy,
    fireRes: -70,
    maxFireRes: 75,
    coldRes: -70,
    maxColdRes: 75,
    lightningRes: -70,
    maxLightningRes: 75,
    poisonRes: -70,
    maxPoisonRes: 75,
    fAbsorbFlat: 0,
    fAbsorbPct: 0,
    cAbsorbFlat: 0,
    cAbsorbPct: 0,
    lAbsorbFlat: 0,
    lAbsorbPct: 0,
    fcr: 0,
    fhr: 0,
    frw: 0,
    ias: 0,
    cb: 0,
    ds: 0,
    ll: 0,
    ml: 0,
    pp: 0, 
    ow: 0,
    cs: 0,
    hppk: 0,
    mppk: 0,
    mf: 0,
    gf: 0,
    pdr: 0,
  };
  return (
    <Card radius="md" shadow="md" padding="md">
      {/* Header */}
      <Card.Section
        style={{
          backgroundColor: "rgb(44, 45, 50)",
          borderBottom: "1.75px solid rgb(55, 58, 64)",
          padding: "8px 12px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text fw={500}>Stats</Text>
          <Tooltip
            multiline
            withArrow
            label="If you think one of the stats is wrong, please post the character in #bug-report in discord"
          >
            <ActionIcon variant="subtle" color="gray" size="sm">
              <IconInfoCircle size={16} />
            </ActionIcon>
          </Tooltip>
        </div>
      </Card.Section>

      {/* Stats Content */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          padding: "0 8px",
        }}
      >
        {/* Defensive Stats */}
        <StatGroup title="Defensive">
          <StatRow label="Life" value={stats.life} color={COLORS.life} />
          <StatRow label="Mana" value={stats.mana} color={COLORS.mana} isLast />
        </StatGroup>

        {/* Attributes */}
        <StatGroup
          tooltip="Base Attribute / Actual Attribute (with gear)"
          title="Attributes"
        >
          <StatRow
            label="Strength"
            value={attributes.strength}
            secondValue={realStats.strength}
            color={COLORS.strength}
          />
          <StatRow
            label="Dexterity"
            value={attributes.dexterity}
            secondValue={realStats.dexterity}
            color={COLORS.dexterity}
          />
          <StatRow
            label="Vitality"
            value={attributes.vitality}
            secondValue={realStats.vitality}
            color={COLORS.vitality}
          />
          <StatRow
            label="Energy"
            value={attributes.energy}
            secondValue={realStats.energy}
            color={COLORS.energy}
            isLast
          />
        </StatGroup>

        {/* Resistances */}
        <StatGroup tooltip="Resist / Max Resist" title="Resistances">
          <StatRow
            label="Fire"
            value={realStats.fireRes}
            secondValue={realStats.maxFireRes}
            color={COLORS.fire}
          />
          <StatRow
            label="Cold"
            value={realStats.coldRes}
            secondValue={realStats.maxColdRes}
            color={COLORS.cold}
          />
          <StatRow
            label="Lightning"
            value={realStats.lightningRes}
            secondValue={realStats.maxLightningRes}
            color={COLORS.lightning}
          />
          <StatRow
            label="Poison"
            value={realStats.poisonRes}
            secondValue={realStats.maxPoisonRes}
            color={COLORS.poison}
            isLast
          />
        </StatGroup>

        {/* Absorb */}
        <StatGroup tooltip="Flat Absorb / % Absorb" title="Absorb">
          <StatRow
            label="Fire"
            value={realStats.fAbsorbFlat}
            secondValue={`${realStats.fAbsorbPct}%`}
            color={COLORS.fire}
          />
          <StatRow
            label="Cold"
            value={realStats.cAbsorbFlat}
            secondValue={`${realStats.cAbsorbPct}%`}
            color={COLORS.cold}
          />
          <StatRow
            label="Lightning"
            value={realStats.lAbsorbFlat}
            secondValue={`${realStats.lAbsorbPct}%`}
            color={COLORS.lightning}
            isLast
          />
        </StatGroup>

        {/* Miscellaneous */}
        <StatGroup title="Miscellaneous">
          <StatRow label="Faster Cast Rate" value={`${realStats.fcr}%`} />
          <StatRow label="Faster Hit Recovery" value={`${realStats.fhr}%`} />
          <StatRow label="Faster Run/Walk" value={`${realStats.frw}%`} />
          <StatRow label="Increased Attack Speed" value={`${realStats.ias}%`} />
          <StatRow label="Crushing Blow" value={`${realStats.cb}%`} />
          <StatRow label="Deadly Strike" value={`${realStats.ds}%`} />
          <StatRow label="Life Leech" value={`${realStats.ll}%`} />
          <StatRow label="Mana Leech" value={`${realStats.ml}%`} />
          <StatRow label="Open Wounds" value={`${realStats.ow}%`} />
          <StatRow label="Critical Strike" value={`${realStats.cs}%`} />
          <StatRow label="Life after each Kill" value={`${realStats.hppk}`} />
          <StatRow label="Mana after each Kill" value={`${realStats.mppk}`} />
          <StatRow label="Magic Find" value={`${realStats.mf}%`} />
          <StatRow label="Gold Find" value={`${realStats.gf}%`} />
          <StatRow
            label="Physical Damage Reduction"
            value={`${realStats.pdr}%`}
            isLast
          />
        </StatGroup>
      </div>
    </Card>
  );
}
