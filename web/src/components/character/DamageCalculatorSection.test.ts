import { describe, expect, it } from "vitest";
import type {
  DamageAuraOption,
  DamageCalculation,
  DamageProfile,
} from "../../types";
import {
  applyAuraToProfile,
  findPrecomputedAuraProfile,
} from "./DamageCalculatorSection";

function profile(): DamageProfile {
  return {
    key: "base",
    weaponId: "primary:right:one_handed:test",
    skillId: "Basic Attack",
    skillName: "Basic Attack",
    skillLevel: 1,
    skillDamageMode: "weapon",
    playerAuraId: "none",
    playerAuraCarrier: "self",
    playerAuraLevel: 0,
    transformationId: "none",
    activeAuras: [],
    strikeBreakdowns: [],
    damageScope: { label: "per hit", note: "", sourceRefs: [] },
    damageComponents: [
      {
        id: "physical",
        label: "Physical",
        source: "weapon",
        damageType: "physical",
        timing: "instant",
        damage: { min: 100, max: 200 },
        baseDamage: { min: 100, max: 200 },
        sourceRefs: [],
        notes: [],
      },
    ],
    damageTotals: {
      instantDamage: { min: 100, max: 200 },
      overTimeDamage: { min: 0, max: 0 },
      combinedDamage: { min: 100, max: 200 },
      averageInstantDamage: 150,
      averageCombinedDamage: 150,
      byElement: { physical: { min: 100, max: 200 } },
    },
    totalPhysicalDamage: { min: 100, max: 200 },
    totalElementalDamage: {},
    totalDamage: { min: 100, max: 200 },
    averageHitDamage: 150,
    breakdown: {
      weaponDamage: { min: 100, max: 200 },
      flatPhysicalDamage: { min: 0, max: 0 },
      physicalBonusPercent: {
        stat: 0,
        nonWeapon: 0,
        passive: 0,
        selectedSkill: 0,
        selectedSkillSynergy: 0,
        transformation: 0,
        activeAuras: 0,
        total: 0,
      },
      elementalDamage: {},
    },
    notes: [],
  };
}

function bonus(level: number, physicalBonusPercent = 0, skillLevelBonus = 0) {
  return {
    level,
    physicalBonusPercent,
    skillLevelBonus,
    elementalDamage: {},
    strikeModifiers: {
      criticalChance: 0,
      deadlyStrikeChance: 0,
      maxDeadlyStrikeChance: 0,
      criticalMultiplierBonus: 0,
      deadlyStrikeMultiplierBonus: 0,
    },
  };
}

function aura(id: string): DamageAuraOption {
  return {
    id,
    name: id,
    level: 20,
    source: "character_skill",
    defaultActive: false,
    levelOptions: [1, 8, 10, 20],
    levelBonuses: [bonus(20)],
    selfLevelBonuses: [bonus(20)],
    partyLevelBonuses: [bonus(20)],
  };
}

