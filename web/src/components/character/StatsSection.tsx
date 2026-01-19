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
  magic: "rgb(255, 140, 0)",
  fasterCastRate: "rgb(0, 200, 255)",
  fasterHitRecovery: "rgb(190, 80, 255)",
  fasterRunWalk: "rgb(80, 255, 80)",
  increasedAttackSpeed: "rgb(80, 120, 255)",
  crushingBlow: "rgb(255, 140, 0)",
  deadlyStrike: "rgb(255, 220, 0)",
  openWounds: "rgb(255, 60, 60)",
  lifeLeech: "rgb(255, 80, 80)",
  manaLeech: "rgb(60, 140, 255)",
  magicFind: "rgb(200, 90, 255)",
  goldFind: "rgb(255, 230, 80)",
  physicalDamageReduction: "#bdbc99",
  zeroValue: "rgb(107, 114, 128)"
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
    mAbsorbFlat: 0,
    fasterCastRate: 0,
    fasterHitRecovery: 0,
    fasterRunWalk: 0,
    increasedAttackSpeed: 0,
    crushingBlow: 0,
    deadlyStrike: 0,
    lifeLeech: 0,
    manaLeech: 0,
    openWounds: 0,
    openWoundsDPS: 0,
    fireSkillDamage: 0,
    coldSkillDamage: 0,
    lightningSkillDamage: 0,
    poisonSkillDamage: 0,
    hpPerKill: 0,
    mpPerKill: 0,
    magicFind: 0,
    goldFind: 0,
    physicalDamageReduction: 0,
    firePierce: 0,
    coldPierce: 0,
    lightningPierce: 0,
    poisonPierce: 0
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
          <StatRow label="Mana" value={stats.mana} color={COLORS.mana} />
          <StatRow label="Physical Damage Reduction" value={`${realStats.physicalDamageReduction}%`} color={COLORS.physicalDamageReduction} isLast />
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
          />
          <StatRow
            label="Magic"
            value={realStats.mAbsorbFlat}
            color={COLORS.magic}
            isLast
          />
        </StatGroup>

        {/* Speed */}
        <StatGroup title="Speed" tooltip="Item Bonuses Only">
          <StatRow label="Faster Cast Rate" value={`${realStats.fasterCastRate}%`} color={COLORS.fasterCastRate} />
          <StatRow label="Faster Hit Recovery" value={`${realStats.fasterHitRecovery}%`} color={COLORS.fasterHitRecovery} />
          <StatRow label="Faster Run/Walk" value={`${realStats.fasterRunWalk}%`} color={COLORS.fasterRunWalk} />
          <StatRow label="Increased Attack Speed" value={`${realStats.increasedAttackSpeed}%`} color={COLORS.increasedAttackSpeed} isLast />
        </StatGroup>

        {/* Damage Procs */}
        <StatGroup title="Damage Procs">
          <StatRow label="Crushing Blow" value={`${realStats.crushingBlow}%`} color={COLORS.crushingBlow} />
          <StatRow label="Deadly Strike" value={`${realStats.deadlyStrike}%`} color={COLORS.deadlyStrike} />
          <StatRow label="Open Wounds" value={`${realStats.openWounds}%`} color={COLORS.openWounds} />
          <StatRow label="+ Open Wounds DPS" value={`${realStats.openWoundsDPS}`} color={COLORS.openWounds} isLast />
        </StatGroup>

        {/* Leech */}
        <StatGroup title="Leech">
          <StatRow label="Life Leech" value={`${realStats.lifeLeech}%`} color={COLORS.lifeLeech} />
          <StatRow label="Mana Leech" value={`${realStats.manaLeech}%`} color={COLORS.manaLeech} />
          <StatRow label="Life after each Kill" value={`${realStats.hpPerKill}`} color={COLORS.life} />
          <StatRow label="Mana after each Kill" value={`${realStats.mpPerKill}`} color={COLORS.mana} isLast />
        </StatGroup>

        {/* Elemental Skill Damage */}
        <StatGroup title="Elemental Skill Damage" tooltip="Item Bonuses Only">
          <StatRow label="Fire" value={`${realStats.fireSkillDamage}%`} color={COLORS.fire} />
          <StatRow label="Cold" value={`${realStats.coldSkillDamage}%`} color={COLORS.cold} />
          <StatRow label="Lightning" value={`${realStats.lightningSkillDamage}%`} color={COLORS.lightning} />
          <StatRow label="Poison" value={`${realStats.poisonSkillDamage}%`} color={COLORS.poison} isLast />
        </StatGroup>

        {/* Elemental Pierce */}
        <StatGroup title="Elemental Pierce" tooltip="Item Bonuses Only">
          <StatRow label="Fire" value={`${realStats.firePierce}%`} color={COLORS.fire} />
          <StatRow label="Cold" value={`${realStats.coldPierce}%`} color={COLORS.cold} />
          <StatRow label="Lightning" value={`${realStats.lightningPierce}%`} color={COLORS.lightning} />
          <StatRow label="Poison" value={`${realStats.poisonPierce}%`} color={COLORS.poison} isLast />
        </StatGroup>

        {/* Rewards */}
        <StatGroup title="Rewards">
          <StatRow label="Magic Find" value={`${realStats.magicFind}%`} color={COLORS.magicFind} />
          <StatRow label="Gold Find" value={`${realStats.goldFind}%`} color={COLORS.goldFind} isLast />
        </StatGroup>
      </div>
    </Card>
  );
}
