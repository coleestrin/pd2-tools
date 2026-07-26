import { describe, expect, it } from "vitest";
import type {
  DamageComponent,
  DamageStrikeBreakdown,
  DamageStrikeModifiers,
} from "../types";
import {
  applyStrikeModifierDelta,
  rebuildStrikeDamageComponents,
  rescalePhysicalComponents,
} from "./damage-profile-adjustments";

const EMPTY_STRIKE_MODIFIERS: DamageStrikeModifiers = {
  criticalChance: 0,
  deadlyStrikeChance: 0,
  maxDeadlyStrikeChance: 0,
  criticalMultiplierBonus: 0,
  deadlyStrikeMultiplierBonus: 0,
};

function createStrike(
  overrides: Partial<DamageStrikeBreakdown> = {}
): DamageStrikeBreakdown {
  return {
    id: "attack",
    label: "Attack",
    physicalComponentIds: ["physical"],
    rawCriticalChance: 0,
    criticalChance: 0,
    criticalMultiplier: 2,
    rawDeadlyStrikeChance: 0,
    rawMaxDeadlyStrikeChance: 75,
    deadlyStrikeChance: 0,
    maxDeadlyStrikeChance: 75,
    effectiveDeadlyStrikeChance: 0,
    deadlyStrikeMultiplier: 1.5,
    ...overrides,
  };
}

function createPhysicalComponent(
  id: string,
  min: number,
  max: number
): DamageComponent {
  return {
    id,
    label: id,
    source: "weapon",
    damageType: "physical",
    timing: "instant",
    damage: { min, max },
    sourceRefs: [],
    notes: [],
  };
}

describe("damage profile strike adjustments", () => {
  it("applies multiple strike aura deltas in sequence with caps and CS-first DS effectiveness", () => {
    const firstAura: DamageStrikeModifiers = {
      criticalChance: 20,
      deadlyStrikeChance: 20,
      maxDeadlyStrikeChance: 5,
      criticalMultiplierBonus: 50,
      deadlyStrikeMultiplierBonus: 25,
    };
    const secondAura: DamageStrikeModifiers = {
      criticalChance: 5,
      deadlyStrikeChance: 10,
      maxDeadlyStrikeChance: 10,
      criticalMultiplierBonus: 10,
      deadlyStrikeMultiplierBonus: 20,
    };
    const initial = createStrike({
      rawCriticalChance: 60,
      criticalChance: 60,
      rawDeadlyStrikeChance: 60,
      deadlyStrikeChance: 60,
      effectiveDeadlyStrikeChance: 24,
    });

    const afterFirst = applyStrikeModifierDelta(
      initial,
      firstAura,
      EMPTY_STRIKE_MODIFIERS
    );
    const afterSecond = applyStrikeModifierDelta(
      afterFirst,
      secondAura,
      EMPTY_STRIKE_MODIFIERS
    );

    expect(afterFirst).toMatchObject({
      rawCriticalChance: 80,
      criticalChance: 75,
      criticalMultiplier: 2.5,
      rawDeadlyStrikeChance: 80,
      rawMaxDeadlyStrikeChance: 80,
      deadlyStrikeChance: 80,
      maxDeadlyStrikeChance: 80,
      effectiveDeadlyStrikeChance: 20,
      deadlyStrikeMultiplier: 1.75,
    });
    expect(afterSecond).toMatchObject({
      rawCriticalChance: 85,
      criticalChance: 75,
      criticalMultiplier: 2.6,
      rawDeadlyStrikeChance: 90,
      rawMaxDeadlyStrikeChance: 90,
      deadlyStrikeChance: 90,
      maxDeadlyStrikeChance: 90,
      effectiveDeadlyStrikeChance: 22.5,
      deadlyStrikeMultiplier: 1.95,
    });
  });

  it("rebuilds separate expected strike components for each dual-wield hit", () => {
    const components = [
      createPhysicalComponent("right-physical", 100, 200),
      createPhysicalComponent("left-physical", 50, 80),
    ];
    const strikes = [
      createStrike({
        id: "right",
        label: "Right hit",
        physicalComponentIds: ["right-physical"],
        criticalChance: 50,
        effectiveDeadlyStrikeChance: 25,
      }),
      createStrike({
        id: "left",
        label: "Left hit",
        physicalComponentIds: ["left-physical"],
        criticalChance: 25,
        effectiveDeadlyStrikeChance: 50,
      }),
    ];

    const rebuilt = rebuildStrikeDamageComponents(components, strikes);

    expect(
      rebuilt
        .filter((component) =>
          ["critical", "deadly"].includes(component.damageType)
        )
        .map(({ id, label, damage }) => ({ id, label, damage }))
    ).toEqual([
      {
        id: "strike:right:critical",
        label: "Right hit: Critical Strike bonus",
        damage: { min: 50, max: 100 },
      },
      {
        id: "strike:right:deadly",
        label: "Right hit: Deadly Strike bonus",
        damage: { min: 12.5, max: 25 },
      },
      {
        id: "strike:left:critical",
        label: "Left hit: Critical Strike bonus",
        damage: { min: 12.5, max: 20 },
      },
      {
        id: "strike:left:deadly",
        label: "Left hit: Deadly Strike bonus",
        damage: { min: 12.5, max: 20 },
      },
    ]);
  });

  it("rebuilds expected strike damage from rescaled physical components", () => {
    const physical = {
      ...createPhysicalComponent("physical", 150, 300),
      baseDamage: { min: 100, max: 200 },
    };
    const staleCritical: DamageComponent = {
      ...createPhysicalComponent("strike:attack:critical", 75, 150),
      damageType: "critical",
    };
    const strike = createStrike({
      criticalChance: 50,
      effectiveDeadlyStrikeChance: 0,
    });

    const rescaled = rescalePhysicalComponents(
      [physical, staleCritical],
      1.5,
      2
    );
    const rebuilt = rebuildStrikeDamageComponents(rescaled, [strike]);

    expect(
      rebuilt.find((component) => component.id === "physical")
    ).toMatchObject({
      baseDamage: { min: 100, max: 200 },
      damage: { min: 200, max: 400 },
    });
    expect(
      rebuilt.find((component) => component.id === "strike:attack:critical")
    ).toMatchObject({
      damageType: "critical",
      damage: { min: 100, max: 200 },
    });
  });
});
