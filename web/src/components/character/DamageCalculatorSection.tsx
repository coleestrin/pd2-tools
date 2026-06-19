import { useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { IconCalculator, IconChevronDown } from "@tabler/icons-react";
import type {
  ActiveAuraSummary,
  DamageAuraOption,
  DamageCalculation,
  DamageCalculatorSectionProps,
  DamageProfile,
  DamageRange,
  DamageTransformationOption,
  DamageWeaponOption,
} from "../../types";
import { STAT_COLORS } from "./stat-colors";

const BUG_REPORT_CHANNEL_URL =
  "https://discordapp.com/channels/1311407302149931128/1311407430122475580";
const SPELL_AURA_DAMAGE_NOTE =
  "Selected attack aura damage payloads are not applied to spell damage.";

function formatRange(range?: DamageRange) {
  if (!range) {
    return "0";
  }

  return `${range.min.toLocaleString()} - ${range.max.toLocaleString()}`;
}

function getWeaponSetLabel(weaponSet: DamageWeaponOption["weaponSet"]) {
  return weaponSet === "primary" ? "primary set" : "swap set";
}

function isBowOrCrossbowWeapon(
  weapon: Pick<DamageWeaponOption, "baseName" | "itemName" | "weaponType">
) {
  return /bow|crossbow/i.test(
    [weapon.baseName, weapon.itemName, weapon.weaponType].join(" ")
  );
}

function getHandModeLabel(
  handMode: DamageWeaponOption["handMode"],
  weapon?: Pick<DamageWeaponOption, "baseName" | "itemName" | "weaponType">
) {
  switch (handMode) {
    case "missile":
      if (weapon && isBowOrCrossbowWeapon(weapon)) {
        return /crossbow/i.test(
          [weapon.baseName, weapon.itemName, weapon.weaponType].join(" ")
        )
          ? "crossbow"
          : "bow";
      }

      return "thrown";
    case "one_handed":
      return "1H";
    case "two_handed":
      return "2H";
    case "dual_throw":
      return "dual throw";
    case "dual_wield":
      return "dual wield";
    case "kick":
      return "kick";
    case "summon":
      return "summon";
    case "unarmed":
    default:
      return "unarmed";
  }
}

function getWeaponOptionSelectLabel(weapon: DamageWeaponOption) {
  if (weapon.sequenceHits?.length) {
    return `${weapon.itemName} (${getHandModeLabel(
      weapon.handMode,
      weapon
    )}): ${getWeaponSetLabel(weapon.weaponSet)} both weapons`;
  }

  if (weapon.slot === "feet") {
    return `${weapon.itemName} (${getHandModeLabel(
      weapon.handMode,
      weapon
    )}): ${getWeaponSetLabel(weapon.weaponSet)} boots`;
  }

  if (weapon.slot === "summon") {
    return `${weapon.itemName} (${getHandModeLabel(
      weapon.handMode,
      weapon
    )}): summon source`;
  }

  const handLabel = weapon.slot === "right" ? "right" : "left";

  return `${weapon.itemName} (${getHandModeLabel(
    weapon.handMode,
    weapon
  )}): ${getWeaponSetLabel(weapon.weaponSet)} ${handLabel}`;
}

function getSequenceWeaponSelectLabel(
  weapon: DamageWeaponOption,
  hitIndex: number
) {
  const hit = weapon.sequenceHits?.[hitIndex];
  if (!hit) {
    return `${weapon.label}: ${weapon.itemName}`;
  }

  const handLabel = hit.slot === "right" ? "right" : "left";

  return `${hit.itemName} (${getHandModeLabel(
    hit.handMode
  )}): ${getWeaponSetLabel(hit.weaponSet)} ${handLabel}`;
}

function getSequenceSecondaryWeaponSelectLabel(
  weapon: DamageWeaponOption,
  primaryWeaponId: string | null
) {
  const hits = weapon.sequenceHits ?? [];
  const primaryHitIndex = hits.findIndex(
    (hit) => hit.weaponId === primaryWeaponId
  );
  const secondaryHit =
    primaryHitIndex >= 0
      ? hits.find((_, index) => index !== primaryHitIndex)
      : hits[1];

  if (!secondaryHit) {
    return getWeaponOptionSelectLabel(weapon);
  }

  const handLabel = secondaryHit.slot === "right" ? "right" : "left";

  return `${secondaryHit.itemName} (${getHandModeLabel(
    secondaryHit.handMode
  )}): ${getWeaponSetLabel(secondaryHit.weaponSet)} ${handLabel}`;
}

function parseTransformationId(transformationId?: string | null) {
  if (!transformationId || transformationId === "none") {
    return { id: "none", level: "0" };
  }

  const [id, level] = transformationId.split(":");
  return {
    id,
    level: level || null,
  };
}

function getTransformationBonus(
  transformationOption: DamageTransformationOption | null,
  level: string | null
) {
  if (!transformationOption || transformationOption.id === "none" || !level) {
    return 0;
  }

  const numericLevel = Number(level);
  return (
    transformationOption.levelBonuses?.find(
      (bonus) => bonus.level === numericLevel
    )?.physicalBonusPercent ?? 0
  );
}

const DAMAGE_ELEMENTS = ["fire", "cold", "lightning", "magic"] as const;
const DAMAGE_TYPE_COLORS: Record<string, string> = {
  physical: STAT_COLORS.physicalDamageReduction,
  fire: STAT_COLORS.fire,
  cold: STAT_COLORS.cold,
  lightning: STAT_COLORS.lightning,
  poison: STAT_COLORS.poison,
  magic: STAT_COLORS.magic,
};

type AuraSelectionRow = {
  rowId: string;
  auraId: string;
  level: string;
  isParty: boolean;
};

let auraSelectionRowSequence = 0;

function createAuraSelectionRow(
  overrides: Partial<Omit<AuraSelectionRow, "rowId">> = {}
): AuraSelectionRow {
  auraSelectionRowSequence += 1;

  return {
    rowId: `aura-row-${auraSelectionRowSequence}`,
    auraId: "none",
    level: "0",
    isParty: false,
    ...overrides,
  };
}

function getAuraDefaultLevel(auraOption?: DamageAuraOption | null) {
  if (!auraOption || auraOption.id === "none") {
    return "0";
  }

  return String(auraOption.level ?? auraOption.levelOptions[0] ?? 1);
}

function normalizeAuraSelectionRows(
  rows: AuraSelectionRow[],
  auraOptions: DamageAuraOption[]
): AuraSelectionRow[] {
  const auraOptionById = new Map(
    auraOptions.map((auraOption) => [auraOption.id, auraOption])
  );
  const selectedRows = rows.flatMap((row) => {
    const auraOption = auraOptionById.get(row.auraId);

    if (!auraOption || auraOption.id === "none") {
      return [];
    }

    const level = auraOption.levelOptions.includes(Number(row.level))
      ? row.level
      : getAuraDefaultLevel(auraOption);

    return [{ ...row, auraId: auraOption.id, level }];
  });

  return [...selectedRows, createAuraSelectionRow()];
}

function getDamageTypeColor(damageType: string | null | undefined) {
  return (
    DAMAGE_TYPE_COLORS[damageType?.toLowerCase() ?? ""] ?? STAT_COLORS.zeroValue
  );
}

function getAuraLevelBonus(
  auraOption: DamageAuraOption | null,
  level: string | number | null,
  isParty = false
): DamageAuraOption["levelBonuses"][number] {
  const fallback: DamageAuraOption["levelBonuses"][number] = {
    level: 0,
    skillLevelBonus: 0,
    physicalBonusPercent: 0,
    elementalDamage: {},
  };

  if (!auraOption || auraOption.id === "none") {
    return fallback;
  }

  const requestedLevel = Number(level);
  const numericLevel =
    Number.isFinite(requestedLevel) && requestedLevel > 0
      ? requestedLevel
      : auraOption.level || auraOption.levelOptions[0] || 1;

  const bonuses = isParty
    ? (auraOption.partyLevelBonuses ?? auraOption.levelBonuses)
    : (auraOption.selfLevelBonuses ?? auraOption.levelBonuses);

  return (
    bonuses.find((bonus) => bonus.level === numericLevel) ?? {
      ...fallback,
      level: numericLevel,
    }
  );
}

function getAuraBonusScore(
  bonus: DamageAuraOption["levelBonuses"][number]
): number {
  const elementalScore = DAMAGE_ELEMENTS.reduce((total, element) => {
    const range = bonus.elementalDamage[element];
    return total + (range ? (range.min + range.max) / 2 : 0);
  }, 0);
  const poisonScore = bonus.poisonDamage?.total ?? 0;

  return (
    bonus.skillLevelBonus * 1000000 +
    bonus.physicalBonusPercent * 1000 +
    elementalScore +
    poisonScore
  );
}

function getResolvedAuraLevel(
  auraOption: DamageAuraOption,
  level: string | null,
  isParty: boolean
): number {
  const selectedBonus = getAuraLevelBonus(auraOption, level, isParty);
  return selectedBonus.level || auraOption.level || 1;
}

function findPrecomputedAuraProfile(
  damageCalculation: DamageCalculation,
  weaponId: string,
  skillId: string,
  auraOption: DamageAuraOption,
  isParty: boolean,
  level: string | null
): DamageProfile | null {
  const numericLevel = getResolvedAuraLevel(auraOption, level, isParty);
  const carrier = isParty ? "party" : "self";

  return (
    damageCalculation.profiles.find(
      (profile) =>
        profile.weaponId === weaponId &&
        profile.skillId === skillId &&
        profile.playerAuraId === auraOption.id &&
        profile.playerAuraCarrier === carrier &&
        profile.playerAuraLevel === numericLevel &&
        profile.transformationId === "none"
    ) ?? null
  );
}

function getElementalDelta(
  next: DamageProfile["totalElementalDamage"],
  previous: DamageProfile["totalElementalDamage"]
): DamageProfile["totalElementalDamage"] {
  const delta: DamageProfile["totalElementalDamage"] = {};

  DAMAGE_ELEMENTS.forEach((element) => {
    const nextRange = next[element];
    const previousRange = previous[element];
    const min = (nextRange?.min || 0) - (previousRange?.min || 0);
    const max = (nextRange?.max || 0) - (previousRange?.max || 0);

    if (min || max) {
      delta[element] = { min, max };
    }
  });

  return delta;
}

function getPoisonDelta(
  next: DamageAuraOption["levelBonuses"][number]["poisonDamage"],
  previous: DamageAuraOption["levelBonuses"][number]["poisonDamage"]
): DamageAuraOption["levelBonuses"][number]["poisonDamage"] | undefined {
  if (!next) {
    return undefined;
  }

  const min = next.damage.min - (previous?.damage.min || 0);
  const max = next.damage.max - (previous?.damage.max || 0);
  if (min <= 0 && max <= 0) {
    return undefined;
  }

  return {
    damage: { min, max },
    total: Math.max(0, next.total - (previous?.total || 0)),
    durationSeconds: next.durationSeconds,
  };
}

function createEmptyRange(): DamageRange {
  return { min: 0, max: 0 };
}

function addRange(base: DamageRange, addition?: DamageRange): DamageRange {
  if (!addition) {
    return base;
  }

  return {
    min: base.min + addition.min,
    max: base.max + addition.max,
  };
}

function scaleRange(range: DamageRange, multiplier: number): DamageRange {
  return {
    min: range.min * multiplier,
    max: range.max * multiplier,
  };
}

function hasRange(range?: DamageRange | null): range is DamageRange {
  return Boolean(range && (range.min > 0 || range.max > 0));
}

function getRangeColor(range: DamageRange | null | undefined, color: string) {
  return hasRange(range) ? color : STAT_COLORS.zeroValue;
}

function getPercentColor(value: number, color: string) {
  return value ? color : STAT_COLORS.zeroValue;
}

function getProfileSequenceHitCount(profile: DamageProfile) {
  return Math.max(1, profile.sequenceHits?.length ?? 1);
}

function getCombinedDamageLabel(profile: DamageProfile) {
  return profile.damageScope?.label
    ? `Combined Damage ${profile.damageScope.label}`
    : "Combined Damage";
}

function getDamageScopeCountLabel(profile: DamageProfile) {
  const scope = profile.damageScope;
  if (!scope?.count || !scope.countLabel) {
    return null;
  }

  return `${scope.count.toLocaleString()} ${scope.countLabel}`;
}

function averageRange(range: DamageRange) {
  return Number(((range.min + range.max) / 2).toFixed(1));
}

function buildDamageTotalsFromComponents(
  components: DamageProfile["damageComponents"]
): DamageProfile["damageTotals"] {
  const byElement: DamageProfile["damageTotals"]["byElement"] = {};
  let poisonDamage: DamageProfile["damageTotals"]["poisonDamage"];

  components.forEach((component) => {
    if (!hasRange(component.damage)) {
      return;
    }

    byElement[component.damageType] = addRange(
      byElement[component.damageType] || createEmptyRange(),
      component.damage
    );

    if (component.damageType === "poison") {
      const addition =
        component.poisonDamage ??
        ({
          total: Math.floor(averageRange(component.damage)),
          durationSeconds: 0,
        } satisfies NonNullable<DamageProfile["damageTotals"]["poisonDamage"]>);
      poisonDamage = poisonDamage
        ? {
            total: poisonDamage.total + addition.total,
            durationSeconds: Math.max(
              poisonDamage.durationSeconds,
              addition.durationSeconds
            ),
          }
        : addition;
    }
  });

  const instantDamage = components
    .filter((component) => component.timing === "instant")
    .reduce(
      (total, component) => addRange(total, component.damage),
      createEmptyRange()
    );
  const overTimeDamage = components
    .filter((component) => component.timing === "over_time")
    .reduce(
      (total, component) => addRange(total, component.damage),
      createEmptyRange()
    );
  const combinedDamage = addRange(instantDamage, overTimeDamage);

  return {
    instantDamage,
    overTimeDamage,
    combinedDamage,
    averageInstantDamage: averageRange(instantDamage),
    averageCombinedDamage: averageRange(combinedDamage),
    byElement,
    poisonDamage,
  };
}

function summaryFieldsFromComponents(
  components: DamageProfile["damageComponents"]
) {
  const damageTotals = buildDamageTotalsFromComponents(components);
  const totalElementalDamage: DamageProfile["totalElementalDamage"] = {};

  DAMAGE_ELEMENTS.forEach((element) => {
    const range = damageTotals.byElement[element];
    if (hasRange(range)) {
      totalElementalDamage[element] = range;
    }
  });

  return {
    damageTotals,
    totalPhysicalDamage: damageTotals.byElement.physical || createEmptyRange(),
    totalElementalDamage,
    totalPoisonDamage: damageTotals.poisonDamage,
    totalDamage: damageTotals.combinedDamage,
    averageHitDamage: damageTotals.averageCombinedDamage,
  };
}

type RuntimeDamageProfile = Omit<
  DamageProfile,
  | "activeAuras"
  | "breakdown"
  | "damageComponents"
  | "damageTotals"
  | "totalPhysicalDamage"
  | "totalElementalDamage"
  | "totalPoisonDamage"
  | "totalDamage"
  | "averageHitDamage"
  | "notes"
> &
  Partial<
    Pick<
      DamageProfile,
      | "activeAuras"
      | "breakdown"
      | "damageComponents"
      | "damageTotals"
      | "totalPhysicalDamage"
      | "totalElementalDamage"
      | "totalPoisonDamage"
      | "totalDamage"
      | "averageHitDamage"
      | "notes"
    >
  >;

function cloneRange(range?: DamageRange | null): DamageRange | undefined {
  if (!range) {
    return undefined;
  }

  const min = Number(range.min);
  const max = Number(range.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined;
  }

  return { min, max };
}

function getElementalDamageFromTotals(
  totals: DamageProfile["damageTotals"]
): DamageProfile["totalElementalDamage"] {
  const totalElementalDamage: DamageProfile["totalElementalDamage"] = {};

  DAMAGE_ELEMENTS.forEach((element) => {
    const range = cloneRange(totals.byElement[element]);
    if (hasRange(range)) {
      totalElementalDamage[element] = range;
    }
  });

  return totalElementalDamage;
}

function createLegacyDamageComponents(
  profile: RuntimeDamageProfile
): DamageProfile["damageComponents"] {
  const components: DamageProfile["damageComponents"] = [];
  const legacyNote =
    "Derived from a legacy damage profile summary; per-source component data was not present in this payload.";
  const physicalDamage = cloneRange(profile.totalPhysicalDamage);

  if (hasRange(physicalDamage)) {
    components.push({
      id: "legacy-summary:physical",
      label: "Physical damage",
      source: "unknown",
      damageType: "physical",
      timing: "instant",
      damage: physicalDamage,
      sourceRefs: [],
      notes: [legacyNote],
    });
  }

  DAMAGE_ELEMENTS.forEach((element) => {
    const damage = cloneRange(profile.totalElementalDamage?.[element]);
    if (!hasRange(damage)) {
      return;
    }

    components.push({
      id: `legacy-summary:${element}`,
      label: `${element[0].toUpperCase()}${element.slice(1)} damage`,
      source: "unknown",
      damageType: element,
      timing: "instant",
      damage,
      sourceRefs: [],
      notes: [legacyNote],
    });
  });

  const poisonDamage =
    profile.totalPoisonDamage ?? profile.damageTotals?.poisonDamage;
  if (poisonDamage && poisonDamage.total > 0) {
    components.push({
      id: "legacy-summary:poison",
      label: "Poison damage",
      source: "unknown",
      damageType: "poison",
      timing: "over_time",
      damage: {
        min: poisonDamage.total,
        max: poisonDamage.total,
      },
      poisonDamage,
      sourceRefs: [],
      notes: [legacyNote],
    });
  }

  const totalDamage = cloneRange(
    profile.totalDamage ?? profile.damageTotals?.combinedDamage
  );
  if (components.length === 0 && hasRange(totalDamage)) {
    components.push({
      id: "legacy-summary:combined",
      label: "Combined damage",
      source: "unknown",
      damageType: "physical",
      timing: "instant",
      damage: totalDamage,
      sourceRefs: [],
      notes: [legacyNote],
    });
  }

  return components;
}

function normalizeDamageTotals(
  profile: RuntimeDamageProfile,
  components: DamageProfile["damageComponents"]
): DamageProfile["damageTotals"] {
  const derivedTotals = buildDamageTotalsFromComponents(components);
  const existingTotals = profile.damageTotals;
  const combinedDamage =
    cloneRange(existingTotals?.combinedDamage) ??
    cloneRange(profile.totalDamage) ??
    derivedTotals.combinedDamage;
  const instantDamage =
    cloneRange(existingTotals?.instantDamage) ??
    (components.some((component) => component.timing === "instant")
      ? derivedTotals.instantDamage
      : combinedDamage);
  const overTimeDamage =
    cloneRange(existingTotals?.overTimeDamage) ?? derivedTotals.overTimeDamage;
  const byElement =
    existingTotals?.byElement &&
    Object.keys(existingTotals.byElement).length > 0
      ? existingTotals.byElement
      : derivedTotals.byElement;
  const poisonDamage =
    existingTotals?.poisonDamage ??
    profile.totalPoisonDamage ??
    derivedTotals.poisonDamage;

  return {
    instantDamage,
    overTimeDamage,
    combinedDamage,
    averageInstantDamage:
      existingTotals?.averageInstantDamage ?? averageRange(instantDamage),
    averageCombinedDamage:
      existingTotals?.averageCombinedDamage ??
      profile.averageHitDamage ??
      averageRange(combinedDamage),
    byElement,
    poisonDamage,
  };
}

function createFallbackBreakdown(
  profile: RuntimeDamageProfile,
  totalElementalDamage: DamageProfile["totalElementalDamage"],
  totalPoisonDamage: DamageProfile["totalPoisonDamage"]
): DamageProfile["breakdown"] {
  const physicalBonusPercent = profile.breakdown?.physicalBonusPercent;

  return {
    weaponDamage:
      cloneRange(profile.breakdown?.weaponDamage) ?? createEmptyRange(),
    flatPhysicalDamage:
      cloneRange(profile.breakdown?.flatPhysicalDamage) ?? createEmptyRange(),
    elementalDamage: profile.breakdown?.elementalDamage ?? totalElementalDamage,
    poisonDamage: profile.breakdown?.poisonDamage ?? totalPoisonDamage,
    physicalBonusPercent: {
      stat: physicalBonusPercent?.stat ?? 0,
      nonWeapon: physicalBonusPercent?.nonWeapon ?? 0,
      passive: physicalBonusPercent?.passive ?? 0,
      selectedSkill: physicalBonusPercent?.selectedSkill ?? 0,
      selectedSkillSynergy: physicalBonusPercent?.selectedSkillSynergy ?? 0,
      transformation: physicalBonusPercent?.transformation ?? 0,
      activeAuras: physicalBonusPercent?.activeAuras ?? 0,
      total: physicalBonusPercent?.total ?? 0,
    },
  };
}

function normalizeDamageProfile(profile: DamageProfile): DamageProfile {
  const runtimeProfile = profile as RuntimeDamageProfile;
  const damageComponents = Array.isArray(runtimeProfile.damageComponents)
    ? runtimeProfile.damageComponents
    : createLegacyDamageComponents(runtimeProfile);
  const damageTotals = normalizeDamageTotals(runtimeProfile, damageComponents);
  const totalElementalDamage =
    runtimeProfile.totalElementalDamage ??
    getElementalDamageFromTotals(damageTotals);
  const totalPoisonDamage =
    runtimeProfile.totalPoisonDamage ?? damageTotals.poisonDamage;

  return {
    ...profile,
    activeAuras: runtimeProfile.activeAuras ?? [],
    damageComponents,
    damageTotals,
    totalPhysicalDamage:
      cloneRange(runtimeProfile.totalPhysicalDamage) ??
      cloneRange(damageTotals.byElement.physical) ??
      createEmptyRange(),
    totalElementalDamage,
    totalPoisonDamage,
    totalDamage:
      cloneRange(runtimeProfile.totalDamage) ?? damageTotals.combinedDamage,
    averageHitDamage:
      runtimeProfile.averageHitDamage ?? damageTotals.averageCombinedDamage,
    breakdown: createFallbackBreakdown(
      runtimeProfile,
      totalElementalDamage,
      totalPoisonDamage
    ),
    notes: runtimeProfile.notes ?? [],
  };
}

function rescalePhysicalComponents(
  components: DamageProfile["damageComponents"],
  previousMultiplier: number,
  nextMultiplier: number
): DamageProfile["damageComponents"] {
  return components.map((component) => {
    if (component.damageType !== "physical" || component.timing !== "instant") {
      return component;
    }

    const baseDamage = component.baseDamage || {
      min:
        previousMultiplier === 0
          ? component.damage.min
          : component.damage.min / previousMultiplier,
      max:
        previousMultiplier === 0
          ? component.damage.max
          : component.damage.max / previousMultiplier,
    };

    return {
      ...component,
      baseDamage,
      damage: {
        min: Math.floor(baseDamage.min * nextMultiplier),
        max: Math.max(
          Math.floor(baseDamage.min * nextMultiplier),
          Math.floor(baseDamage.max * nextMultiplier)
        ),
      },
    };
  });
}

function buildAuraSummary(
  auraOption: DamageAuraOption,
  level: number,
  isParty: boolean
): ActiveAuraSummary {
  return {
    name: auraOption.name,
    level,
    source:
      auraOption.source === "character_skill" && !isParty
        ? "player_skill"
        : "manual",
    carrier: isParty ? "party" : "self",
  };
}

function replaceAuraSummary(
  activeAuras: ActiveAuraSummary[],
  aura: ActiveAuraSummary
) {
  return [
    ...activeAuras.filter((activeAura) => activeAura.name !== aura.name),
    aura,
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function applyAuraToProfile(
  profile: DamageProfile,
  auraOption: DamageAuraOption | null,
  isParty: boolean,
  level: string | null
): DamageProfile {
  if (!auraOption || auraOption.id === "none") {
    return profile;
  }

  const auraAppliesAsParty = isParty || profile.skillDamageMode === "summon";
  const selectedBonus = getAuraLevelBonus(
    auraOption,
    level,
    auraAppliesAsParty
  );
  const numericLevel = selectedBonus.level || auraOption.level || 1;
  const selectedAura = buildAuraSummary(
    auraOption,
    numericLevel,
    auraAppliesAsParty
  );
  const skillLevelNote =
    selectedBonus.skillLevelBonus > 0
      ? [
          `Selected aura all-skills bonus (+${selectedBonus.skillLevelBonus}) requires a precomputed profile`,
          "to update skill damage at this level.",
        ].join(" ")
      : null;
  const noteAdditions = [
    skillLevelNote,
    profile.skillDamageMode === "spell" ? SPELL_AURA_DAMAGE_NOTE : null,
    profile.skillDamageMode === "summon" && !isParty
      ? "Selected attack auras are applied to summon damage as party aura payloads."
      : null,
  ].filter((note): note is string => Boolean(note));
  const notes = [
    ...profile.notes,
    ...noteAdditions.filter((note) => !profile.notes.includes(note)),
  ];

  if (profile.skillDamageMode === "spell") {
    return {
      ...profile,
      key: `${profile.key}::aura:${auraOption.id}:${numericLevel}:${selectedAura.carrier}`,
      playerAuraId: auraOption.id,
      playerAuraCarrier: selectedAura.carrier,
      playerAuraLevel: numericLevel,
      selectedPlayerAura: {
        name: auraOption.name,
        level: numericLevel,
        carrier: selectedAura.carrier,
      },
      activeAuras: replaceAuraSummary(profile.activeAuras, selectedAura),
      notes,
    };
  }

  const existingAura = profile.activeAuras.find(
    (activeAura) => activeAura.name === auraOption.name
  );
  const existingBonus = existingAura
    ? getAuraLevelBonus(
        auraOption,
        existingAura.level,
        existingAura.carrier === "party"
      )
    : getAuraLevelBonus(null, null);
  const selectedBonusScore = getAuraBonusScore(selectedBonus);
  const existingBonusScore = getAuraBonusScore(existingBonus);
  const existingAuraIsStronger =
    Boolean(existingAura) &&
    (existingBonusScore > selectedBonusScore ||
      (existingBonusScore === selectedBonusScore &&
        existingBonus.level >= selectedBonus.level));
  const effectiveAura = existingAuraIsStronger ? existingAura! : selectedAura;
  const nextBonus = existingAuraIsStronger ? existingBonus : selectedBonus;
  const physicalBonusDelta =
    nextBonus.physicalBonusPercent - existingBonus.physicalBonusPercent;
  const elementalDelta = getElementalDelta(
    nextBonus.elementalDamage,
    existingBonus.elementalDamage
  );
  const poisonDelta = getPoisonDelta(
    nextBonus.poisonDamage,
    existingBonus.poisonDamage
  );
  const previousTotalBonus = profile.breakdown.physicalBonusPercent.total;
  const nextTotalBonus = previousTotalBonus + physicalBonusDelta;
  const previousMultiplier = 1 + previousTotalBonus / 100;
  const nextMultiplier = 1 + nextTotalBonus / 100;
  const sequenceHitCount = getProfileSequenceHitCount(profile);
  const auraDeltaComponents = DAMAGE_ELEMENTS.flatMap((element) => {
    const damage = elementalDelta[element];
    if (!hasRange(damage)) {
      return [];
    }
    const sequenceDamage =
      sequenceHitCount > 1 ? scaleRange(damage, sequenceHitCount) : damage;

    return [
      {
        id: `selected-aura:${auraOption.id}:${numericLevel}:${selectedAura.carrier}:${element}`,
        label: existingAura
          ? `${auraOption.name} ${element} delta`
          : `${auraOption.name} ${element}${
              sequenceHitCount > 1 ? ` (${sequenceHitCount} hits)` : ""
            }`,
        source: "aura" as const,
        damageType: element,
        timing: "instant" as const,
        damage: sequenceDamage,
        sourceRefs: [
          {
            table: "Skills.txt",
            row: auraOption.name,
            columns: [
              "aurastat*",
              "aurastatcalc*",
              "passivestat*",
              "passivecalc*",
            ],
          },
        ],
        notes: [],
      },
    ];
  });
  const poisonDeltaComponents = poisonDelta
    ? [
        {
          id: `selected-aura:${auraOption.id}:${numericLevel}:${selectedAura.carrier}:poison`,
          label: existingAura
            ? `${auraOption.name} poison delta`
            : `${auraOption.name} poison${
                sequenceHitCount > 1 ? ` (${sequenceHitCount} hits)` : ""
              }`,
          source: "aura" as const,
          damageType: "poison" as const,
          timing: "over_time" as const,
          damage:
            sequenceHitCount > 1
              ? scaleRange(poisonDelta.damage, sequenceHitCount)
              : poisonDelta.damage,
          poisonDamage: {
            total:
              sequenceHitCount > 1
                ? poisonDelta.total * sequenceHitCount
                : poisonDelta.total,
            durationSeconds: poisonDelta.durationSeconds,
          },
          sourceRefs: [
            {
              table: "Skills.txt",
              row: auraOption.name,
              columns: [
                "aurastat*",
                "aurastatcalc*",
                "EType",
                "EMin",
                "EMax",
                "EDmgSymPerCalc",
                "ELen",
              ],
            },
          ],
          notes: [],
        },
      ]
    : [];
  const damageComponents = [
    ...rescalePhysicalComponents(
      profile.damageComponents,
      previousMultiplier,
      nextMultiplier
    ),
    ...auraDeltaComponents,
    ...poisonDeltaComponents,
  ].filter((component) => hasRange(component.damage));
  const summary = summaryFieldsFromComponents(damageComponents);

  return {
    ...profile,
    key: `${profile.key}::aura:${auraOption.id}:${numericLevel}:${selectedAura.carrier}`,
    playerAuraId: auraOption.id,
    playerAuraCarrier: selectedAura.carrier,
    playerAuraLevel: numericLevel,
    selectedPlayerAura: {
      name: auraOption.name,
      level: numericLevel,
      carrier: selectedAura.carrier,
    },
    activeAuras: replaceAuraSummary(profile.activeAuras, effectiveAura),
    damageComponents,
    ...summary,
    breakdown: {
      ...profile.breakdown,
      elementalDamage: summary.totalElementalDamage,
      poisonDamage: summary.totalPoisonDamage,
      physicalBonusPercent: {
        ...profile.breakdown.physicalBonusPercent,
        activeAuras: Number(
          (
            profile.breakdown.physicalBonusPercent.activeAuras +
            physicalBonusDelta
          ).toFixed(1)
        ),
        total: Number(nextTotalBonus.toFixed(1)),
      },
    },
    notes,
  };
}

function applyTransformationToProfile(
  profile: DamageProfile,
  transformationOption: DamageTransformationOption | null,
  level: string | null
): DamageProfile {
  const transformationBonus = getTransformationBonus(
    transformationOption,
    level
  );

  if (!transformationOption || transformationOption.id === "none") {
    return profile;
  }

  const numericLevel = Number(level);

  if (profile.skillDamageMode === "spell") {
    const note =
      "Selected transformation is recorded for skill eligibility but does not add physical damage to direct spell profiles.";
    return {
      ...profile,
      key: `${profile.key}::${transformationOption.id}:${numericLevel}`,
      transformationId: `${transformationOption.id}:${numericLevel}`,
      selectedTransformation: {
        name: transformationOption.name,
        level: numericLevel,
      },
      notes: profile.notes.includes(note)
        ? profile.notes
        : [...profile.notes, note],
    };
  }

  const previousTotalBonus = profile.breakdown.physicalBonusPercent.total;
  const nextTotalBonus = previousTotalBonus + transformationBonus;
  const previousMultiplier = 1 + previousTotalBonus / 100;
  const nextMultiplier = 1 + nextTotalBonus / 100;
  const damageComponents = rescalePhysicalComponents(
    profile.damageComponents,
    previousMultiplier,
    nextMultiplier
  );
  const summary = summaryFieldsFromComponents(damageComponents);

  return {
    ...profile,
    key: `${profile.key}::${transformationOption.id}:${numericLevel}`,
    transformationId: `${transformationOption.id}:${numericLevel}`,
    selectedTransformation: {
      name: transformationOption.name,
      level: numericLevel,
    },
    damageComponents,
    ...summary,
    breakdown: {
      ...profile.breakdown,
      elementalDamage: summary.totalElementalDamage,
      poisonDamage: summary.totalPoisonDamage,
      physicalBonusPercent: {
        ...profile.breakdown.physicalBonusPercent,
        transformation: transformationBonus,
        total: Number(nextTotalBonus.toFixed(1)),
      },
    },
  };
}

function StatLine({
  label,
  value,
  color = STAT_COLORS.zeroValue,
  isLast = false,
}: {
  label: string;
  value: string;
  color?: string;
  isLast?: boolean;
}) {
  return (
    <Group
      justify="space-between"
      gap="xs"
      wrap="nowrap"
      style={{
        padding: "0.25rem 0",
        borderBottom: isLast
          ? "none"
          : "0.0625rem solid rgba(255,255,255,0.08)",
      }}
    >
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right" style={{ color }}>
        {value}
      </Text>
    </Group>
  );
}

function formatComponentEvidence(
  component: DamageProfile["damageComponents"][number]
) {
  const sourceRef = component.sourceRefs?.[0];
  if (!sourceRef) {
    return component.timing === "over_time" ? "over time" : "instant";
  }

  const row = sourceRef.row ? `:${sourceRef.row}` : "";
  const columns = sourceRef.columns.slice(0, 3).join(", ");
  const columnSuffix =
    sourceRef.columns.length > 3 ? `${columns}, ...` : columns;

  return `${component.timing === "over_time" ? "over time" : "instant"} - ${
    sourceRef.table
  }${row}${columnSuffix ? ` - ${columnSuffix}` : ""}`;
}

export function DamageCalculatorSection({
  damageCalculation,
  variant = "full",
  fullCalculatorUrl,
  onOpenFullCalculator,
}: DamageCalculatorSectionProps) {
  const isCompact = variant === "compact";
  const [weaponId, setWeaponId] = useState<string | null>(null);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [auraRows, setAuraRows] = useState<AuraSelectionRow[]>(() => [
    createAuraSelectionRow(),
  ]);
  const [transformationId, setTransformationId] = useState<string | null>(null);
  const [transformationLevel, setTransformationLevel] = useState<string | null>(
    null
  );
  const [notesExpanded, setNotesExpanded] = useState(false);

  useEffect(() => {
    const defaultAuraId =
      damageCalculation?.defaultSelection?.playerAuraId ?? null;
    const defaultAura = damageCalculation?.playerAuraOptions.find(
      (option) => option.id === defaultAuraId
    );

    setWeaponId(damageCalculation?.defaultSelection?.weaponId ?? null);
    setSkillId(damageCalculation?.defaultSelection?.skillId ?? null);
    setAuraRows(
      normalizeAuraSelectionRows(
        defaultAuraId && defaultAuraId !== "none"
          ? [
              createAuraSelectionRow({
                auraId: defaultAuraId,
                isParty:
                  damageCalculation?.defaultSelection?.playerAuraCarrier ===
                  "party",
                level: String(
                  damageCalculation?.defaultSelection?.playerAuraLevel ??
                    defaultAura?.level ??
                    defaultAura?.levelOptions[0] ??
                    1
                ),
              }),
            ]
          : [],
        damageCalculation?.playerAuraOptions ?? []
      )
    );

    if (!damageCalculation) {
      setTransformationId(null);
      setTransformationLevel(null);
      return;
    }

    const parsedTransformation = parseTransformationId(
      damageCalculation.defaultSelection?.transformationId
    );
    const transformationOption = damageCalculation.transformationOptions.find(
      (option) => option.id === parsedTransformation.id
    );

    setTransformationId(parsedTransformation.id);
    setTransformationLevel(
      parsedTransformation.id === "none"
        ? "0"
        : (parsedTransformation.level ??
            String(
              transformationOption?.level ??
                transformationOption?.levelOptions[0] ??
                1
            ))
    );
  }, [damageCalculation]);

  const selectedTransformationProfileId = useMemo(() => {
    if (!transformationId || transformationId === "none") {
      return "none";
    }

    if (!transformationLevel) {
      return null;
    }

    return `${transformationId}:${transformationLevel}`;
  }, [transformationId, transformationLevel]);

  const selectedTransformationOption = useMemo(() => {
    if (!damageCalculation || !transformationId) {
      return null;
    }

    return (
      damageCalculation.transformationOptions.find(
        (option) => option.id === transformationId
      ) ?? null
    );
  }, [damageCalculation, transformationId]);

  const selectedSkillOption = useMemo(() => {
    if (!damageCalculation || !skillId) {
      return null;
    }

    return (
      damageCalculation.skillOptions.find((option) => option.id === skillId) ??
      null
    );
  }, [damageCalculation, skillId]);

  const availableWeaponOptions = useMemo(() => {
    if (!damageCalculation) {
      return [];
    }

    if (!skillId) {
      return damageCalculation.weaponOptions;
    }

    const supportedWeaponIds = new Set(
      damageCalculation.profiles
        .filter(
          (profile) =>
            profile.skillId === skillId &&
            profile.playerAuraId === "none" &&
            profile.playerAuraCarrier === "self" &&
            profile.transformationId === "none"
        )
        .map((profile) => profile.weaponId)
    );

    return damageCalculation.weaponOptions.filter((weapon) =>
      supportedWeaponIds.has(weapon.id)
    );
  }, [damageCalculation, skillId]);

  useEffect(() => {
    if (availableWeaponOptions.length === 0) {
      if (weaponId !== null) {
        setWeaponId(null);
      }
      return;
    }

    if (
      !weaponId ||
      !availableWeaponOptions.some((weapon) => weapon.id === weaponId)
    ) {
      setWeaponId(availableWeaponOptions[0].id);
    }
  }, [availableWeaponOptions, weaponId]);

  const sequenceWeaponOptions = useMemo(
    () =>
      availableWeaponOptions.filter(
        (weapon) => (weapon.sequenceHits?.length ?? 0) >= 2
      ),
    [availableWeaponOptions]
  );
  const hasSequenceWeaponControls = sequenceWeaponOptions.length > 0;
  const requiresSequenceWeaponControls =
    hasSequenceWeaponControls &&
    availableWeaponOptions.length === sequenceWeaponOptions.length;
  const selectedWeaponOption = useMemo(
    () =>
      availableWeaponOptions.find((weapon) => weapon.id === weaponId) ?? null,
    [availableWeaponOptions, weaponId]
  );
  const selectedSequenceWeaponOption = selectedWeaponOption?.sequenceHits
    ?.length
    ? selectedWeaponOption
    : null;
  const nonSequenceWeaponOptions = useMemo(
    () =>
      availableWeaponOptions.filter(
        (weapon) => !weapon.sequenceHits || weapon.sequenceHits.length === 0
      ),
    [availableWeaponOptions]
  );
  const primaryWeaponValue =
    hasSequenceWeaponControls && selectedSequenceWeaponOption
      ? (selectedSequenceWeaponOption.sequenceHits?.[0]?.weaponId ??
        selectedSequenceWeaponOption.id)
      : weaponId;
  const pairableSequenceWeaponOptions = useMemo(() => {
    if (!primaryWeaponValue) {
      return requiresSequenceWeaponControls ? sequenceWeaponOptions : [];
    }

    if (requiresSequenceWeaponControls) {
      return sequenceWeaponOptions;
    }

    return sequenceWeaponOptions.filter((weapon) =>
      weapon.sequenceHits?.some((hit) => hit.weaponId === primaryWeaponValue)
    );
  }, [
    primaryWeaponValue,
    requiresSequenceWeaponControls,
    sequenceWeaponOptions,
  ]);
  const secondaryWeaponValue = selectedSequenceWeaponOption?.id ?? "none";
  const secondaryWeaponDisabled =
    !requiresSequenceWeaponControls &&
    pairableSequenceWeaponOptions.length === 0;

  const selectedSkillAllowedTransformationIds = useMemo(
    () => selectedSkillOption?.allowedTransformationIds ?? [],
    [selectedSkillOption]
  );
  const selectedSkillRequiresTransformation =
    selectedSkillAllowedTransformationIds.length > 0;
  const selectedSkillCanUseTransformation =
    selectedSkillOption?.canUseTransformation ??
    (selectedSkillOption?.name === "Basic Attack" ||
      selectedSkillRequiresTransformation);
  const selectedSkillDisallowsTransformation = Boolean(
    selectedSkillOption && !selectedSkillCanUseTransformation
  );

  const availableTransformationOptions = useMemo(() => {
    if (!damageCalculation) {
      return [];
    }

    if (selectedSkillDisallowsTransformation) {
      return damageCalculation.transformationOptions.filter(
        (option) => option.id === "none"
      );
    }

    if (!selectedSkillRequiresTransformation) {
      return damageCalculation.transformationOptions;
    }

    return damageCalculation.transformationOptions.filter((option) =>
      selectedSkillAllowedTransformationIds.includes(option.id)
    );
  }, [
    damageCalculation,
    selectedSkillAllowedTransformationIds,
    selectedSkillDisallowsTransformation,
    selectedSkillRequiresTransformation,
  ]);

  const compactRequiredTransformationOption = useMemo(() => {
    if (
      !isCompact ||
      !damageCalculation ||
      !selectedSkillRequiresTransformation
    ) {
      return null;
    }

    return (
      damageCalculation.transformationOptions.find((option) =>
        selectedSkillAllowedTransformationIds.includes(option.id)
      ) ?? null
    );
  }, [
    damageCalculation,
    isCompact,
    selectedSkillAllowedTransformationIds,
    selectedSkillRequiresTransformation,
  ]);

  const effectiveTransformationOption = selectedSkillDisallowsTransformation
    ? null
    : isCompact
      ? compactRequiredTransformationOption
      : selectedTransformationOption;
  const effectiveTransformationLevel = selectedSkillDisallowsTransformation
    ? "0"
    : isCompact
      ? compactRequiredTransformationOption
        ? String(
            compactRequiredTransformationOption.level ||
              compactRequiredTransformationOption.levelOptions[0] ||
              1
          )
        : "0"
      : transformationLevel;
  const transformationSelectValue = selectedSkillDisallowsTransformation
    ? "none"
    : transformationId;
  const transformationLevelSelectValue = selectedSkillDisallowsTransformation
    ? "0"
    : transformationLevel;

  const auraOptionById = useMemo(
    () =>
      new Map(
        damageCalculation?.playerAuraOptions.map((auraOption) => [
          auraOption.id,
          auraOption,
        ]) ?? []
      ),
    [damageCalculation]
  );

  const selectedAuraRows = useMemo(
    () =>
      auraRows.flatMap((row) => {
        const auraOption = auraOptionById.get(row.auraId);

        return auraOption && auraOption.id !== "none"
          ? [{ row, auraOption }]
          : [];
      }),
    [auraOptionById, auraRows]
  );

  useEffect(() => {
    if (!damageCalculation || !selectedSkillOption) {
      return;
    }

    if (selectedSkillRequiresTransformation) {
      const nextTransformationId =
        selectedSkillAllowedTransformationIds.includes(transformationId || "")
          ? transformationId
          : selectedSkillAllowedTransformationIds[0];
      const transformationOption = damageCalculation.transformationOptions.find(
        (option) => option.id === nextTransformationId
      );

      if (nextTransformationId && nextTransformationId !== transformationId) {
        setTransformationId(nextTransformationId);
      }

      if (
        nextTransformationId &&
        (!transformationLevel || transformationLevel === "0")
      ) {
        setTransformationLevel(
          String(
            transformationOption?.level ??
              transformationOption?.levelOptions[0] ??
              1
          )
        );
      }

      return;
    }

    if (selectedSkillDisallowsTransformation) {
      setTransformationId("none");
      setTransformationLevel("0");
    }
  }, [
    damageCalculation,
    selectedSkillAllowedTransformationIds,
    selectedSkillDisallowsTransformation,
    selectedSkillOption,
    selectedSkillRequiresTransformation,
    transformationId,
    transformationLevel,
  ]);

  const updateAuraRows = (
    updater: (currentRows: AuraSelectionRow[]) => AuraSelectionRow[]
  ) => {
    setAuraRows((currentRows) =>
      normalizeAuraSelectionRows(
        updater(currentRows),
        damageCalculation?.playerAuraOptions ?? []
      )
    );
  };

  const handlePlayerAuraChange = (rowId: string, value: string | null) => {
    updateAuraRows((currentRows) =>
      currentRows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }

        const auraId = value || "none";
        const auraOption = auraOptionById.get(auraId);

        if (!auraOption || auraOption.id === "none") {
          return {
            ...row,
            auraId: "none",
            level: "0",
            isParty: false,
          };
        }

        return {
          ...row,
          auraId,
          level: getAuraDefaultLevel(auraOption),
        };
      })
    );
  };

  const handlePlayerAuraLevelChange = (rowId: string, value: string | null) => {
    updateAuraRows((currentRows) =>
      currentRows.map((row) =>
        row.rowId === rowId ? { ...row, level: value || "0" } : row
      )
    );
  };

  const handlePlayerAuraPartyChange = (rowId: string, checked: boolean) => {
    updateAuraRows((currentRows) =>
      currentRows.map((row) =>
        row.rowId === rowId ? { ...row, isParty: checked } : row
      )
    );
  };

  const handleTransformationChange = (value: string | null) => {
    setTransformationId(value);

    if (!value || value === "none") {
      setTransformationLevel("0");
      return;
    }

    const transformationOption = damageCalculation?.transformationOptions.find(
      (option) => option.id === value
    );

    setTransformationLevel(
      String(
        transformationOption?.level ??
          transformationOption?.levelOptions[0] ??
          1
      )
    );
  };

  const handlePrimaryWeaponChange = (value: string | null) => {
    if (!value) {
      return;
    }

    if (requiresSequenceWeaponControls) {
      setWeaponId(value);
      return;
    }

    if (selectedSequenceWeaponOption) {
      const matchingSequence = sequenceWeaponOptions.find((weapon) =>
        weapon.sequenceHits?.some((hit) => hit.weaponId === value)
      );

      setWeaponId(matchingSequence?.id ?? value);
      return;
    }

    setWeaponId(value);
  };

  const handleSecondaryWeaponChange = (value: string | null) => {
    if (requiresSequenceWeaponControls) {
      if (value) {
        setWeaponId(value);
      }
      return;
    }

    if (!value || value === "none") {
      setWeaponId(primaryWeaponValue);
      return;
    }

    setWeaponId(value);
  };

  const selectedProfile = useMemo(() => {
    if (
      !damageCalculation ||
      !weaponId ||
      !skillId ||
      (!isCompact && !selectedTransformationProfileId)
    ) {
      return null;
    }

    const baseProfile = damageCalculation.profiles.find(
      (profile) =>
        profile.weaponId === weaponId &&
        profile.skillId === skillId &&
        profile.playerAuraId === "none" &&
        profile.playerAuraCarrier === "self" &&
        profile.transformationId === "none"
    );

    if (!baseProfile) {
      return null;
    }

    const normalizedBaseProfile = normalizeDamageProfile(baseProfile);
    const effectiveAuraRows = isCompact ? [] : selectedAuraRows;
    const precomputedAuraProfileIndex = effectiveAuraRows.findIndex(
      ({ row, auraOption }) => {
        const auraAppliesAsParty =
          row.isParty || normalizedBaseProfile.skillDamageMode === "summon";
        const selectedBonus = getAuraLevelBonus(
          auraOption,
          row.level,
          auraAppliesAsParty
        );

        return (
          selectedBonus.skillLevelBonus > 0 ||
          Boolean(selectedBonus.poisonDamage)
        );
      }
    );
    const precomputedAuraProfileRow =
      precomputedAuraProfileIndex >= 0
        ? effectiveAuraRows[precomputedAuraProfileIndex]
        : undefined;
    const precomputedAuraProfile = precomputedAuraProfileRow
      ? findPrecomputedAuraProfile(
          damageCalculation,
          weaponId,
          skillId,
          precomputedAuraProfileRow.auraOption,
          precomputedAuraProfileRow.row.isParty ||
            normalizedBaseProfile.skillDamageMode === "summon",
          precomputedAuraProfileRow.row.level
        )
      : null;
    const auraBaseProfile = precomputedAuraProfile
      ? normalizeDamageProfile(precomputedAuraProfile)
      : normalizedBaseProfile;
    const clientAppliedAuraRows = precomputedAuraProfile
      ? effectiveAuraRows.filter(
          (_, index) => index !== precomputedAuraProfileIndex
        )
      : effectiveAuraRows;
    const auraAdjustedProfile = clientAppliedAuraRows.reduce(
      (profile, { row, auraOption }) =>
        applyAuraToProfile(profile, auraOption, row.isParty, row.level),
      auraBaseProfile
    );

    return normalizeDamageProfile(
      applyTransformationToProfile(
        auraAdjustedProfile,
        effectiveTransformationOption,
        effectiveTransformationLevel
      )
    );
  }, [
    damageCalculation,
    isCompact,
    weaponId,
    skillId,
    selectedAuraRows,
    selectedTransformationProfileId,
    effectiveTransformationOption,
    effectiveTransformationLevel,
  ]);

  const skillSelectOptions = useMemo(
    () =>
      damageCalculation?.skillOptions.map((skill) => {
        const selectedSkillLevel =
          skill.id === skillId && selectedProfile
            ? selectedProfile.skillLevel
            : skill.level;

        return {
          value: skill.id,
          label:
            skill.name === "Basic Attack"
              ? "Basic Attack"
              : `${skill.name} (${
                  skill.damageMode === "spell"
                    ? "spell "
                    : skill.damageMode === "summon"
                      ? "summon "
                      : ""
                }lvl ${selectedSkillLevel})`,
        };
      }) ?? [],
    [damageCalculation, selectedProfile, skillId]
  );

  const skillSelect = (
    <Select
      label="Skill"
      value={skillId}
      onChange={setSkillId}
      data={skillSelectOptions}
      allowDeselect={false}
    />
  );
  const weaponSelect = hasSequenceWeaponControls ? (
    <>
      <Select
        label="Weapon"
        value={requiresSequenceWeaponControls ? weaponId : primaryWeaponValue}
        onChange={handlePrimaryWeaponChange}
        data={
          requiresSequenceWeaponControls
            ? sequenceWeaponOptions.map((weapon) => ({
                value: weapon.id,
                label: getSequenceWeaponSelectLabel(weapon, 0),
              }))
            : nonSequenceWeaponOptions.map((weapon) => ({
                value: weapon.id,
                label: getWeaponOptionSelectLabel(weapon),
              }))
        }
        allowDeselect={false}
      />
      <Select
        label="Secondary Weapon"
        value={secondaryWeaponValue}
        onChange={handleSecondaryWeaponChange}
        data={[
          ...(requiresSequenceWeaponControls
            ? []
            : [{ value: "none", label: "No secondary weapon" }]),
          ...pairableSequenceWeaponOptions.map((weapon) => ({
            value: weapon.id,
            label: getSequenceSecondaryWeaponSelectLabel(
              weapon,
              primaryWeaponValue
            ),
          })),
        ]}
        disabled={secondaryWeaponDisabled}
        allowDeselect={false}
      />
    </>
  ) : (
    <Select
      label="Weapon"
      value={weaponId}
      onChange={setWeaponId}
      data={availableWeaponOptions.map((weapon) => ({
        value: weapon.id,
        label: getWeaponOptionSelectLabel(weapon),
      }))}
      allowDeselect={false}
    />
  );
  const fullCalculatorButton = fullCalculatorUrl ? (
    <Button
      component="a"
      href={fullCalculatorUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpenFullCalculator}
      leftSection={<IconCalculator size={18} />}
    >
      Open Calculator
    </Button>
  ) : null;

  return (
    <Card radius="md" shadow="md" padding="md">
      <Card.Section
        style={{
          backgroundColor: "rgb(44, 45, 50)",
          borderBottom: "0.109375rem solid rgb(55, 58, 64)",
          padding: "0.5rem 0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <Text fw={500}>Damage Calculator</Text>
      </Card.Section>

      {!damageCalculation ? (
        <Group justify="space-between" align="center" gap="md">
          <Text size="sm" c="dimmed">
            Damage data is unavailable for this character.
          </Text>
          {isCompact ? fullCalculatorButton : null}
        </Group>
      ) : isCompact ? (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: hasSequenceWeaponControls ? 3 : 2 }}>
            {skillSelect}
            {weaponSelect}
          </SimpleGrid>

          {selectedProfile ? (
            <Card
              withBorder
              padding="sm"
              style={{
                borderTop: `0.1875rem solid ${STAT_COLORS.combinedDamage}`,
              }}
            >
              <Group justify="space-between" align="center" gap="md">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    {getCombinedDamageLabel(selectedProfile)}
                  </Text>
                  <Text
                    size="xl"
                    fw={700}
                    style={{
                      color: getRangeColor(
                        selectedProfile.damageTotals.combinedDamage,
                        STAT_COLORS.combinedDamageText
                      ),
                    }}
                  >
                    {formatRange(selectedProfile.damageTotals.combinedDamage)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Avg{" "}
                    {selectedProfile.damageTotals.averageCombinedDamage.toLocaleString()}
                  </Text>
                  {getDamageScopeCountLabel(selectedProfile) ? (
                    <Text size="xs" c="dimmed">
                      {getDamageScopeCountLabel(selectedProfile)}
                    </Text>
                  ) : null}
                </div>
                {fullCalculatorButton}
              </Group>
            </Card>
          ) : (
            <Group justify="space-between" align="center" gap="md">
              <Text size="sm" c="dimmed">
                No profile matched the selected weapon and skill.
              </Text>
              {fullCalculatorButton}
            </Group>
          )}
        </Stack>
      ) : (
        <Stack gap="md">
          <SimpleGrid
            cols={{ base: 1, sm: 2, lg: hasSequenceWeaponControls ? 5 : 4 }}
          >
            {skillSelect}
            {weaponSelect}

            <Select
              label="Transformation"
              value={transformationSelectValue}
              onChange={handleTransformationChange}
              data={availableTransformationOptions.map((option) => ({
                value: option.id,
                label: option.name,
              }))}
              disabled={selectedSkillDisallowsTransformation}
              allowDeselect={false}
            />

            <Select
              label="Transform Level"
              value={transformationLevelSelectValue}
              onChange={setTransformationLevel}
              data={
                selectedTransformationOption?.levelOptions.map((level) => ({
                  value: String(level),
                  label: level === 0 ? "N/A" : String(level),
                })) ?? []
              }
              disabled={
                !transformationId ||
                transformationId === "none" ||
                selectedSkillDisallowsTransformation
              }
              allowDeselect={false}
            />
          </SimpleGrid>

          <Card withBorder padding="sm">
            <Stack gap="sm">
              <Group justify="space-between" gap="xs">
                <Text fw={600}>Selected Auras</Text>
                <Text size="xs" c="dimmed">
                  Selecting an aura adds another row; choose No aura to remove
                  one.
                </Text>
              </Group>

              {auraRows.map((row, index) => {
                const auraOption = auraOptionById.get(row.auraId) ?? null;
                const auraIsSelected = Boolean(
                  auraOption && auraOption.id !== "none"
                );

                return (
                  <SimpleGrid
                    key={row.rowId}
                    cols={{ base: 1, sm: 3 }}
                    spacing="sm"
                  >
                    <Select
                      label={index === 0 ? "Aura" : "Additional Aura"}
                      value={row.auraId}
                      onChange={(value) =>
                        handlePlayerAuraChange(row.rowId, value)
                      }
                      data={damageCalculation.playerAuraOptions.map((aura) => ({
                        value: aura.id,
                        label:
                          aura.id === "none"
                            ? aura.name
                            : aura.source === "character_skill"
                              ? `${aura.name} (owned lvl ${aura.level})`
                              : aura.name,
                      }))}
                      allowDeselect={false}
                    />

                    <Select
                      label="Aura Level"
                      value={row.level}
                      onChange={(value) =>
                        handlePlayerAuraLevelChange(row.rowId, value)
                      }
                      data={
                        auraOption?.levelOptions.map((level) => ({
                          value: String(level),
                          label: level === 0 ? "N/A" : String(level),
                        })) ?? []
                      }
                      disabled={!auraIsSelected}
                      allowDeselect={false}
                    />

                    <Checkbox
                      label="Party aura"
                      checked={row.isParty}
                      onChange={(event) =>
                        handlePlayerAuraPartyChange(
                          row.rowId,
                          event.currentTarget.checked
                        )
                      }
                      disabled={!auraIsSelected}
                      mt={{ base: 0, sm: 28 }}
                    />
                  </SimpleGrid>
                );
              })}
            </Stack>
          </Card>

          {selectedProfile ? (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
                <Card
                  withBorder
                  padding="sm"
                  style={{
                    borderTop: `0.1875rem solid ${STAT_COLORS.combinedDamage}`,
                  }}
                >
                  <Text size="xs" c="dimmed" tt="uppercase">
                    {getCombinedDamageLabel(selectedProfile)}
                  </Text>
                  <Text
                    size="lg"
                    fw={700}
                    style={{
                      color: getRangeColor(
                        selectedProfile.damageTotals.combinedDamage,
                        STAT_COLORS.combinedDamageText
                      ),
                    }}
                  >
                    {formatRange(selectedProfile.damageTotals.combinedDamage)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Avg{" "}
                    {selectedProfile.damageTotals.averageCombinedDamage.toLocaleString()}
                  </Text>
                  {getDamageScopeCountLabel(selectedProfile) ? (
                    <Text size="xs" c="dimmed">
                      {getDamageScopeCountLabel(selectedProfile)}
                    </Text>
                  ) : null}
                </Card>

                <Card
                  withBorder
                  padding="sm"
                  style={{
                    borderTop: `0.1875rem solid ${STAT_COLORS.increasedAttackSpeed}`,
                  }}
                >
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Instant Damage
                  </Text>
                  <Text
                    size="lg"
                    fw={700}
                    style={{
                      color: getRangeColor(
                        selectedProfile.damageTotals.instantDamage,
                        STAT_COLORS.increasedAttackSpeed
                      ),
                    }}
                  >
                    {formatRange(selectedProfile.damageTotals.instantDamage)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Avg{" "}
                    {selectedProfile.damageTotals.averageInstantDamage.toLocaleString()}
                  </Text>
                </Card>

                <Card
                  withBorder
                  padding="sm"
                  style={{
                    borderTop: `0.1875rem solid ${STAT_COLORS.physicalDamageReduction}`,
                  }}
                >
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Physical
                  </Text>
                  <Text
                    size="lg"
                    fw={700}
                    style={{
                      color: getRangeColor(
                        selectedProfile.totalPhysicalDamage,
                        STAT_COLORS.physicalDamageReduction
                      ),
                    }}
                  >
                    {formatRange(selectedProfile.totalPhysicalDamage)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    +{selectedProfile.breakdown.physicalBonusPercent.total}%
                    total bonus
                  </Text>
                </Card>

                <Card
                  withBorder
                  padding="sm"
                  style={{
                    borderTop: `0.1875rem solid ${STAT_COLORS.fasterCastRate}`,
                  }}
                >
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Active Auras
                  </Text>
                  <Group gap={6} mt={6}>
                    {selectedProfile.activeAuras.length > 0 ? (
                      selectedProfile.activeAuras.map((aura) => (
                        <Badge
                          key={`${aura.name}-${aura.source}-${aura.carrier}`}
                          variant="light"
                          style={{
                            color: STAT_COLORS.fasterCastRate,
                            borderColor: STAT_COLORS.fasterCastRate,
                          }}
                        >
                          {aura.name} {aura.level}
                          {aura.carrier === "party" ? " party" : ""}
                        </Badge>
                      ))
                    ) : (
                      <Text size="sm" c="dimmed">
                        None
                      </Text>
                    )}
                  </Group>
                </Card>

                <Card
                  withBorder
                  padding="sm"
                  style={{ borderTop: `0.1875rem solid ${STAT_COLORS.poison}` }}
                >
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Over-Time
                  </Text>
                  {selectedProfile.totalPoisonDamage ||
                  selectedProfile.damageTotals.overTimeDamage.max > 0 ? (
                    <>
                      <Text
                        size="lg"
                        fw={700}
                        style={{
                          color: getRangeColor(
                            selectedProfile.damageTotals.overTimeDamage,
                            STAT_COLORS.poison
                          ),
                        }}
                      >
                        {formatRange(
                          selectedProfile.damageTotals.overTimeDamage
                        )}
                      </Text>
                      {selectedProfile.totalPoisonDamage ? (
                        <Text size="xs" c="dimmed">
                          poison total{" "}
                          {selectedProfile.totalPoisonDamage.total.toLocaleString()}{" "}
                          over{" "}
                          {selectedProfile.totalPoisonDamage.durationSeconds}s
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text size="sm" c="dimmed" mt="xs">
                      None
                    </Text>
                  )}
                </Card>
              </SimpleGrid>

              <Card withBorder padding="sm">
                <Text fw={600} mb="xs">
                  Damage Components
                </Text>
                <Stack gap={8}>
                  {selectedProfile.damageComponents.length > 0 ? (
                    selectedProfile.damageComponents.map((component) => {
                      const damageTypeColor = getDamageTypeColor(
                        component.damageType
                      );

                      return (
                        <Group
                          key={component.id}
                          justify="space-between"
                          align="flex-start"
                          gap="sm"
                          wrap="nowrap"
                        >
                          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                            <Group gap={6} wrap="wrap">
                              <Badge
                                size="xs"
                                variant="outline"
                                style={{
                                  color: damageTypeColor,
                                  borderColor: damageTypeColor,
                                }}
                              >
                                {component.damageType}
                              </Badge>
                              <Badge size="xs" variant="outline">
                                {component.source}
                              </Badge>
                              <Text
                                size="sm"
                                fw={500}
                                style={{ wordBreak: "break-word" }}
                              >
                                {component.label}
                              </Text>
                            </Group>
                            <Text
                              size="xs"
                              c="dimmed"
                              style={{ wordBreak: "break-word" }}
                            >
                              {formatComponentEvidence(component)}
                            </Text>
                          </Stack>
                          <Text
                            size="sm"
                            fw={600}
                            ta="right"
                            style={{
                              flexShrink: 0,
                              color: getRangeColor(
                                component.damage,
                                damageTypeColor
                              ),
                            }}
                          >
                            {formatRange(component.damage)}
                          </Text>
                        </Group>
                      );
                    })
                  ) : (
                    <Text size="sm" c="dimmed">
                      No modeled damage components.
                    </Text>
                  )}
                </Stack>
              </Card>

              <SimpleGrid cols={{ base: 1, lg: 2 }}>
                <Card withBorder padding="sm">
                  <Text fw={600} mb="xs">
                    Elemental Damage
                  </Text>
                  <Stack gap={6}>
                    {(["fire", "cold", "lightning", "magic"] as const).map(
                      (element, index, elements) => {
                        const range =
                          selectedProfile.totalElementalDamage[element];
                        const color = getDamageTypeColor(element);

                        return (
                          <StatLine
                            key={element}
                            label={element[0].toUpperCase() + element.slice(1)}
                            value={formatRange(range)}
                            color={getRangeColor(range, color)}
                            isLast={index === elements.length - 1}
                          />
                        );
                      }
                    )}
                  </Stack>
                </Card>

                <Card withBorder padding="sm">
                  <Text fw={600} mb="xs">
                    Physical Breakdown
                  </Text>
                  <Stack gap={6}>
                    <StatLine
                      label={
                        selectedProfile.skillDamageMode === "summon"
                          ? "Summon base"
                          : "Weapon damage"
                      }
                      value={formatRange(
                        selectedProfile.breakdown.weaponDamage
                      )}
                      color={getRangeColor(
                        selectedProfile.breakdown.weaponDamage,
                        STAT_COLORS.physicalDamageReduction
                      )}
                    />
                    <StatLine
                      label="Flat damage"
                      value={formatRange(
                        selectedProfile.breakdown.flatPhysicalDamage
                      )}
                      color={getRangeColor(
                        selectedProfile.breakdown.flatPhysicalDamage,
                        STAT_COLORS.physicalDamageReduction
                      )}
                    />
                    <StatLine
                      label="Stat bonus"
                      value={`${selectedProfile.breakdown.physicalBonusPercent.stat}%`}
                      color={getPercentColor(
                        selectedProfile.breakdown.physicalBonusPercent.stat,
                        STAT_COLORS.physicalDamageReduction
                      )}
                    />
                    <StatLine
                      label="Non-weapon ED"
                      value={`${selectedProfile.breakdown.physicalBonusPercent.nonWeapon}%`}
                      color={getPercentColor(
                        selectedProfile.breakdown.physicalBonusPercent
                          .nonWeapon,
                        STAT_COLORS.physicalDamageReduction
                      )}
                    />
                    <StatLine
                      label="Passive bonuses"
                      value={`${selectedProfile.breakdown.physicalBonusPercent.passive}%`}
                      color={getPercentColor(
                        selectedProfile.breakdown.physicalBonusPercent.passive,
                        STAT_COLORS.physicalDamageReduction
                      )}
                    />
                    <StatLine
                      label="Selected skill"
                      value={`${selectedProfile.breakdown.physicalBonusPercent.selectedSkill}%`}
                      color={getPercentColor(
                        selectedProfile.breakdown.physicalBonusPercent
                          .selectedSkill,
                        STAT_COLORS.physicalDamageReduction
                      )}
                    />
                    <StatLine
                      label="Skill synergies"
                      value={`${selectedProfile.breakdown.physicalBonusPercent.selectedSkillSynergy}%`}
                      color={getPercentColor(
                        selectedProfile.breakdown.physicalBonusPercent
                          .selectedSkillSynergy,
                        STAT_COLORS.physicalDamageReduction
                      )}
                    />
                    <StatLine
                      label="Transformation"
                      value={`${selectedProfile.breakdown.physicalBonusPercent.transformation}%`}
                      color={getPercentColor(
                        selectedProfile.breakdown.physicalBonusPercent
                          .transformation,
                        STAT_COLORS.physicalDamageReduction
                      )}
                    />
                    <StatLine
                      label="Auras"
                      value={`${selectedProfile.breakdown.physicalBonusPercent.activeAuras}%`}
                      color={getPercentColor(
                        selectedProfile.breakdown.physicalBonusPercent
                          .activeAuras,
                        STAT_COLORS.physicalDamageReduction
                      )}
                      isLast
                    />
                  </Stack>
                </Card>
              </SimpleGrid>

              {!isCompact &&
                (selectedProfile.notes.length > 0 ||
                  Boolean(selectedProfile.damageScope?.note) ||
                  damageCalculation.notes.length > 0) && (
                  <>
                    <Divider />
                    <Stack gap="xs">
                      <Group justify="space-between" gap="xs">
                        <Text size="sm" fw={600}>
                          Damage model notes
                        </Text>
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() =>
                            setNotesExpanded((expanded) => !expanded)
                          }
                          rightSection={
                            <IconChevronDown
                              size={14}
                              style={{
                                transform: notesExpanded
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                                transition: "transform 150ms ease",
                              }}
                            />
                          }
                          aria-expanded={notesExpanded}
                        >
                          {notesExpanded ? "Show less" : "Read more"}
                        </Button>
                      </Group>
                      <Collapse in={notesExpanded}>
                        <Stack gap="xs">
                          <Text size="sm" c="dimmed">
                            This calculator is intended to be a close model, not
                            a perfect guarantee. If you notice a significant
                            difference from the damage you expect,{" "}
                            <Anchor
                              href={BUG_REPORT_CHANNEL_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              make a #bug-report
                            </Anchor>
                            .
                          </Text>
                          {selectedProfile.damageScope?.note ? (
                            <Text size="sm" c="dimmed">
                              {selectedProfile.damageScope.note}
                            </Text>
                          ) : null}
                          {selectedProfile.notes.map((note) => (
                            <Text key={note} size="sm" c="dimmed">
                              {note}
                            </Text>
                          ))}
                          {damageCalculation.notes.map((note) => (
                            <Text key={note} size="sm" c="dimmed">
                              {note}
                            </Text>
                          ))}
                        </Stack>
                      </Collapse>
                    </Stack>
                  </>
                )}
            </>
          ) : (
            <Text size="sm" c="dimmed">
              No profile matched the selected options.
            </Text>
          )}
        </Stack>
      )}
    </Card>
  );
}
