import type { DamageAuraOption, DamageProfile, DamageRange } from "../types";

const BASE_CRITICAL_STRIKE_CHANCE_CAP = 75;

const STRIKE_DAMAGE_SOURCE_REFS = [
  {
    table: "Skills.txt / item stats",
    columns: ["Critical / Deadly Strike"],
  },
];

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

function roundStrikeValue(value: number) {
  return Number(value.toFixed(3));
}

export function rescalePhysicalComponents(
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

export function applyStrikeModifierDelta(
  strike: DamageProfile["strikeBreakdowns"][number],
  next: DamageAuraOption["levelBonuses"][number]["strikeModifiers"],
  previous: DamageAuraOption["levelBonuses"][number]["strikeModifiers"]
): DamageProfile["strikeBreakdowns"][number] {
  const rawCriticalChance = Math.max(
    0,
    strike.rawCriticalChance + next.criticalChance - previous.criticalChance
  );
  const criticalChance = Math.min(
    BASE_CRITICAL_STRIKE_CHANCE_CAP,
    rawCriticalChance
  );
  const rawMaxDeadlyStrikeChance = Math.max(
    0,
    strike.rawMaxDeadlyStrikeChance +
      next.maxDeadlyStrikeChance -
      previous.maxDeadlyStrikeChance
  );
  const maxDeadlyStrikeChance = Math.min(100, rawMaxDeadlyStrikeChance);
  const rawDeadlyStrikeChance = Math.max(
    0,
    strike.rawDeadlyStrikeChance +
      next.deadlyStrikeChance -
      previous.deadlyStrikeChance
  );
  const deadlyStrikeChance = Math.min(
    maxDeadlyStrikeChance,
    rawDeadlyStrikeChance
  );
  const criticalMultiplier = Math.max(
    1,
    strike.criticalMultiplier +
      (next.criticalMultiplierBonus - previous.criticalMultiplierBonus) / 100
  );
  const deadlyStrikeMultiplier = Math.max(
    1,
    strike.deadlyStrikeMultiplier +
      (next.deadlyStrikeMultiplierBonus -
        previous.deadlyStrikeMultiplierBonus) /
        100
  );

  return {
    ...strike,
    rawCriticalChance: roundStrikeValue(rawCriticalChance),
    criticalChance: roundStrikeValue(criticalChance),
    criticalMultiplier: roundStrikeValue(criticalMultiplier),
    rawDeadlyStrikeChance: roundStrikeValue(rawDeadlyStrikeChance),
    rawMaxDeadlyStrikeChance: roundStrikeValue(rawMaxDeadlyStrikeChance),
    deadlyStrikeChance: roundStrikeValue(deadlyStrikeChance),
    maxDeadlyStrikeChance: roundStrikeValue(maxDeadlyStrikeChance),
    effectiveDeadlyStrikeChance: roundStrikeValue(
      deadlyStrikeChance * (1 - criticalChance / 100)
    ),
    deadlyStrikeMultiplier: roundStrikeValue(deadlyStrikeMultiplier),
  };
}

export function rebuildStrikeDamageComponents(
  components: DamageProfile["damageComponents"],
  strikeBreakdowns: DamageProfile["strikeBreakdowns"]
): DamageProfile["damageComponents"] {
  if (strikeBreakdowns.length === 0) {
    return components;
  }

  const baseComponents = components.filter(
    (component) =>
      component.damageType !== "critical" && component.damageType !== "deadly"
  );
  const componentsById = new Map(
    baseComponents.map((component) => [component.id, component])
  );
  const strikeComponents = strikeBreakdowns.flatMap((strike) => {
    const physicalDamage = strike.physicalComponentIds.reduce(
      (total, componentId) => {
        const component = componentsById.get(componentId);
        return component &&
          component.damageType === "physical" &&
          component.timing === "instant"
          ? addRange(total, component.damage)
          : total;
      },
      createEmptyRange()
    );
    if (!hasRange(physicalDamage)) {
      return [];
    }

    return (
      [
        {
          type: "critical" as const,
          label: "Critical Strike bonus",
          chance: strike.criticalChance,
          multiplier: strike.criticalMultiplier,
        },
        {
          type: "deadly" as const,
          label: "Deadly Strike bonus",
          chance: strike.effectiveDeadlyStrikeChance,
          multiplier: strike.deadlyStrikeMultiplier,
        },
      ] as const
    ).flatMap((outcome) => {
      const expectedMultiplier =
        (outcome.chance / 100) * (outcome.multiplier - 1);
      const damage = scaleRange(physicalDamage, expectedMultiplier);
      if (!hasRange(damage)) {
        return [];
      }

      return [
        {
          id: `strike:${strike.id}:${outcome.type}`,
          label:
            strike.label === "Attack"
              ? outcome.label
              : `${strike.label}: ${outcome.label}`,
          source: "stat" as const,
          damageType: outcome.type,
          timing: "instant" as const,
          damage,
          sourceRefs: STRIKE_DAMAGE_SOURCE_REFS,
          notes: [],
        },
      ];
    });
  });

  return [...baseComponents, ...strikeComponents];
}
