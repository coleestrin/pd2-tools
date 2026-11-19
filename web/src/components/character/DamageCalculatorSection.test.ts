import { describe, expect, it } from "vitest";
import type {
  DamageAuraOption,
  DamageCalculation,
  DamageProfile,
} from "../../types";
import {
  applyAuraToProfile,
  findPrecomputedAuraProfile,
  getInitialAuraSelectionRows,
  normalizeAuraSelectionRows,
  selectAuraForRow,
  type AuraSelectionRow,
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

describe("mercenary aura rows", () => {
  function auraOption(id: string, level: number, deadlyStrikeChance = 0): DamageAuraOption {
    const levelOptions = Array.from({ length: 30 }, (_, index) => index + 1);
    const bonuses = levelOptions.map((optionLevel) => {
      const row = bonus(optionLevel);
      row.strikeModifiers.deadlyStrikeChance =
        optionLevel === level ? deadlyStrikeChance : 0;
      return row;
    });
    return {
      id,
      name: id,
      level,
      source: "manual",
      defaultActive: false,
      levelOptions,
      levelBonuses: bonuses,
      selfLevelBonuses: bonuses,
      partyLevelBonuses: bonuses,
    };
  }

  // Mirrors an Act 2 Offensive merc (native Blessed Aim 18) wearing Insight.
  function calculation(): DamageCalculation {
    return {
      playerAuraOptions: [
        { ...auraOption("none", 0), name: "No active aura", source: "none" },
        auraOption("Blessed Aim", 18, 14),
        auraOption("Meditation", 17),
        auraOption("Might", 1),
      ],
      alwaysActiveAuras: [
        { name: "Blessed Aim", level: 18, source: "mercenary_native", carrier: "party" },
        { name: "Meditation", level: 17, source: "mercenary_item", carrier: "party" },
      ],
    } as unknown as DamageCalculation;
  }

  const strip = (rows: AuraSelectionRow[]) =>
    rows.map(({ auraId, level, isParty, automaticLevel, automaticSource }) => ({
      auraId,
      level,
      isParty,
      automaticLevel,
      automaticSource,
    }));
  const remove = (rows: AuraSelectionRow[], auraId: string) =>
    normalizeAuraSelectionRows(
      rows.filter((row) => row.auraId !== auraId),
      calculation().playerAuraOptions
    );
  const add = (rows: AuraSelectionRow[], auraId: string) => {
    const option = calculation().playerAuraOptions.find((candidate) => candidate.id === auraId)!;
    return normalizeAuraSelectionRows(
      rows.map((row) =>
        row.auraId === "none" ? selectAuraForRow(row, option, calculation()) : row
      ),
      calculation().playerAuraOptions
    );
  };
  const nativeBlessedAim = {
    auraId: "Blessed Aim",
    level: "18",
    isParty: true,
    automaticLevel: 18,
    automaticSource: "mercenary_native",
  };
  const itemMeditation = {
    auraId: "Meditation",
    level: "17",
    isParty: true,
    automaticLevel: 17,
    automaticSource: "mercenary_item",
  };
  const emptyRow = { auraId: "none", level: "0", isParty: false };

  it("loads every native and item merc aura as an active party row", () => {
    expect(strip(getInitialAuraSelectionRows(calculation()))).toEqual([
      nativeBlessedAim,
      itemMeditation,
      emptyRow,
    ]);
  });

  it("restores merc auras exactly when they are removed and added back in any order", () => {
    const initial = getInitialAuraSelectionRows(calculation());

    const withoutBlessedAim = remove(initial, "Blessed Aim");
    expect(strip(withoutBlessedAim)).toEqual([itemMeditation, emptyRow]);
    expect(strip(add(withoutBlessedAim, "Blessed Aim"))).toEqual([
      itemMeditation,
      nativeBlessedAim,
      emptyRow,
    ]);

    const empty = remove(remove(initial, "Meditation"), "Blessed Aim");
    expect(strip(empty)).toEqual([emptyRow]);
    expect(strip(add(add(empty, "Blessed Aim"), "Meditation"))).toEqual(
      strip(initial)
    );
    expect(strip(add(add(empty, "Meditation"), "Blessed Aim"))).toEqual([
      itemMeditation,
      nativeBlessedAim,
      emptyRow,
    ]);
  });

  it("restores the party carrier after the user unchecks it, removes, and re-adds", () => {
    const unchecked = getInitialAuraSelectionRows(calculation()).map((row) =>
      row.auraId === "Blessed Aim" ? { ...row, isParty: false } : row
    );
    const readded = add(remove(unchecked, "Blessed Aim"), "Blessed Aim");
    expect(strip(readded).find((row) => row.auraId === "Blessed Aim")).toEqual(
      nativeBlessedAim
    );
  });

  it("adds a non-mercenary aura as a manual self row next to merc auras", () => {
    const rows = add(getInitialAuraSelectionRows(calculation()), "Might");
    expect(strip(rows)).toEqual([
      nativeBlessedAim,
      itemMeditation,
      { auraId: "Might", level: "1", isParty: false },
      emptyRow,
    ]);
    expect(strip(remove(rows, "Might"))).toEqual(
      strip(getInitialAuraSelectionRows(calculation()))
    );
  });

  it("restores a merc aura the player also owns as its merc party row", () => {
    const owned = calculation();
    owned.playerAuraOptions[1] = {
      ...owned.playerAuraOptions[1],
      level: 25,
      source: "character_skill",
    };
    const option = owned.playerAuraOptions[1];
    const initial = getInitialAuraSelectionRows(owned);
    expect(strip(initial)[0]).toEqual(nativeBlessedAim);

    const emptyRow = normalizeAuraSelectionRows(
      initial.filter((row) => row.auraId !== "Blessed Aim"),
      owned.playerAuraOptions
    ).find((row) => row.auraId === "none")!;
    expect(strip([selectAuraForRow(emptyRow, option, owned)])).toEqual([
      nativeBlessedAim,
    ]);
  });

  it("re-adds a removed player item aura as a plain self row", () => {
    const withItemAura = calculation();
    withItemAura.alwaysActiveAuras = [
      { name: "Might", level: 5, source: "player_item", carrier: "self" },
    ];
    const option = withItemAura.playerAuraOptions[3];
    const emptyRow = getInitialAuraSelectionRows(withItemAura).find(
      (row) => row.auraId === "none"
    )!;
    expect(strip([selectAuraForRow(emptyRow, option, withItemAura)])).toEqual([
      { auraId: "Might", level: "1", isParty: false },
    ]);
  });

  it("applies merc Blessed Aim Deadly Strike to Twister and removes it cleanly", () => {
    const twister = profile();
    twister.skillDamageMode = "spell";
    twister.skillName = twister.skillId = "Twister";
    twister.strikeBreakdowns = [{
      id: "spell", label: "Twister", physicalComponentIds: ["physical"],
      rawCriticalChance: 0, criticalChance: 0, criticalMultiplier: 2,
      rawDeadlyStrikeChance: 44, rawMaxDeadlyStrikeChance: 75,
      deadlyStrikeChance: 44, maxDeadlyStrikeChance: 75,
      effectiveDeadlyStrikeChance: 44, deadlyStrikeMultiplier: 1.5,
    }];
    const blessedAim = calculation().playerAuraOptions[1];

    const buffed = applyAuraToProfile(twister, blessedAim, true, "18", "mercenary_native");
    expect(buffed.strikeBreakdowns[0].deadlyStrikeChance).toBe(58);
    expect(buffed.strikeBreakdowns[0].effectiveDeadlyStrikeChance).toBe(58);
    expect(buffed.activeAuras).toEqual([
      expect.objectContaining({ name: "Blessed Aim", level: 18, source: "mercenary_native", carrier: "party" }),
    ]);
    // Reapplying the same row is idempotent, and the removed state is the unbuffed profile.
    expect(applyAuraToProfile(buffed, blessedAim, true, "18", "mercenary_native").totalDamage)
      .toEqual(buffed.totalDamage);
    expect(twister.strikeBreakdowns[0].deadlyStrikeChance).toBe(44);
    expect(buffed.totalDamage.min).toBeGreaterThan(twister.totalDamage.min);
  });
});