describe("damage calculator aura interactions", () => {
  it.each([false, true])("scales an Enchant by recipient mastery once (party=%s), including level replacement", (party) => {
    const p = profile();
    p.enchantDamageBonusPercent = { fire: 30 };
    const enchant = aura("Enchant");
    for (const rows of [enchant.selfLevelBonuses, enchant.partyLevelBonuses]) {
      rows[0].elementalDamage = { fire: { min: 15, max: 21 } };
      rows.push({ ...bonus(40), elementalDamage: { fire: { min: 20, max: 30 } } });
    }
    const first = applyAuraToProfile(p, enchant, party, "20", "manual");
    expect(first.totalElementalDamage.fire).toEqual({ min: 19, max: 27 });
    expect(applyAuraToProfile(first, enchant, party, "20", "manual").totalDamage).toEqual(first.totalDamage);
    const upgraded = applyAuraToProfile(first, enchant, party, "40", "manual");
    expect(upgraded.totalElementalDamage.fire).toEqual({ min: 26, max: 39 });
    expect(upgraded.totalPhysicalDamage).toEqual(p.totalPhysicalDamage);
    const pet = { ...p, skillDamageMode: "summon" as const, enchantDamageBonusPercent: undefined };
    expect(applyAuraToProfile(pet, enchant, party, "20", "manual").totalElementalDamage.fire).toEqual({ min: 15, max: 21 });
  });

  it("combines a pet's Critical Strike with Spirit of Barbs and keeps elemental summon damage separate", () => {
    const p = profile();
    p.skillDamageMode = "summon";
    p.strikeBreakdowns = [{
      id: "pet", label: "Pet", physicalComponentIds: ["physical"],
      rawCriticalChance: 15, criticalChance: 15, criticalMultiplier: 2,
      rawDeadlyStrikeChance: 0, rawMaxDeadlyStrikeChance: 75,
      deadlyStrikeChance: 0, maxDeadlyStrikeChance: 75,
      effectiveDeadlyStrikeChance: 0, deadlyStrikeMultiplier: 1.5,
    }];
    const spirit = aura("Spirit of Barbs");
    spirit.partyLevelBonuses[0].strikeModifiers.deadlyStrikeChance = 27;
    const result = applyAuraToProfile(p, spirit, true, "20", "manual");
    expect(result.strikeBreakdowns[0].effectiveDeadlyStrikeChance).toBe(22.95);
    expect(result.damageTotals.byElement.critical).toEqual({ min: 15, max: 30 });
    expect(result.damageTotals.byElement.deadly?.min).toBeCloseTo(11.475);
    expect(result.damageTotals.byElement.deadly?.max).toBeCloseTo(22.95);
    p.strikeBreakdowns = [];
    expect(applyAuraToProfile(p, spirit, true, "20", "manual").totalDamage).toEqual(p.totalDamage);
  });

  it("replaces a cached owned summon Enchant with the selected external caster at the same level", () => {
    const p = profile();
    p.skillDamageMode = "summon";
    const enchant = aura("Enchant");
    enchant.summonLevelBonusesByWeaponSet = {
      primary: [{ ...bonus(20), elementalDamage: { fire: { min: 100, max: 200 } } }],
    };
    enchant.partyLevelBonuses[0].elementalDamage = { fire: { min: 10, max: 20 } };
    const cached = applyAuraToProfile(p, enchant, false, "20", "player_skill");
    expect(cached.totalElementalDamage.fire).toEqual({ min: 100, max: 200 });
    const selected = applyAuraToProfile(cached, enchant, true, "20", "manual", true);
    expect(selected.totalElementalDamage.fire).toEqual({ min: 10, max: 20 });
  });

  it.each([false, true])("applies a spirit's strike bonus to an eligible spell (party=%s) without attack aura damage", (party) => {
    const p = profile();
    p.skillDamageMode = "spell";
    p.skillName = p.skillId = "Tornado";
    p.strikeBreakdowns = [{
      id: "spell", label: "Tornado", physicalComponentIds: ["physical"],
      rawCriticalChance: 0, criticalChance: 0, criticalMultiplier: 2,
      rawDeadlyStrikeChance: 0, rawMaxDeadlyStrikeChance: 75,
      deadlyStrikeChance: 0, maxDeadlyStrikeChance: 75,
      effectiveDeadlyStrikeChance: 0, deadlyStrikeMultiplier: 1.5,
    }];
    const spirit = aura("Spirit of Barbs");
    for (const row of [...spirit.selfLevelBonuses, ...spirit.partyLevelBonuses]) {
      row.physicalBonusPercent = 100;
      row.elementalDamage = { fire: { min: 500, max: 1000 } };
      row.strikeModifiers!.deadlyStrikeChance = 40;
    }
    const buffed = applyAuraToProfile(p, spirit, party, "20", "manual");
    expect(buffed.totalPhysicalDamage).toEqual({ min: 100, max: 200 });
    expect(buffed.damageTotals.byElement.deadly).toEqual({ min: 20, max: 40 });
    expect(buffed.totalDamage).toEqual({ min: 120, max: 240 });
    expect(buffed.totalElementalDamage.fire).toBeUndefined();
    expect(applyAuraToProfile(buffed, spirit, party, "20", "manual").totalDamage).toEqual(buffed.totalDamage);
    expect(p.totalDamage).toEqual({ min: 100, max: 200 });
    p.skillName = p.skillId = "War Cry";
    p.strikeBreakdowns = [];
    expect(applyAuraToProfile(p, spirit, party, "20", "manual").totalDamage).toEqual(p.totalDamage);
  });
  it("keeps an owned Enchant payload when another physical aura is added", () => {
    const enchant = aura("Enchant");
    enchant.selfLevelBonuses[0].elementalDamage = {
      fire: { min: 10, max: 20 },
    };
    enchant.partyLevelBonuses[0].elementalDamage = {
      fire: { min: 10, max: 20 },
    };
    enchant.selfLevelBonusesByWeaponSet = {
      primary: [
        { ...bonus(20), elementalDamage: { fire: { min: 500, max: 1000 } } },
      ],
      secondary: [
        { ...bonus(20), elementalDamage: { fire: { min: 300, max: 600 } } },
      ],
    };
    const might = aura("Might");
    might.selfLevelBonuses = [bonus(20, 100)];
    const enchanted = applyAuraToProfile(
      profile(),
      enchant,
      false,
      "20",
      "player_skill"
    );
    const withMight = applyAuraToProfile(
      enchanted,
      might,
      false,
      "20",
      "manual"
    );
    const reverse = applyAuraToProfile(
      applyAuraToProfile(profile(), might, false, "20", "manual"),
      enchant,
      false,
      "20",
      "player_skill"
    );
    expect(enchanted.totalElementalDamage.fire).toEqual({
      min: 500,
      max: 1000,
    });
    expect(withMight.totalElementalDamage.fire).toEqual(
      enchanted.totalElementalDamage.fire
    );
    expect(withMight.totalDamage).toEqual(reverse.totalDamage);
    const swapped = applyAuraToProfile(
      { ...profile(), weaponId: "secondary:right:one_handed:test" },
      enchant,
      false,
      "20",
      "player_skill"
    );
    expect(swapped.totalElementalDamage.fire).toEqual({ min: 300, max: 600 });
    expect(
      applyAuraToProfile(profile(), enchant, false, "20", "player_item")
        .totalElementalDamage.fire
    ).toEqual({ min: 10, max: 20 });
    enchant.summonLevelBonusesByWeaponSet = {
      primary: [
        { ...bonus(20), elementalDamage: { fire: { min: 400, max: 800 } } },
      ],
    };
    const summon = { ...profile(), skillDamageMode: "summon" as const };
    const enchantedSummon = applyAuraToProfile(
      summon,
      enchant,
      false,
      "20",
      "player_skill"
    );
    expect(enchantedSummon.totalElementalDamage.fire).toEqual({
      min: 400,
      max: 800,
    });
    expect(
      applyAuraToProfile(enchantedSummon, might, false, "20", "manual")
        .totalElementalDamage.fire
    ).toEqual({ min: 400, max: 800 });
    expect(
      applyAuraToProfile(profile(), enchant, true, "20", "player_skill")
        .totalElementalDamage.fire
    ).toEqual({ min: 10, max: 20 });
  });

  it("reuses a Battle Command skill tier while applying the requested enhanced damage", () => {
    const command = aura("Battle Command");
    command.selfLevelBonuses = [
      bonus(1, 20, 1),
      bonus(8, 41, 1),
      bonus(10, 47, 2),
    ];
    command.partyLevelBonuses = command.selfLevelBonuses;
    const seed = applyAuraToProfile(profile(), command, false, "1", "manual");
    seed.skillLevel = 21;
    const calculation = { profiles: [seed] } as DamageCalculation;
    const matched = findPrecomputedAuraProfile(
      calculation,
      seed.weaponId,
      seed.skillId,
      null,
      null,
      command,
      false,
      "8"
    );
    expect(matched).toBe(seed);
    const selected = applyAuraToProfile(
      matched!,
      command,
      false,
      "8",
      "manual",
      true
    );
    expect(selected.skillLevel).toBe(21);
    expect(selected.totalPhysicalDamage).toEqual({ min: 141, max: 282 });
    expect(selected.selectedPlayerAura?.level).toBe(8);
    // A different all-skills tier must not reuse stale spell or passive damage.
    expect(
      findPrecomputedAuraProfile(
        calculation,
        seed.weaponId,
        seed.skillId,
        null,
        null,
        command,
        false,
        "10"
      )
    ).toBeNull();
    const lowered = applyAuraToProfile(
      selected,
      command,
      false,
      "1",
      "manual",
      true
    );
    expect(lowered.totalDamage).toEqual(seed.totalDamage);
  });
});
