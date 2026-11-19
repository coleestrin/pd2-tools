import fs from "fs";
import path from "path";
import {
  actionTiming,
  applicationCoverage,
  calculateEffectiveDamage,
  chanceToHit,
  defaultCombatSettings,
  effectiveResistance,
} from "./effective-damage";
import {
  getCombatCatalog,
  emptyCombatResistances,
  readCombatTable,
} from "./combat-data";
import type { DamageProfile, DamageComponent } from "../types/damage";
import type {
  CombatCatalog,
  CombatSettings,
  CombatWeapon,
  DamageCombatData,
} from "../types/combat";

const range = (value: number) => ({ min: value, max: value });
function setup(mode: "weapon" | "spell" | "summon" = "weapon") {
  const components: DamageComponent[] = [
    {
      id: "physical",
      label: "Physical",
      damage: range(100),
      damageType: "physical",
      timing: "instant",
      source: "weapon",
      sourceRefs: [],
      notes: [],
    },
  ];
  const profile = {
    skillId: "Basic Attack",
    skillName: "Basic Attack",
    skillLevel: 1,
    weaponId: "weapon",
    skillDamageMode: mode,
    damageScope: { label: "per hit" },
    damageComponents: components,
    activeAuras: [],
    strikeBreakdowns: [],
    breakdown: { physicalBonusPercent: { total: 0 } },
  } as unknown as DamageProfile;
  const weapon: CombatWeapon = {
    baseAttackRating: 1000,
    attackRatingPercent: 0,
    mastery: Array(8).fill(0),
    weaponClass: "1hs",
    ownWeaponClass: "1hs",
    speed: 0,
    weaponIAS: 0,
    gearIAS: 0,
    fcr: 0,
    ignoreDefense: false,
    targetDefensePercent: 0,
    demonAttackRating: 0,
    undeadAttackRating: 0,
    demonDamage: 0,
    undeadDamage: 0,
    crushingBlow: 0,
    crushingEfficiency: 0,
    openWounds: 0,
    openWoundsDps: 0,
    pierce: emptyCombatResistances(),
  };
  const combat: DamageCombatData = {
    level: 90,
    classToken: "BA",
    weapons: { weapon },
    effects: {},
    skills: {
      "Basic Attack": {
        animation: "A1",
        sequence: "",
        attackRate: true,
        rollback: 100,
        levels: Array.from({ length: 81 }, () => ({
          attackRatingPercent: 0,
          attackSpeed: 0,
          cooldown: 0,
          hits: 1,
          reductions: emptyCombatResistances(),
          pierce: emptyCombatResistances(),
        })),
      },
    },
  };
  const catalog: CombatCatalog = {
    monsters: [
      {
        id: "target",
        name: "Target",
        demon: false,
        undead: false,
        boss: false,
        primeEvil: false,
        noRatio: true,
        levels: [90, 90, 90],
        defense: [1000, 1000, 1000],
        life: [range(8000), range(8000), range(8000)],
        block: [0, 0, 0],
        resistances: Array.from({ length: 3 }, emptyCombatResistances),
      },
    ],
    areas: [],
    monsterLevels: Array.from({ length: 201 }, (_, level) => ({
      level,
      defense: [100, 100, 100],
      life: [100, 100, 100],
    })),
    pulseRates: {},
    animations: {
      BAA11HS: { frames: 16, speed: 256, events: [8] },
      BASC1HS: { frames: 16, speed: 256, events: [8] },
    },
    sequences: {},
  };
  const settings = {
    ...defaultCombatSettings(),
    monsterId: "target",
    rateOverride: 2,
    hitChanceOverride: 100,
  };
  const run = (changes: Partial<CombatSettings> = {}) =>
    calculateEffectiveDamage(profile, combat, catalog, {
      ...settings,
      ...changes,
    })[0];
  return { profile, weapon, combat, catalog, settings, run };
}

