import { calculateDamage } from "./damage-calculator";
import fs from "fs";
import path from "path";
import type { CharacterData, DamageProfile, IItem } from "../types";
import * as gameFormula from "./game-formula";

// Deliberately small inputs and literal, independently worked expectations.
// These are mechanics checks, not snapshots refreshed from calculateDamage.
function weapon(id: string, slot = "Right Hand", type = "swor"): IItem {
  return {
    id, hash: id, name: id, category: "weapon",
    base: { name: id, type_code: type, type: type },
    location: { zone: "Equipped", equipment: slot },
    damage: {
      one_handed: { minimum: 100, maximum: 200 },
      two_handed: {}, missile: {},
    },
    properties: [], modifiers: [],
  } as unknown as IItem;
}

function character(
  skill = "Basic Attack", level = 1, baseLevel = level
): CharacterData {
  return {
    character: {
      name: "MechanicsTest", level: 90, season: 13,
      class: { id: 1, name: "Sorceress" },
      attributes: { strength: 0, dexterity: 0, vitality: 0, energy: 0 },
      skills: skill === "Basic Attack" ? [] : [{ name: skill, level: baseLevel }],
    },
    items: [weapon("right")],
    realSkills: [{ skill, level, baseLevel }],
  } as unknown as CharacterData;
}

function baseProfile(data: CharacterData, skill = "Basic Attack"): DamageProfile {
  const profile = calculateDamage(data).profiles.find((entry) =>
    entry.skillId === skill && entry.weaponId.startsWith("primary:right:") &&
    entry.playerAuraId === "none"
  );
  expect(profile).toBeDefined();
  return profile!;
}