describe("effective damage: independent arithmetic and boundaries", () => {
  it("adds Battle Command flat passive AR before percentage bonuses without mutating the weapon", () => {
    const {profile,weapon,run} = setup();
    weapon.attackRatingPercent = 100;
    weapon.skillBonuses = Array.from({length:8}, (_, i) => ({baseAttackRating:i * 10, pierce:emptyCombatResistances(), gearIAS:0, crushingBlow:0, crushingEfficiency:0, openWounds:0, openWoundsDps:0}));
    profile.activeAuras = [{name:"Battle Command",level:20,carrier:"party",source:"manual"}];
    expect(run().attackRating).toBe(2060);
    expect(weapon.baseAttackRating).toBe(1000);
  });

  it("includes beta maps beyond the old ID boundary and omits empty guild halls", () => {
    const catalog = getCombatCatalog();
    for (const id of ["207", "208", "209", "210"]) {
      const area = catalog.areas.find((a) => a.id === id)!;
      expect(area.map).toBe(true);
      expect(area.monsters[2].length).toBeGreaterThan(0);
    }
    expect(catalog.areas.some((a) => ["202","203","204","205","206"].includes(a.id))).toBe(false);
  });
  it("keeps every curated Hell map pool selectable after spawn IDs are consolidated", () => {
    const catalog = getCombatCatalog();
    const swamp = catalog.areas.find((area) => area.id === "162")!;
    expect(swamp.name).toBe("Decaying Swamplands");
    expect(swamp.map).toBe(true);
    expect(swamp.monsters).toEqual([[], [], expect.arrayContaining([
      "unraveler3Rat", "bonefetish4Rat", "mummy5Rat", "willowisp1Rat", "skmage_fire3Rat", "overseerRat",
    ])]);
    expect(swamp.monsters[2]).toHaveLength(6);
  });
  it("keeps the browser and API model and contracts byte-identical for isolated Docker builds", () => {
    for (const file of ["utils/effective-damage.ts", "types/combat.ts"])
      expect(
        fs
          .readFileSync(path.resolve(process.cwd(), "src", file), "utf8")
          .replace(/\r/g, "")
      ).toBe(
        fs
          .readFileSync(path.resolve(process.cwd(), "../web/src", file), "utf8")
          .replace(/\r/g, "")
      );
  });
  it.each([
    [50, [], 20, 30],
    [110, [21], 200, 100],
    [110, [21, 21], 20, 70],
    [120, [40], 0, 100],
    [120, [42], 0, 99],
    [0, [21], 0, -10],
    [-40, [], 20, -50],
    [0, [500], 500, -100],
  ])(
    "resistance %s breakers %s pierce %s => %s",
    (base, breakers, pierce, expected) =>
      expect(effectiveResistance(base, breakers, pierce)).toBe(expected)
  );
  it.each([
    [1000, 1000, 90, 90, 0.55],
    [1000, 0, 90, 90, 1],
    [0, 1000, 90, 90, 0.05],
    [1, 0, 1, 99, 0.05],
    [1000, 1000, 1, 1, 0.55],
    [0, 0, 90, 90, 1],
    [-100, 100, 90, 90, 0.05],
    [0, -100, 90, 90, 1],
  ])(
    "integer PD2 attack roll %s/%s at levels %s/%s",
    (ar, def, a, d, expected) =>
      expect(chanceToHit(ar, def, a, d)).toBe(expected)
  );
  it("preserves the raw profile, including excluded informational components", () => {
    const { profile, run } = setup();
    profile.damageComponents.push({
      ...profile.damageComponents[0],
      id: "excluded",
      damage: range(9999),
      includedInTotal: false,
    });
    const before = JSON.stringify(profile);
    const r = run({
      resistanceBonus: { ...emptyCombatResistances(), physical: 50 },
    });
    expect(r.raw).toEqual(range(100));
    expect(r.landed).toEqual(range(50));
    expect(r.dps).toBe(100);
    expect(JSON.stringify(profile)).toBe(before);
  });
  it("recomputes demon ED and critical/deadly expected physical components before resistance", () => {
    const { profile, weapon, catalog, run } = setup();
    catalog.monsters[0].demon = true;
    weapon.demonDamage = 100;
    profile.damageComponents.push({
      ...profile.damageComponents[0],
      id: "critical:s",
      damage: range(50),
      damageType: "critical",
    });
    profile.strikeBreakdowns = [
      {
        id: "s",
        physicalComponentIds: ["physical"],
        criticalChance: 50,
        criticalMultiplier: 2,
        effectiveDeadlyStrikeChance: 0,
        deadlyStrikeMultiplier: 1.5,
      } as DamageProfile["strikeBreakdowns"][number],
    ];
    expect(run().raw).toEqual(range(150));
    expect(run().landed).toEqual(range(300));
    expect(run().dps).toBe(600);
  });
  it("applies accuracy then block to weapons; spells and Smite bypass attack rolls and block", () => {
    const { profile, catalog, run } = setup();
    catalog.monsters[0].block = [50, 50, 50];
    expect(run({ hitChanceOverride: 80 }).hitChance).toBe(0.4);
    expect(run({ hitChanceOverride: 80 }).dps).toBe(80);
    profile.skillDamageMode = "spell";
    expect(run({ hitChanceOverride: null }).dps).toBe(200);
    expect(run({ hitChanceOverride: 0 }).dps).toBe(0);
    profile.skillDamageMode = "weapon";
    profile.skillName = "Smite";
    expect(run({ hitChanceOverride: null }).dps).toBe(200);
  });
  it("owned Sanctuary bypasses ordinary undead physical immunity without leaking to party, summons, bosses or procs", () => {
    const { profile, weapon, catalog, run } = setup();
    catalog.monsters[0].undead = true;
    catalog.monsters[0].resistances[2].physical = 100;
    weapon.crushingBlow = 100;
    weapon.openWounds = 100;
    profile.activeAuras = [
      { name: "Sanctuary", level: 20, source: "manual", carrier: "self" },
    ];
    expect(run().landed).toEqual(range(100));
    expect(run().crushingDps).toBe(0);
    expect(run().openWoundsDps).toBe(0);
    profile.activeAuras[0].carrier = "party";
    expect(run().landed).toEqual(range(0));
    profile.activeAuras[0].carrier = "self";
    catalog.monsters[0].boss = true;
    expect(run().landed).toEqual(range(0));
    catalog.monsters[0].boss = false;
    profile.skillDamageMode = "summon";
    expect(run().landed).toEqual(range(0));
  });

  it("ITD cannot bypass bosses, and boss target-defense reduction is halved", () => {
    const { weapon, catalog, run } = setup();
    weapon.ignoreDefense = true;
    expect(run({ hitChanceOverride: null }).hitChance).toBe(1);
    catalog.monsters[0].boss = true;
    expect(run({ hitChanceOverride: null }).hitChance).toBe(0.55);
    weapon.targetDefensePercent = 100;
    expect(run({ hitChanceOverride: null }).hitChance).toBe(0.74);
  });
  it("does not multiply a poison total by attacks per second; zero events means zero poison uptime", () => {
    const { profile, run } = setup("spell");
    profile.damageComponents = [
      {
        ...profile.damageComponents[0],
        damageType: "poison",
        timing: "over_time",
        damage: range(500),
        poisonDamage: { total: 500, durationSeconds: 5 },
      },
    ];
    expect(run({ rateOverride: 10 }).dps).toBe(100);
    expect(run({ rateOverride: 0.1 }).dps).toBe(50);
    expect(run({ rateOverride: 0 }).dps).toBe(0);
  });
  it("does not multiply stream or ground DPS by action speed", () => {
    const { profile, run } = setup("spell");
    profile.damageComponents[0].timing = "over_time";
    expect(run({ rateOverride: 1 }).dps).toBe(100);
    expect(run({ rateOverride: 20 }).dps).toBe(100);
    expect(run({ rateOverride: 0 }).dps).toBe(0);
    expect(run({ hitChanceOverride: 0 }).dps).toBe(0);
  });
  it("models zero and fractional poison applications exactly over phase", () => {
    expect(applicationCoverage(0, 1, 5)).toBe(0);
    expect(applicationCoverage(0.1, 1, 5)).toBe(0.5);
    expect(applicationCoverage(1, 0.5, 2)).toBe(0.75);
  });
  it("uses current life, 1/8 normal CB, ranged penalty, player count, and ignores gear pierce for CB", () => {
    const { weapon, profile, run } = setup();
    weapon.crushingBlow = 100;
    expect(run().crushingDps).toBe(2000);
    expect(run({ currentLifePercent: 50 }).crushingDps).toBe(1000);
    expect(run({ players: 8 }).crushingDps).toBeCloseTo(
      ((8000 * 5.9) / 17.8) * 2
    );
    weapon.weaponClass = "bow";
    expect(run().crushingDps).toBeCloseTo(2000 / 1.5);
    weapon.weaponClass = "1hs";
    weapon.pierce.physical = 100;
    expect(run().crushingDps).toBe(2000);
    expect(run().instantDps).toBe(300);
    profile.damageScope.label = "per cycle";
  });
  it("distinguishes prime evil and special map-boss CB rules, not the generic boss flag", () => {
    const { weapon, catalog, run } = setup();
    weapon.crushingBlow = 100;
    catalog.monsters[0].boss = true;
    expect(run().crushingDps).toBe(2000);
    catalog.monsters[0].primeEvil = true;
    expect(run().crushingDps).toBeCloseTo(16000 / 70);
    expect(run({ currentLifePercent: 50 }).crushingDps).toBeCloseTo(8000 / 570);
    expect(run({ mapBoss: true }).crushingDps).toBeCloseTo(16000 / 30);
  });
  it("caps combined dual-wield Open Wounds at three stacks, including 100% proc boundaries", () => {
    const { weapon, run } = setup();
    weapon.openWounds = 100;
    weapon.hands = [{ ...weapon }, { ...weapon }];
    const expected =
      (((14 * 9 + 15 * 18 + 15 * 27 + 15 * 36 + 30 * 45 + 25) * 25) / 256) * 3;
    expect(run().openWoundsDps).toBe(expected);
    expect(run({ rateOverride: 0 }).openWoundsDps).toBe(0);
    expect(run({ rateOverride: 0.1 }).openWoundsDps).toBeCloseTo(expected / 3);
    weapon.hands.forEach((hand) => {
      hand.openWoundsDps = 254;
    });
    expect(run().openWoundsDps).toBeCloseTo(
      expected + ((5 * 254 * 25) / 256) * 3
    );
  });
  it("adds Thorns aura Open Wounds, using the passivestat damage only for its owner", () => {
    const { profile, combat, run } = setup();
    const base = 14 * 9 + 15 * 18 + 15 * 27 + 15 * 36 + 30 * 45 + 25;
    combat.effects.Thorns = Array.from({ length: 81 }, () => ({
      attackSpeed: 0,
      attackRatingPercent: 0,
      defensePercent: 0,
      defenseFlat: 0,
      reductions: emptyCombatResistances(),
      openWounds: 100,
      openWoundsDps: 32,
      selfOpenWoundsDps: 42,
    }));
    expect(run().openWoundsDps).toBe(0);
    profile.activeAuras = [
      { name: "Thorns", level: 20, source: "mercenary_native", carrier: "party" },
    ];
    expect(run().openWoundsDps).toBeCloseTo((((base + 5 * 32) * 25) / 256) * 3);
    profile.activeAuras = [
      { name: "Thorns", level: 20, source: "player_skill", carrier: "self" },
    ];
    expect(run().openWoundsDps).toBeCloseTo((((base + 5 * 42) * 25) / 256) * 3);
  });

  it("can model blockable and unblockable observed summon payloads without guessing their AI", () => {
    const { catalog, run } = setup("summon");
    catalog.monsters[0].block = [50, 50, 50];
    expect(run().hitChance).toBe(0.5);
    expect(run({ blockChanceOverride: 0 }).hitChance).toBe(1);
    expect(run({ blockChanceOverride: 100 }).dps).toBe(0);
  });

  it("scales active summon counts and does not inherit caster accuracy or resistance pierce", () => {
    const { weapon, run } = setup("summon");
    weapon.pierce.physical = 100;
    expect(run({ hitChanceOverride: null }).dps).toBeNull();
    expect(run({ summonCount: 3 }).dps).toBe(600);
    expect(run().landed).toEqual(range(100));
  });
  it("adds owned aura pulses separately at table cadence, excluding a party carrier's pulses", () => {
    const { profile, catalog, run } = setup();
    catalog.pulseRates["Holy Fire"] = 1;
    profile.auraPulseDamageComponents = [
      {
        ...profile.damageComponents[0],
        source: "aura",
        damageType: "fire",
        damage: range(50),
        sourceRefs: [
          { table: "Skills.txt", row: "Holy Fire", columns: ["perdelay"] },
        ],
      },
    ];
    expect(run().auraPulseDps).toBe(50);
    expect(run().dps).toBe(250);
    profile.activeAuras = [
      { name: "Holy Fire", level: 20, source: "manual", carrier: "party" },
    ];
    expect(run().auraPulseDps).toBe(0);
  });
  it("fills arbitrary aura levels, replaces stale pulses, and uses the selected weapon set without changing raw hits", () => {
    const { profile, combat, catalog, run } = setup();
    catalog.pulseRates["Holy Fire"] = 1;
    combat.auraPulses = {
      primary: {
        "Holy Fire": Array.from({ length: 81 }, () => ({ fire: range(50) })),
      },
      secondary: {
        "Holy Fire": Array.from({ length: 81 }, () => ({ fire: range(100) })),
      },
    };
    profile.activeAuras = [
      { name: "Holy Fire", level: 13, carrier: "self", source: "manual" },
    ];
    profile.auraPulseDamageComponents = [
      {
        ...profile.damageComponents[0],
        id: "old:Holy Fire:1:self:fire",
        damage: range(5),
        damageType: "fire",
        sourceRefs: [{ table: "Skills.txt", row: "Holy Fire", columns: [] }],
      },
    ];
    const before = JSON.stringify(profile);
    expect(run().auraPulseDps).toBe(50);
    expect(run().raw).toEqual(range(100));
    expect(JSON.stringify(profile)).toBe(before);
    combat.weapons["secondary:weapon"] = combat.weapons.weapon;
    profile.weaponId = "secondary:weapon";
    expect(run().auraPulseDps).toBe(100);
    profile.activeAuras[0].carrier = "party";
    expect(run().auraPulseDps).toBe(0);
  });
  it("deduplicates the strongest curse and applies hard-point mastery skill bonuses without mutating combat data", () => {
    const { combat, weapon, profile, run } = setup();
    weapon.mastery = [0, 10, 20, 30, 40, 50, 60, 70];
    combat.effects["Amplify Damage"] = Array.from(
      { length: 81 },
      (_, level) => ({
        attackSpeed: 0,
        attackRatingPercent: 0,
        defensePercent: 0,
        defenseFlat: 0,
        reductions: { ...emptyCombatResistances(), physical: level },
      })
    );
    profile.activeAuras = [
      { name: "Amplify Damage", level: 20, source: "manual", carrier: "party" },
      { name: "Battle Command", level: 20, source: "manual", carrier: "self" },
    ];
    const before = JSON.stringify(combat);
    const r = run({ debuffs: [{ name: "Amplify Damage", level: 10 }] });
    expect(r.resistances.physical).toBe(-10);
    expect(r.attackRating).toBe(1300);
    expect(JSON.stringify(combat)).toBe(before);
  });
  it.each([
    "Shiver Armor",
    "Chilling Armor",
    "Hydra",
    "Lesser Hydra",
    "Fissure",
    "Volcano",
    "Blizzard",
    "Shock Web",
  ])(
    "%s requires damage-event cadence rather than buff/player cast speed",
    (name) => {
      const { profile, combat, catalog } = setup("spell");
      profile.skillName = name;
      expect(actionTiming(profile, combat, catalog, null).rate).toBeNull();
      expect(actionTiming(profile, combat, catalog, 2).rate).toBe(2);
    }
  );

  it("automatic animation uses IAS/FCR breakpoints, cooldowns, and explicit inputs for AI or uncertain follow-ups", () => {
    const { profile, weapon, combat, catalog } = setup();
    const timing = () => actionTiming(profile, combat, catalog, null);
    expect(timing().frames).toBe(15);
    weapon.gearIAS = 60;
    expect(timing().frames).toBe(11);
    combat.skills[profile.skillId].levels[1].cooldown = 50;
    expect(timing().frames).toBe(50);
    profile.skillDamageMode = "summon";
    expect(timing().rate).toBeNull();
    expect(actionTiming(profile, combat, catalog, 3).rate).toBe(3);
    profile.skillDamageMode = "weapon";
    combat.skills[profile.skillId].levels[1].hits = 3;
    combat.skills[profile.skillId].rollback = 60;
    expect(timing().rate).toBeNull();
  });
  it("area comparisons use each species, difficulty scaling, modifiers, and keep bosses at native levels", () => {
    const { catalog, run } = setup();
    catalog.monsters[0].noRatio = false;
    catalog.areas = [
      {
        id: "map",
        name: "Map",
        map: true,
        levels: [1, 50, 85],
        monsters: [["target"], ["target"], ["target"]],
      },
    ];
    expect(run({ areaId: "map" }).level).toBe(85);
    catalog.monsters[0].boss = true;
    expect(run({ areaId: "map" }).level).toBe(90);
    expect(run({ players: 8, lifeBonus: 100 }).life.min).toBeCloseTo(94400);
    expect(run({ defenseBonus: 100 }).defense).toBe(2000);
  });
  it("preserves explicit Season 14 class/socket changes and PD2 crossbow animation overrides", () => {
    const classes = new Map(
      readCombatTable("CharStats").map((row) => [row.class, row])
    );
    expect(classes.get("Sorceress")?.LifePerLevel).toBe("5");
    expect(classes.get("Sorceress")?.ManaPerLevel).toBe("12");
    expect(classes.get("Amazon")?.ManaPerMagic).toBe("8");
    expect(classes.get("Barbarian")?.ManaPerMagic).toBe("6");
    expect(
      readCombatTable("Weapons").find((row) => row.code === "amf")?.gemsockets
    ).toBe("3");
    expect(getCombatCatalog().animations.AMA1XBW.speed).toBe(294);
  });

  it("extracts known Hell Diablo and one-second aura pulse data from committed tables", () => {
    const c = getCombatCatalog(),
      m = c.monsters.find((m) => m.id === "diablo")!;
    expect(m.levels[2]).toBe(94);
    expect(
      Math.floor((m.defense[2] * c.monsterLevels[94].defense[2]) / 100)
    ).toBe(2534);
    expect((m.life[2].min * c.monsterLevels[94].life[2]) / 100).toBe(180425);
    expect(m.resistances[2].physical).toBe(45);
    expect(c.pulseRates["Holy Fire"]).toBe(1);
    expect(c.pulseRates["Resist Fire"]).toBeUndefined();
    const known = new Set(c.monsters.map((m) => m.id));
    for (const a of c.areas)
      for (const population of a.monsters)
        expect(population.every((id) => known.has(id))).toBe(true);
  });
  it("sweeps resistance and pierce boundaries for finite, bounded and monotone output", () => {
    for (let base = -100; base <= 300; base++)
      for (const reduction of [0, 1, 19, 20, 99, 100, 201]) {
        let previous = Infinity;
        for (const pierce of [0, 1, 19, 20, 99, 100, 201]) {
          const r = effectiveResistance(base, [reduction], pierce);
          expect(Number.isFinite(r)).toBe(true);
          expect(r).toBeGreaterThanOrEqual(-100);
          expect(r).toBeLessThanOrEqual(previous);
          previous = r;
        }
      }
  });
});


describe("merged target defenses and sustained damage", () => {
  it("keeps map and dungeon pools in Hell without inventing Normal or Nightmare spawns", () => {
    for (const area of getCombatCatalog().areas.filter((area) => area.map)) {
      expect(area.monsters[0]).toEqual([]);
      expect(area.monsters[1]).toEqual([]);
      expect(area.monsters[2].length).toBeGreaterThan(0);
    }
  });
  function defended(mode: "weapon" | "spell" | "summon" = "spell") {
    const data = setup(mode);
    const target = data.catalog.monsters[0];
    const stats = { resistances: emptyCombatResistances(), poisonLengthReduction: 0,
      curseResistance: 0, curseEffectReduction: 0, receivesImmunityAura: false,
      flatPhysicalReduction: 0, flatMagicReduction: 0, absorbPercent: {}, absorbFlat: {}, block: 0, notes: [] };
    target.target = { id: target.id, monsterId: target.id, name: target.name,
      kind: "monster", creatureType: "other", difficulties: { normal: stats, nightmare: stats, hell: stats },
      fixedModifiers: [], areas: [], notes: [] };
    return { ...data, stats };
  }
  it("applies flat absorption per stream event in the full DPS path", () => {
    const { profile, stats, run } = defended();
    profile.damageComponents = [{ ...profile.damageComponents[0], damageType: "fire", damage: range(2500), timing: "over_time", damageEventsPerUnit: 25 }];
    stats.absorbFlat = { fire: 8 };
    const result = run();
    expect(result.landed).toEqual(range(2300));
    expect(result.dotDps).toBe(2300);
    expect(result.absorptionHealing).toEqual(range(200));
  });
  it("applies reduction to each critical outcome before averaging and attack cadence", () => {
    const { profile, stats, run } = defended("weapon");
    profile.damageComponents[0].damage = range(10);
    stats.flatPhysicalReduction = 15;
    profile.strikeBreakdowns = [{ id: "strike", physicalComponentIds: ["physical"], criticalChance: 50,
      effectiveDeadlyStrikeChance: 0, criticalMultiplier: 2, deadlyStrikeMultiplier: 1.5 }] as DamageProfile["strikeBreakdowns"];
    expect(run().landed).toEqual(range(2.5));
    expect(run().instantDps).toBe(5);
  });
  it("uses reduced poison duration for coverage without multiplying total poison by rate", () => {
    const { profile, stats, run } = defended();
    profile.damageComponents = [{ ...profile.damageComponents[0], damageType: "poison", timing: "over_time", damage: range(200), poisonDamage: { total: 200, durationSeconds: 2 } }];
    stats.poisonLengthReduction = 50;
    const result = run({ rateOverride: 0.5 });
    expect(result.landed).toEqual(range(100));
    expect(result.dotDps).toBe(50); // 100 DPS, one-second duration, 50% coverage.
  });
  it("keeps separate ground DPS when the raw profile contains only impact totals", () => {
    const { profile, run } = defended();
    profile.damageComponents.push({ ...profile.damageComponents[0], id: "ground", damageType: "fire", damage: range(250),
      timing: "over_time", includedInTotal: false, damageEventsPerUnit: 25 });
    const result = run();
    expect(result.raw).toEqual(range(100));
    expect(result.landed).toEqual(range(100));
    expect(result.instantDps).toBe(200);
    expect(result.dotDps).toBe(250);
    expect(result.dps).toBe(450);
  });
  it("blocks curses on curse-immune targets without blocking Battle Cry", () => {
    const { stats, combat, run } = defended();
    stats.resistances.physical = 50;
    stats.curseResistance = 100;
    for (const name of ["Amplify Damage", "Battle Cry"]) combat.effects[name] = Array.from({ length: 81 }, () => ({
      attackSpeed: 0, attackRatingPercent: 0, defensePercent: 0, defenseFlat: 0,
      reductions: { ...emptyCombatResistances(), physical: 40 },
    }));
    expect(run({ debuffs: [{ name: "Amplify Damage", level: 20 }] }).resistances.physical).toBe(50);
    expect(run({ debuffs: [{ name: "Battle Cry", level: 20 }] }).resistances.physical).toBe(10);
  });
  it("does not let target protection or immunity aura leak into map comparisons", () => {
    const { stats, catalog, run } = defended();
    stats.receivesImmunityAura = true;
    expect(run({ protected: true }).dps).toBe(0);
    expect(run({ immunityAura: true }).resistances.physical).toBe(200);
    catalog.areas = [{ id: "map", name: "Map", map: true, levels: [90,90,90], monsters: [["target"],["target"],["target"]] }];
    expect(run({ areaId: "map", protected: true, immunityAura: true }).dps).toBe(200);
  });
  it("uses the source-backed pet pierce instead of inheriting all caster pierce", () => {
    const { profile, stats, run } = defended("summon");
    profile.damageComponents[0].damageType = "fire";
    profile.targetModifiers = { resistancePierce: { fire: 5 }, convictionLevel: 0 };
    stats.resistances.fire = 50;
    expect(run().landed).toEqual(range(55));
  });
  it("uses the owned hard-point Battle Command curve for passive combat bonuses", () => {
    const { profile, combat, run } = defended("weapon");
    profile.activeAuras = [{ name: "Battle Command", level: 60, carrier: "self", source: "player_skill" }];
    combat.commandSelfBonuses = Array(81).fill(1); // CTA with zero hard points.
    combat.weapons.weapon.skillBonuses = Array.from({ length: 8 }, (_, i) => ({ baseAttackRating: i * 10,
      pierce: emptyCombatResistances(), gearIAS: 0, crushingBlow: 0, crushingEfficiency: 0, openWounds: 0, openWoundsDps: 0 }));
    expect(run().attackRating).toBe(1010);
  });
  it("shares the exact mitigation implementation between API and browser builds", () => {
    expect(fs.readFileSync(path.join(__dirname, "target-damage.ts"), "utf8"))
      .toBe(fs.readFileSync(path.resolve("../web/src/utils/target-damage.ts"), "utf8"));
  });
});