describe("independent damage mechanics", () => {
  it.each([
    { skill: "Twister", physical: { min: 94, max: 119 } },
    { skill: "Tornado", physical: { min: 277, max: 319 } },
    { skill: "Shock Wave", physical: { min: 151, max: 231 } },
  ])("applies S14 Critical/Deadly Strike only to $skill's physical spell payload", ({ skill, physical }) => {
    const data = character(skill, 20);
    data.character.class = { id: 5, name: "Druid" };
    data.items[0].modifiers = [
      { name: "item_crit_chance", values: [50] },
      { name: "item_deadlystrike", values: [50] },
    ] as IItem["modifiers"];
    const p = baseProfile(data, skill);
    expect(p.totalPhysicalDamage).toEqual(physical);
    expect(p.strikeBreakdowns).toHaveLength(1);
    expect(p.strikeBreakdowns[0].criticalChance).toBe(50);
    expect(p.strikeBreakdowns[0].effectiveDeadlyStrikeChance).toBe(25);
    expect(p.damageTotals.byElement.critical).toEqual({ min: physical.min * .5, max: physical.max * .5 });
    expect(p.damageTotals.byElement.deadly).toEqual({ min: physical.min * .125, max: physical.max * .125 });
  });
  it.each(["War Cry", "Fire Ball"])("keeps strike modifiers out of %s", (skill) => {
    const control = baseProfile(character(skill, 20), skill);
    const data = character(skill, 20);
    data.items[0].modifiers = [
      { name: "item_crit_chance", values: [100] },
      { name: "item_deadlystrike", values: [100] },
    ] as IItem["modifiers"];
    const p = baseProfile(data, skill);
    expect(p.strikeBreakdowns).toEqual([]);
    expect(p.totalDamage).toEqual(control.totalDamage);
  });
  it("uses only active weapon-set strike stats for physical spells without adding weapon damage", () => {
    const data = character("Tornado", 1);
    data.items[0].modifiers = [{ name: "item_deadlystrike", values: [20] }] as IItem["modifiers"];
    const swap = weapon("swap", "Right Hand Switch");
    swap.modifiers = [{ name: "item_deadlystrike", values: [60] }] as IItem["modifiers"];
    data.items.push(swap);
    const profiles = calculateDamage(data).profiles.filter((p) => p.skillId === "Tornado" && p.playerAuraId === "none");
    const right = profiles.find((p) => p.weaponId.startsWith("primary:right:"))!;
    const switched = profiles.find((p) => p.weaponId.startsWith("secondary:right:"))!;
    expect(right.totalPhysicalDamage).toEqual({ min: 35, max: 39 });
    expect(switched.totalPhysicalDamage).toEqual(right.totalPhysicalDamage);
    expect(right.strikeBreakdowns[0].deadlyStrikeChance).toBe(20);
    expect(switched.strikeBreakdowns[0].deadlyStrikeChance).toBe(60);
    expect(right.damageTotals.byElement.deadly?.min).toBeCloseTo(3.5);
    expect(right.damageTotals.byElement.deadly?.max).toBeCloseTo(3.9);
    expect(switched.damageTotals.byElement.deadly?.min).toBeCloseTo(10.5);
    expect(switched.damageTotals.byElement.deadly?.max).toBeCloseTo(11.7);
  });
  it("carries stream event rates into target mitigation", () => {
    const inferno = baseProfile(character("Inferno", 20), "Inferno");
    expect(inferno.damageComponents.find((c) => c.damageType === "fire")?.damageEventsPerUnit).toBe(25);
    const sentry = baseProfile(character("Inferno Sentry", 20), "Inferno Sentry");
    expect(sentry.damageComponents.find((c) => c.damageType === "fire")?.damageEventsPerUnit).toBe(25 / 3);
  });
  it("exports target pierce from active gear and passives for each weapon set", () => {
    const data = character("Cold Mastery", 20, 20);
    data.items[0].modifiers = [{ name: "passive_cold_pierce", values: [10] }] as IItem["modifiers"];
    const swap = weapon("swap", "Right Hand Switch");
    swap.modifiers = [{ name: "passive_cold_pierce", values: [30] }] as IItem["modifiers"];
    const stored = { ...weapon("stored"), location: { zone: "Stored", storage: "Stash" },
      modifiers: [{ name: "passive_cold_pierce", values: [80] }] } as IItem;
    data.items.push(swap, stored);
    // Cold Mastery 20 = 5 + 19 = 24 pierce, independent of skill damage.
    expect(baseProfile(data).targetModifiers?.resistancePierce.cold).toBe(34);
    const swapped = calculateDamage(data).profiles.find((p) => p.skillId === "Basic Attack" && p.weaponId.startsWith("secondary:right:") && p.playerAuraId === "none");
    expect(swapped?.targetModifiers?.resistancePierce.cold).toBe(54);
  });

  it("passes demon and undead damage bonuses only to the striking weapon", () => {
    const data = character();
    data.items[0].modifiers = [{ name: "item_demondamage_percent", values: [50] }] as IItem["modifiers"];
    const other = weapon("left", "Left Hand");
    other.modifiers = [{ name: "item_demondamage_percent", values: [200] }] as IItem["modifiers"];
    data.items.push(other);
    const physical = baseProfile(data).damageComponents.find((c) => c.damageType === "physical")!;
    expect(physical.targetDamageBonuses).toEqual({ demon: 50, undead: 0 });
  });

  it("detects equipped Conviction without treating it as an offensive damage aura", () => {
    const data = character();
    data.items[0].properties = ["Level 12 Conviction Aura When Equipped"];
    expect(baseProfile(data).targetModifiers?.convictionLevel).toBe(12);
  });
  it("uses the strongest active Conviction source for target resistance", () => {
    const data = character("Conviction", 12, 12);
    data.character.class = { id: 3, name: "Paladin" };
    data.items[0].properties = ["Level 10 Conviction Aura When Equipped"];
    const profile = calculateDamage(data).profiles.find((entry) =>
      entry.skillId === "Basic Attack" && entry.playerAuraId === "Conviction" &&
      entry.playerAuraCarrier === "self" && entry.playerAuraLevel === 12
    );
    expect(profile?.targetModifiers?.convictionLevel).toBe(12);
  });

  it("ignores stored aura-on-equip items", () => {
    const data = character();
    const armor = {
      ...weapon("armor", "Body Armor"), category: "armor",
      location: { zone: "Stored", storage: "Stash", equipment: "Body Armor" } as IItem["location"],
      properties: ["Level 20 Holy Fire Aura When Equipped"],
    } as IItem;
    data.items.push(armor);
    expect(calculateDamage(data).alwaysActiveAuras.some((aura) => aura.name === "Holy Fire")).toBe(false);
    armor.location = { zone: "Equipped", equipment: "Body Armor" } as IItem["location"];
    expect(calculateDamage(data).alwaysActiveAuras.some((aura) => aura.name === "Holy Fire")).toBe(true);
  });

  it("keeps local physical pierce on the striking weapon", () => {
    const data = character();
    data.items[0].modifiers = [{ name: "passive_phys_pierce", values: [10] }] as IItem["modifiers"];
    const left = weapon("left", "Left Hand");
    left.modifiers = [{ name: "passive_phys_pierce", values: [30] }] as IItem["modifiers"];
    data.items.push(left);
    const profiles = calculateDamage(data).profiles.filter((profile) =>
      profile.skillId === "Basic Attack" && profile.playerAuraId === "none"
    );
    const right = profiles.find((profile) => profile.weaponId.startsWith("primary:right:"))!;
    const leftHit = profiles.find((profile) => profile.weaponId.startsWith("primary:left:"))!;
    expect(right.targetModifiers?.resistancePierce.physical).toBe(10);
    expect(right.strikeBreakdowns[0].resistancePierce).toBe(10);
    expect(leftHit.targetModifiers?.resistancePierce.physical).toBe(30);
    expect(leftHit.strikeBreakdowns[0].resistancePierce).toBe(30);
  });

  it("keeps both weapon affixes global for non-attack skills", () => {
    const data = character("Mind Blast", 20, 20);
    data.items[0].modifiers = [{ name: "passive_phys_pierce", values: [10] }] as IItem["modifiers"];
    const left = weapon("left", "Left Hand");
    left.modifiers = [{ name: "passive_phys_pierce", values: [30] }] as IItem["modifiers"];
    data.items.push(left);
    expect(baseProfile(data, "Mind Blast").targetModifiers?.resistancePierce.physical).toBe(40);
  });

  it("applies Penetrate only to compatible weapons", () => {
    const data = character("Penetrate", 20, 20);
    data.character.class = { id: 0, name: "Amazon" };
    expect(baseProfile(data).targetModifiers?.resistancePierce.physical).toBe(0);
    data.items = [weapon("spear", "Right Hand", "spea")];
    expect(baseProfile(data).targetModifiers?.resistancePierce.physical).toBe(10);
  });

  it("keeps native summon pierce local and excludes removed pet inheritance", () => {
    const valkyrie = character("Valkyrie", 20, 20);
    valkyrie.character.class = { id: 0, name: "Amazon" };
    valkyrie.realSkills!.push({ skill: "Pierce", level: 20, baseLevel: 20 });
    expect(baseProfile(valkyrie).targetModifiers?.resistancePierce.lightning).toBe(0);
    const valkyrieProfile = calculateDamage(valkyrie).profiles.find((entry) =>
      entry.skillId.startsWith("Valkyrie") && entry.playerAuraId === "none"
    );
    expect(valkyrieProfile?.targetModifiers?.resistancePierce.lightning).toBe(40);

    for (const skill of ["Hydra", "Lightning Sentry", "FireGolem"] as const) {
      const data = character(skill, 20, 20);
      data.realSkills!.push({ skill: "Fire Mastery", level: 20, baseLevel: 20 });
      data.items[0].modifiers = [{ name: "passive_fire_pierce", values: [10] }] as IItem["modifiers"];
      const profile = calculateDamage(data).profiles.find((entry) =>
        (entry.skillId === skill || entry.skillId.startsWith(`${skill}::`)) && entry.playerAuraId === "none"
      );
      expect(profile?.targetModifiers?.resistancePierce.fire).toBe(0);
    }

    const mage = character("Raise Skeletal Mage", 20, 20);
    mage.realSkills!.push({ skill: "Fire Mastery", level: 20, baseLevel: 20 });
    mage.items[0].modifiers = [{ name: "passive_fire_pierce", values: [10] }] as IItem["modifiers"];
    const mageProfile = calculateDamage(mage).profiles.find((entry) =>
      entry.skillId === "Raise Skeletal Mage::fire-mage" && entry.playerAuraId === "none"
    );
    const playerPierce = baseProfile(mage).targetModifiers?.resistancePierce.fire || 0;
    expect(mageProfile?.targetModifiers?.resistancePierce.fire).toBe(Math.floor(playerPierce / 2));
  });

  it("applies selected-skill pierce only to Berserk", () => {
    const data = character("Berserk", 20, 20);
    data.character.class = { id: 4, name: "Barbarian" };
    expect(baseProfile(data).targetModifiers?.resistancePierce.physical).toBe(0);
    expect(baseProfile(data, "Berserk").targetModifiers?.resistancePierce.physical).toBe(24);
  });
  it("includes intrinsic blunt undead damage and level-scaled enemy bonuses", () => {
    const data = character();
    data.items = [weapon("mace", "Right Hand", "mace")];
    data.items[0].modifiers = [
      { name: "item_damage_demon_perlevel", values: [20] },
      { name: "item_damage_undead_perlevel", values: [8] },
    ] as IItem["modifiers"];
    const physical = baseProfile(data).damageComponents.find((c) => c.damageType === "physical")!;
    expect(physical.targetDamageBonuses).toEqual({ demon: 225, undead: 140 });
  });
  // Skills.txt Fire Bolt: base 6/12, increments 4/6,16/18,30/32,46/48,46/48;
  // HitShift=7. Tiers have 7,8,6,6 levels, then continue without a cap.
  it.each([
    [1, 3, 6], [8, 17, 27], [9, 25, 36], [16, 81, 99],
    [17, 96, 115], [22, 171, 195], [23, 194, 219],
    [28, 309, 339], [29, 332, 363], [60, 1045, 1107], [61, 1068, 1131],
  ])("keeps Fire Bolt level %i in the correct damage tier", (level, min, max) => {
    expect(baseProfile(character("Fire Bolt", level, 1), "Fire Bolt")
      .totalElementalDamage.fire).toEqual({ min, max });
  });

  it("preserves fixed-point damage through synergy and mastery", () => {
    const data = character("Fire Ball", 2, 2);
    data.realSkills!.push(
      { skill: "Fire Bolt", level: 1, baseLevel: 1 },
      { skill: "Fire Mastery", level: 1, baseLevel: 1 },
    );
    // Base 12.5-21.5; 15% synergy, then 20% mastery in 1/256 units.
    // floor only for the displayed hit: 17-29, not floor(14)*1.2 = 16.
    expect(baseProfile(data, "Fire Ball").totalElementalDamage.fire)
      .toEqual({ min: 17, max: 29 });
  });

  it("uses hard points for blvl projectile counts", () => {
    const profile = baseProfile(character("Ice Barrage", 20, 1), "Ice Barrage");
    // calc1 = 3 + min(blvl / 3, 2); +skills must not add missiles.
    expect(profile.damageScope.count).toBe(3);
  });

  it("does not treat an oskill's soft levels as allocated synergy points", () => {
    const data = character("Fire Bolt", 1, 1);
    data.realSkills!.push({ skill: "Fire Ball", level: 20, baseLevel: undefined });
    expect(baseProfile(data, "Fire Bolt").totalElementalDamage.fire)
      .toEqual({ min: 3, max: 6 });
  });

  it("keeps raw elemental weapon stats local to the striking hand", () => {
    const data = character();
    const left = weapon("left", "Left Hand");
    left.modifiers = [{ name: "firemindam", values: [100, 200] }] as IItem["modifiers"];
    data.items.push(left);
    expect(baseProfile(data).totalElementalDamage.fire).toBeUndefined();
    const leftHit = calculateDamage(data).profiles.find((profile) =>
      profile.weaponId.startsWith("primary:left:one_handed") &&
      profile.skillId === "Basic Attack" && profile.playerAuraId === "none"
    );
    expect(leftHit?.totalElementalDamage.fire).toEqual({ min: 100, max: 200 });
  });

  it("applies elemental mastery to item damage on a melee hit", () => {
    const data = character("Fire Mastery", 1, 1);
    data.items[0].properties.push("Adds 10-20 Fire Damage");
    // S13 Fire Mastery level 1 adds 20%; melee elemental weapon stats use it.
    expect(baseProfile(data).totalElementalDamage.fire).toEqual({ min: 12, max: 24 });
  });

  it("applies the installed magic skill damage stat to carried magic damage", () => {
    const data = character();
    data.items[0].properties.push("Adds 100-200 Magic Damage");
    data.realStats = { magicSkillDamage: 5 } as CharacterData["realStats"];
    expect(baseProfile(data).totalElementalDamage.magic).toEqual({ min: 105, max: 210 });
  });

  it("applies a 5% magic jewel bonus to source-backed Bone Spear damage", () => {
    const data = character("Bone Spear", 20);
    data.realStats = { magicSkillDamage: 5 } as CharacterData["realStats"];
    // Source tiers: 12+7*7+8*9+4*12 = 181; 18+7*7+8*9+4*13 = 191.
    expect(baseProfile(data, "Bone Spear").totalElementalDamage.magic).toEqual({ min: 190, max: 200 });
  });

  it.each([
    ["Fire Mastery", "fire", "Adds 10-20 Fire Damage", 12, 24],
    ["Cold Mastery", "cold", "Adds 10-20 Cold Damage", 11, 22],
    ["Lightning Mastery", "lightning", "Adds 10-20 Lightning Damage", 15, 30],
  ] as const)("applies %s to ranged item damage", (skill, element, property, min, max) => {
    const data = character(skill, 1);
    data.items[0] = weapon("bow", "Right Hand", "bow");
    data.items[0].damage = { one_handed: {}, two_handed: {}, missile: { minimum: 100, maximum: 200 } } as IItem["damage"];
    data.items[0].properties.push(property);
    expect(baseProfile(data).totalElementalDamage[element]).toEqual({ min, max });
  });

  it("applies Spirit of Barbs to a pet's physical hit without inheriting owner gear", () => {
    const data = character("Summon Spirit Wolf", 1);
    data.realSkills!.push({ skill: "Spirit of Barbs", level: 20, baseLevel: 1 });
    data.items[0].modifiers = [{ name: "item_deadlystrike", values: [100] }] as IItem["modifiers"];
    const calc = calculateDamage(data);
    const profiles = calc.profiles.filter((p) => p.skillId === "Summon Spirit Wolf");
    const base = profiles.find((p) => p.playerAuraId === "none")!;
    const spirit = profiles.find((p) => p.playerAuraId === "Spirit of Barbs" && p.playerAuraLevel === 20)!;
    expect(base.totalPhysicalDamage).toEqual({ min: 12, max: 18 });
    expect(base.damageTotals.byElement.deadly).toBeUndefined();
    expect(spirit.strikeBreakdowns[0].deadlyStrikeChance).toBe(27);
    expect(spirit.damageTotals.byElement.deadly?.min).toBeCloseTo(1.62);
    expect(spirit.damageTotals.byElement.deadly?.max).toBeCloseTo(2.43);
  });

  it.each([0, 1])("gives Valkyrie only its source-assigned Critical Strike hard points (%s)", (baseLevel) => {
    const data = character("Valkyrie", 1);
    data.character.class = { id: 0, name: "Amazon" };
    data.realSkills!.push({ skill: "Critical Strike", level: 20, baseLevel });
    const p = calculateDamage(data).profiles.find((p) => p.sourceSkillName === "Valkyrie" && p.playerAuraId === "none")!;
    // sumsk3calc reads the owner's hard points; Critical Strike 1 = 15%.
    expect(p.strikeBreakdowns[0].criticalChance).toBe(baseLevel ? 15 : 0);
    expect(p.damageTotals.byElement.critical?.min || 0).toBeCloseTo(p.totalPhysicalDamage.min * (baseLevel ? .15 : 0));
  });

  it("uses PD2 Enchant's synergy and the ranged recipient's mastery without a caster double application", () => {
    const data = character("Enchant", 1);
    data.items[0] = weapon("bow", "Right Hand", "bow");
    data.items[0].damage = { one_handed: {}, two_handed: {}, missile: { minimum: 100, maximum: 200 } } as IItem["damage"];
    data.realSkills!.push({ skill: "Warmth", level: 20, baseLevel: 1 }, { skill: "Fire Mastery", level: 1, baseLevel: 1 });
    data.realStats = { fireSkillDamage: 10 } as CharacterData["realStats"];
    const profiles = calculateDamage(data).profiles.filter((p) => p.skillId === "Basic Attack" && p.weaponId.startsWith("primary:") && p.playerAuraId === "Enchant" && p.playerAuraLevel === 1);
    // EMin/EMax 25/35, HitShift 7; Warmth's one hard point adds 20%:
    // buff 15-21, then recipient +20% mastery and +10% item skill damage = 19-27.
    expect(profiles.find((p) => p.playerAuraCarrier === "self")!.totalElementalDamage.fire).toEqual({ min: 19, max: 27 });
    // External caster's allocation/mastery is unknown: bare buff 12-17, recipient +30%.
    expect(profiles.find((p) => p.playerAuraCarrier === "party")!.totalElementalDamage.fire).toEqual({ min: 15, max: 22 });
  });

  it("uses Cold Enchant's Chilling Armor hard points and the recipient's cold bonus", () => {
    const data = character("Cold Enchant", 1);
    data.realSkills!.push({ skill: "Chilling Armor", level: 20, baseLevel: 1 }, { skill: "Cold Mastery", level: 1, baseLevel: 1 });
    data.realStats = { coldSkillDamage: 10 } as CharacterData["realStats"];
    const p = calculateDamage(data).profiles.find((p) => p.skillId === "Basic Attack" && p.weaponId.startsWith("primary:") && p.playerAuraId === "Cold Enchant" && p.playerAuraCarrier === "self")!;
    // Base 3-4; +26% hard-point synergy stores 3-5, then +10% mastery/+10% item = 3-6.
    expect(p.totalElementalDamage.cold).toEqual({ min: 3, max: 6 });
  });

  it("adds minimum-only damage without manufacturing maximum damage", () => {
    const data = character();
    data.items.push({
      ...weapon("ring", "Right Ring"), category: "ring",
      properties: ["+12 to Minimum Damage"],
    });
    expect(baseProfile(data).totalPhysicalDamage).toEqual({ min: 112, max: 200 });
  });

  it("combines elemental min/max stats across items before normalizing", () => {
    const data = character();
    data.items[0].modifiers = [{ name: "firemindam", values: [10, 50] }] as IItem["modifiers"];
    data.items.push({
      ...weapon("ring", "Right Ring"), category: "ring",
      modifiers: [{ name: "firemindam", values: [20] }] as IItem["modifiers"],
    });
    expect(baseProfile(data).totalElementalDamage.fire).toEqual({ min: 30, max: 50 });
  });

  it("ignores stored gear when deriving attributes and skill levels", () => {
    const data = character("Fire Bolt", 1, 1);
    delete data.realSkills;
    data.items.push({
      ...weapon("stored", "Body Armor"), category: "armor",
      location: { zone: "Stored", storage: "Stash", equipment: "Body Armor" } as IItem["location"],
      properties: ["+100 to Strength", "+10 to All Skills", "+100% to Fire Skill Damage"],
    });
    const profile = baseProfile(data, "Fire Bolt");
    expect(profile.skillLevel).toBe(1);
    expect(profile.totalElementalDamage.fire).toEqual({ min: 3, max: 6 });
    expect(baseProfile(data).totalPhysicalDamage).toEqual({ min: 100, max: 200 });
  });

  it("applies SrcDam to off-weapon physical and elemental damage", () => {
    const data = character("Guided Arrow", 1, 1);
    data.items = [weapon("bow", "Right Hand", "bow"), {
      ...weapon("ring", "Right Ring"), category: "ring",
      properties: ["Adds 10-20 Damage", "Adds 20-40 Fire Damage"],
    }];
    data.items[0].damage = {
      one_handed: {}, two_handed: {}, missile: { minimum: 100, maximum: 200 },
    };
    // Guided Arrow SrcDam=64/128, +25% skill ED: (100+10)*.5*1.25.
    const profile = baseProfile(data, "Guided Arrow");
    expect(profile.totalPhysicalDamage).toEqual({ min: 68, max: 137 });
    expect(profile.totalElementalDamage.fire).toEqual({ min: 10, max: 20 });
  });

  it("uses weapon base stat coefficients from the armory", () => {
    const data = character();
    data.character.attributes.strength = 100;
    data.character.attributes.dexterity = 40;
    data.items[0].base!.stat_bonus = { strength: 75, dexterity: 75 };
    expect(baseProfile(data).totalPhysicalDamage).toEqual({ min: 205, max: 410 });
    data.character.attributes.strength = 101;
    data.character.attributes.dexterity = 41;
    // The engine truncates EACH attribute's percent before summing them.
    expect(baseProfile(data).totalPhysicalDamage).toEqual({ min: 205, max: 410 });
    data.items[0].base!.stat_bonus = { strength: 0, dexterity: 0 };
    expect(baseProfile(data).totalPhysicalDamage).toEqual({ min: 100, max: 200 });
  });

  it("emits one aura pulse regardless of weapon cycle hit count", () => {
    const data = character("Double Swing", 1, 1);
    data.character.class = { id: 4, name: "Barbarian" };
    data.items.push(weapon("left", "Left Hand"));
    const profiles = calculateDamage(data).profiles;
    const single = profiles.find((profile) =>
      profile.skillId === "Basic Attack" && profile.weaponId.startsWith("primary:right:") &&
      profile.selectedPlayerAura?.name === "Holy Fire" && profile.playerAuraCarrier === "self"
    );
    const cycle = profiles.find((profile) =>
      profile.skillId === "Double Swing" && profile.sequenceHits?.length === 2 &&
      profile.selectedPlayerAura?.name === "Holy Fire" && profile.playerAuraCarrier === "self"
    );
    expect(single?.auraPulseDamageTotals).toBeDefined();
    expect(cycle?.auraPulseDamageTotals).toEqual(single?.auraPulseDamageTotals);
  });

  it("uses allocated Battle Command levels for its all-skills bonus", () => {
    const data = character("Fire Bolt", 10, 10);
    data.realSkills!.push({ skill: "Battle Command", level: 35, baseLevel: 20 });
    const calculation = calculateDamage(data);
    const option = calculation.playerAuraOptions.find((aura) => aura.id === "Battle Command")!;
    expect(option.selfLevelBonuses.find((bonus) => bonus.level === 35)?.skillLevelBonus).toBe(3);
    const profile = calculation.profiles.find((entry) =>
      entry.skillId === "Fire Bolt" && entry.weaponId.startsWith("primary:right:") &&
      entry.playerAuraId === "Battle Command" && entry.playerAuraCarrier === "self" &&
      entry.playerAuraLevel === 35
    );
    expect(profile?.skillLevel).toBe(13);
  });

  it("precomputes every distinct manual all-skills bonus", () => {
    const profiles = calculateDamage(character("Fire Bolt", 10, 10)).profiles.filter((profile) =>
      profile.skillId === "Fire Bolt" && profile.weaponId.startsWith("primary:right:") &&
      profile.playerAuraId === "Battle Command" && profile.playerAuraCarrier === "self"
    );
    expect(profiles.map((profile) => [profile.playerAuraLevel, profile.skillLevel]))
      .toEqual(expect.arrayContaining([[1, 11], [10, 12], [20, 13]]));
  });

  it.each([
    // Raise Skeletal Mage 20 + Skeleton Mastery 20 assigns missile level 29.
    // Missiles.txt tier sums at 29, multiplied by 1 + 20*10/100 mastery.
    ["fire", 624, 705], ["cold", 540, 609],
    ["lightning", 87, 1350], ["poison", 456, 456],
  ])("uses the assigned missile level for the %s mage", (element, min, max) => {
    const data = character("Raise Skeletal Mage", 20, 20);
    data.realSkills!.push({ skill: "Skeleton Mastery", level: 20, baseLevel: 20 });
    const profile = calculateDamage(data).profiles.find((entry) =>
      entry.skillId === `Raise Skeletal Mage::${element}-mage` && entry.playerAuraId === "none"
    );
    expect(profile?.damageComponents).toHaveLength(1);
    expect(profile?.damageComponents[0].damage).toEqual({ min, max });
  });

  it("lets soft Skeleton Mastery levels improve both mage level and mastery", () => {
    const data = character("Raise Skeletal Mage", 5, 1);
    data.realSkills!.push({ skill: "Skeleton Mastery", level: 2, baseLevel: 1 });
    // Missile level = 2 + trunc((5-2)/2) = 3; fire 12-18, then +20%.
    const profile = calculateDamage(data).profiles.find((entry) =>
      entry.skillId === "Raise Skeletal Mage::fire-mage" && entry.playerAuraId === "none"
    );
    expect(profile?.totalElementalDamage.fire).toEqual({ min: 14, max: 21 });
  });

  it("uses the beta Skeleton Archer attack stage without the obsolete source synergy", () => {
    const data = character("Raise Skeleton Archer", 20, 20);
    data.realSkills!.push(
      { skill: "Skeleton Mastery", level: 20, baseLevel: 20 },
      { skill: "Raise Skeleton", level: 20, baseLevel: 20 },
    );
    // Beta raw 211-216 plus 40 flat physical, then +160% attack damage:
    // floor(251*2.6) to floor(256*2.6) = 652-665. DmgSymPerCalc is empty.
    const profile = calculateDamage(data).profiles.find((entry) =>
      entry.skillId === "Raise Skeleton Archer" && entry.playerAuraId === "none"
    );
    expect(profile?.totalPhysicalDamage).toEqual({ min: 652, max: 665 });
  });

  it.each([
    ["normal", 11, 15], ["nightmare", 42, 60], ["hell", 84, 120],
  ])("uses %s difficulty for Clay Golem's base attack", (difficulty, min, max) => {
    const data = character("Clay Golem", 1, 1);
    const profile = calculateDamage(data).profiles.find((entry) =>
      entry.skillId === `Clay Golem::${difficulty}` && entry.playerAuraId === "none"
    );
    expect(profile?.totalPhysicalDamage).toEqual({ min, max });
    expect(profile?.notes.join(" ")).toContain("difficulty");
  });

  it("preserves Vengeance's fractional damage between conversion and mastery", () => {
    const data = character("Vengeance", 1, 1);
    data.items[0].properties.push("+20% to Fire Skill Damage");
    // S13 flat 6-8; +5% elemental damage. Fire then gets 20% mastery.
    // (100+6)*1.05*1.2 -> 133; (200+8)*1.05*1.2 -> 262.
    const profile = baseProfile(data, "Vengeance");
    expect(profile.totalElementalDamage).toMatchObject({
      fire: { min: 133, max: 262 },
      cold: { min: 111, max: 218 },
      lightning: { min: 111, max: 218 },
    });
  });

  it("keeps Vengeance matching elements and hard-point synergies separate from physical ED", () => {
    const data = character("Vengeance", 1, 1);
    data.items[0].properties.push("Adds 10-20 Fire Damage", "Adds 30-40 Cold Damage");
    data.realSkills!.push({ skill: "Holy Fire", level: 30, baseLevel: 1 });
    // One hard Holy Fire point adds 2% to EACH element, giving 7% total.
    const profile = baseProfile(data, "Vengeance");
    expect(profile.totalElementalDamage).toMatchObject({
      fire: { min: 124, max: 243 },
      cold: { min: 145, max: 265 },
      lightning: { min: 113, max: 222 },
    });
    data.character.attributes.strength = 200;
    data.items.push({ ...weapon("armor", "Body Armor"), category: "armor", properties: ["+300% Enhanced Damage"] });
    const enhanced = baseProfile(data, "Vengeance");
    expect(enhanced.totalPhysicalDamage.min).toBeGreaterThan(profile.totalPhysicalDamage.min);
    expect(enhanced.totalElementalDamage).toEqual(profile.totalElementalDamage);
  });

  it("does not turn Call to Arms soft levels into Battle Command hard points", () => {
    const data = character("Fire Bolt", 10, 10);
    data.items[0].name = "Call to Arms";
    data.items[0].properties.push("+15 to Battle Command");
    const calculation = calculateDamage(data);
    const option = calculation.playerAuraOptions.find((aura) => aura.id === "Battle Command");
    expect(option?.selfLevelBonuses.find((bonus) => bonus.level === 15)?.skillLevelBonus).toBe(1);
    const profile = calculation.profiles.find((entry) =>
      entry.skillId === "Fire Bolt" && entry.playerAuraId === "Battle Command" &&
      entry.playerAuraCarrier === "self" && entry.playerAuraLevel === 15
    );
    expect(profile?.skillLevel).toBe(11);
  });

  it("preserves Battle Command hard points while exporting passive pierce", () => {
    const data = character("Cold Mastery", 20, 20);
    data.items[0].name = "Call to Arms";
    data.items[0].properties.push("+15 to Battle Command");
    const profile = calculateDamage(data).profiles.find((entry) =>
      entry.skillId === "Basic Attack" && entry.playerAuraId === "Battle Command" &&
      entry.playerAuraCarrier === "self" && entry.playerAuraLevel === 15
    );
    // Battle Command 15 with no allocated points grants +1 all skills:
    // Cold Mastery 21 = 5 + 20 = 25 pierce.
    expect(profile?.targetModifiers?.resistancePierce.cold).toBe(25);
  });

  it("keeps editable aura levels consistent with owned synergies and the weapon set", () => {
    const data = character("Holy Fire", 20, 20);
    data.character.class = { id: 3, name: "Paladin" };
    data.character.skills.push({ id: 100, name: "Resist Fire", level: 20 });
    data.realSkills!.push({ skill: "Resist Fire", level: 20, baseLevel: 20 });
    const swap = weapon("swap", "Right Hand Switch");
    swap.properties.push("+100% to Fire Skill Damage");
    data.items.push(swap);
    const calculation = calculateDamage(data);
    const option = calculation.playerAuraOptions.find((aura) => aura.id === "Holy Fire")!;
    for (const set of ["primary", "secondary"] as const) {
      const profile = calculation.profiles.find((entry) =>
        entry.weaponId.startsWith(`${set}:right:`) && entry.skillId === "Basic Attack" &&
        entry.playerAuraId === "Holy Fire" && entry.playerAuraLevel === 20 && entry.playerAuraCarrier === "self"
      )!;
      expect(option.selfLevelBonusesByWeaponSet?.[set]?.find((bonus) => bonus.level === 20)?.elementalDamage.fire)
        .toEqual(profile.totalElementalDamage.fire);
    }
    expect(option.selfLevelBonusesByWeaponSet!.secondary![19].elementalDamage.fire!.min)
      .toBe(option.selfLevelBonusesByWeaponSet!.primary![19].elementalDamage.fire!.min * 2);
    expect(option.selfLevelBonusesByWeaponSet!.primary![9].elementalDamage.fire!.min)
      .toBeGreaterThan(option.selfLevelBonuses[9].elementalDamage.fire!.min);
  });

  it("keeps Meteor ground-fire rates out of impact totals", () => {
    const profile = baseProfile(character("Meteor", 20, 20), "Meteor");
    const ground = profile.damageComponents.find((component) =>
      component.sourceRefs.some((ref) => ref.row === "meteorfire")
    );
    expect(ground?.damage.max).toBeGreaterThan(0);
    expect(ground?.includedInTotal).toBe(false);
    expect(ground?.notes.join(" ")).toContain("per second");
    expect(profile.damageTotals.overTimeDamage).toEqual({ min: 0, max: 0 });
    expect(profile.damageScope.label).toBe("per impact");
  });

  it("uses Fists of Fire meteor hit damage without a time multiplier", () => {
    const data = character("Fists of Fire", 20, 20);
    data.items[0].base!.type_code = "h2h";
    const profile = calculateDamage(data).profiles.find((entry) =>
      entry.skillId === "Fists of Fire" && entry.chargeNumber === 3 && entry.playerAuraId === "none"
    );
    const meteor = profile?.damageComponents.find((component) => component.damageType === "fire" &&
      component.sourceRefs.some((ref) => ref.row === "fofmeteor")
    );
    // Missiles.txt: 1+7*1+8*1+4*9 and 2+7*1+8*2+4*10.
    expect(meteor?.damage).toEqual({ min: 52, max: 65 });
    expect(meteor?.timing).toBe("instant");
  });

  // Synthetic allocations intentionally exercise all source-backed paths in
  // each class. This is an invariant stress test, not an in-game build oracle.
  it.each([
    ["ama", "Amazon"], ["sor", "Sorceress"], ["nec", "Necromancer"],
    ["pal", "Paladin"], ["bar", "Barbarian"], ["dru", "Druid"], ["ass", "Assassin"],
  ])("keeps all %s profile totals finite and reconciled", (classCode, className) => {
    const [header, ...lines] = fs.readFileSync(path.resolve(
      "src/game-data/pd2/season-14/Skills.txt"
    ), "utf8").trimEnd().split(/\r?\n/).map((line) => line.split("\t"));
    const data = character();
    data.character.class.name = className;
    data.realSkills = lines.filter((row) =>
      row[header.indexOf("charclass")] === classCode && row[header.indexOf("InGame")] === "1"
    ).map((row) => ({ skill: row[header.indexOf("skill")], level: 40, baseLevel: 20 }));
    data.character.skills = data.realSkills.map((skill, id) => ({ id, name: skill.skill, level: 20 }));
    const left = weapon("left", "Left Hand", classCode === "ass" ? "h2h" : "swor");
    if (classCode === "ass") data.items[0].base!.type_code = "h2h";
    data.items.push(left);
    const bow = weapon("switch", "Right Hand Switch", "bow");
    bow.damage = { one_handed: {}, two_handed: {}, missile: { minimum: 10, maximum: 20 } };
    data.items.push(bow);
    const formulaCalls = jest.spyOn(gameFormula, "evaluateIntegerFormula");
    const calculation = calculateDamage(data);
    const failures = formulaCalls.mock.results.flatMap((result, index) =>
      result.type === "throw" ? [formulaCalls.mock.calls[index][0]] : []
    );
    formulaCalls.mockRestore();
    expect(failures).toEqual([]);
    expect(calculation.profiles.length).toBeGreaterThan(0);
    expect(calculation.skillOptions.length).toBeGreaterThan(1);
    for (const profile of calculation.profiles) {
      const sum = { min: 0, max: 0 };
      const ids = new Set<string>();
      for (const component of profile.damageComponents) {
        expect(ids.has(component.id)).toBe(false);
        ids.add(component.id);
        expect(Number.isFinite(component.damage.min)).toBe(true);
        expect(Number.isFinite(component.damage.max)).toBe(true);
        expect(component.damage.min).toBeGreaterThanOrEqual(0);
        expect(component.damage.max).toBeGreaterThanOrEqual(component.damage.min);
        if (component.includedInTotal !== false) {
          sum.min += component.damage.min;
          sum.max += component.damage.max;
        }
      }
      expect(profile.damageTotals.combinedDamage.min).toBeCloseTo(sum.min, 6);
      expect(profile.damageTotals.combinedDamage.max).toBeCloseTo(sum.max, 6);
      for (const strike of profile.strikeBreakdowns) {
        expect(strike.physicalComponentIds.every((id) => ids.has(id))).toBe(true);
      }
    }
  });
});
