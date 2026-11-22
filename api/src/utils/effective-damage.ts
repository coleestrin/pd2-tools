import { calculateTargetDamage, EMPTY_TARGET_CONDITIONS, getEffectiveResistance } from "./target-damage";
import type { MonsterTarget, MonsterTargetStats } from "../types/damage-target";
import type {
  DamageProfile,
  DamageRange,
  DamageElement,
  DamageComponent,
} from "../types/damage";
import type {
  CombatCatalog,
  CombatSettings,
  CombatResistances,
  DamageCombatData,
  EffectiveCombatResult,
} from "../types/combat";

const elements: DamageElement[] = [
  "physical",
  "fire",
  "cold",
  "lightning",
  "poison",
  "magic",
];
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const average = (r: DamageRange) => (r.min + r.max) / 2;
const add = (a: DamageRange, b: DamageRange): DamageRange => ({
  min: a.min + b.min,
  max: a.max + b.max,
});
const scale = (r: DamageRange, m: number): DamageRange => ({
  min: r.min * m,
  max: r.max * m,
});
const zero = (): DamageRange => ({ min: 0, max: 0 });
export const defaultCombatSettings = (): CombatSettings => ({
  mapBoss: false,
  attackSlow: 0,
  castSlow: 0,
  difficulty: 2,
  areaId: null,
  monsterId: "diablo",
  players: 1,
  levelBonus: 0,
  defenseBonus: 0,
  lifeBonus: 0,
  resistanceBonus: {
    physical: 0,
    fire: 0,
    cold: 0,
    lightning: 0,
    poison: 0,
    magic: 0,
  },
  debuffs: [],
  rateOverride: null,
  hitChanceOverride: null,
  blockChanceOverride: null,
  uptime: 100,
  overlap: 1,
  summonCount: 1,
  currentLifePercent: 100,
});

export function effectiveResistance(
  base: number,
  breakers: number[],
  pierce: number
): number {
  return getEffectiveResistance(base, breakers, pierce);
}

// PD2 replaces the vanilla 95% cap: its 111% AR ratio and diminished excess can reach 100%.
export function chanceToHit(
  ar: number,
  defense: number,
  attackerLevel: number,
  defenderLevel: number
): number {
  if (defense < 0) {
    ar -= defense;
    defense = 0;
  }
  if (ar < 0) {
    defense -= ar;
    ar = 0;
  }
  const sum = ar + defense,
    levels = attackerLevel + defenderLevel;
  const ratio = sum ? Math.trunc((111 * ar) / sum) : 100;
  if (!levels) return 0.05;
  let chance = Math.trunc((ratio * 2 * attackerLevel) / levels);
  if (chance > 95 && attackerLevel > 0) {
    let excess = ratio - Math.trunc((95 * levels) / (2 * attackerLevel));
    if (sum) excess = Math.trunc((Math.trunc((sum * excess) / 111) * 90) / sum);
    chance = 95 + Math.trunc((excess * 2 * attackerLevel) / levels);
  }
  return clamp(Math.trunc(chance), 5, 100) / 100;
}

// Fractional opportunity counts interpolate over the phase of regularly spaced attacks.
export function applicationCoverage(
  rate: number,
  chance: number,
  seconds: number
): number {
  const n = Math.max(0, rate * seconds),
    whole = Math.floor(n);
  return 1 - Math.pow(1 - chance, whole) * (1 - (n - whole) * chance);
}

// Keep native pulse payloads, but replace stale levels and fill arbitrary manual aura levels.
export function resolveAuraPulseComponents(
  profile: DamageProfile,
  combat: DamageCombatData
): DamageComponent[] {
  const curves =
    combat.auraPulses?.[
      profile.weaponId.startsWith("secondary:") ? "secondary" : "primary"
    ];
  if (!curves) return profile.auraPulseDamageComponents || [];
  const selected = new Map<string, (typeof profile.activeAuras)[number]>();
  profile.activeAuras.forEach((aura) => {
    if (!selected.has(aura.name) || selected.get(aura.name)!.level < aura.level)
      selected.set(aura.name, aura);
  });
  const existing = (profile.auraPulseDamageComponents || []).filter(
    (component) => {
      const row = component.sourceRefs
        .map((ref) => ref.row)
        .find((name) => name && curves[name]);
      const aura = row ? selected.get(row) : undefined;
      return (
        !aura ||
        aura.carrier !== "self" ||
        component.id.includes(`:${aura.name}:${aura.level}:self:`)
      );
    }
  );
  selected.forEach((aura) => {
    if (
      aura.carrier !== "self" ||
      existing.some(
        (c) =>
          c.sourceRefs.some((ref) => ref.row === aura.name) &&
          c.id.includes(`:${aura.name}:${aura.level}:self:`)
      )
    )
      return;
    const ranges =
      curves[aura.name]?.[Math.min(80, Math.max(0, Math.trunc(aura.level)))];
    if (!ranges) return;
    elements.forEach((element) => {
      const damage = ranges[element];
      if (!damage || damage.max <= 0) return;
      existing.push({
        id: `combat-pulse:${aura.name}:${aura.level}:self:${element}`,
        label: `${aura.name} pulse ${element}`,
        source: "aura",
        damageType: element,
        timing: "instant",
        damage: { ...damage },
        sourceRefs: [
          {
            table: "Skills.txt",
            row: aura.name,
            columns: [
              "EType",
              "EMin",
              "EMax",
              "EMinLev1..5",
              "EMaxLev1..5",
              "EDmgSymPerCalc",
              "perdelay",
            ],
          },
        ],
        notes: ["Pulse payload is separate from the raw weapon hit."],
      });
    });
  });
  return existing;
}

export function actionTiming(
  profile: DamageProfile,
  combat: DamageCombatData,
  catalog: CombatCatalog,
  override: number | null,
  attackSlow = 0
): { rate: number | null; frames: number | null; note: string } {
  if (override !== null && Number.isFinite(override) && override >= 0)
    return {
      rate: override,
      frames: override ? 25 / override : null,
      note: "Uses the specified complete actions/cycles per second.",
    };
  if (profile.damageScope.label === "per second")
    return {
      rate: 1,
      frames: null,
      note: "Continuous profile already expresses damage per second.",
    };
  if (
    profile.skillDamageMode === "summon" ||
    [
      "Armageddon",
      "Hurricane",
      "Thunder Storm",
      "Blade Shield",
      "Death Sentry",
      "Wake of Fire",
      "Wake of Inferno",
      "Lightning Sentry",
      "Charged Bolt Sentry",
      "Chain Lightning Sentry",
      "Shiver Armor",
      "Chilling Armor",
      "Hydra",
      "Lesser Hydra",
      "Fissure",
      "Eruption",
      "Volcano",
      "Blizzard",
      "Shock Web",
      "Shock Field",
    ].some(
      (name) => name === profile.skillName || name === profile.sourceSkillName
    )
  ) {
    return {
      rate: null,
      frames: null,
      note: "Set observed damage events per second; AI, reactive hits, and periodic impact cadence are not player cast speed.",
    };
  }
  const weapon = combat.weapons[profile.weaponId],
    skill = combat.skills[profile.skillId];
  const data = skill?.levels[Math.min(80, profile.skillLevel)];
  if (!weapon || !skill || !data)
    return {
      rate: null,
      frames: null,
      note: "Animation data unavailable; set actions per second.",
    };
  const attack = profile.skillDamageMode === "weapon",
    form = profile.selectedTransformation?.name;
  let mode = skill.animation || (attack ? "A1" : "SC"),
    wclass = weapon.weaponClass;
  if (weapon.hands?.length === 2) {
    wclass =
      combat.classToken === "AI"
        ? "ht2"
        : weapon.hands[0].weaponClass === "1hs" &&
            weapon.hands[1].weaponClass === "1ht"
          ? "1js"
          : weapon.hands[0].weaponClass === "1ht"
            ? weapon.hands[1].weaponClass === "1ht"
              ? "1jt"
              : "1st"
            : "1ss";
  }
  const sequence =
    skill.sequence && catalog.sequences[skill.sequence]?.[wclass];
  const lightning = ["Lightning", "Chain Lightning", "Frozen Orb"].includes(
    profile.skillName
  );
  if (lightning) mode = "SC";
  const token =
    form === "Werewolf" ? "40" : form === "Werebear" ? "TG" : combat.classToken;
  const anim =
    catalog.animations[
      `${token}${mode}${form ? "hth" : wclass}`.toUpperCase()
    ] || catalog.animations[`${token}${mode}HTH`];
  if (!anim && !sequence)
    return {
      rate: null,
      frames: null,
      note: "Animation data unavailable; set actions per second.",
    };
  let length = lightning
    ? 19
    : mode === "SQ" && sequence
      ? sequence
      : anim!.frames;
  let baseSpeed = mode === "SQ" || lightning ? 256 : anim!.speed;
  const ias = weapon.gearIAS + weapon.weaponIAS;
  const eias = Math.trunc((120 * ias) / Math.max(1, 120 + ias));
  let skillSpeed = data.attackSpeed;
  profile.activeAuras.forEach((a) => {
    skillSpeed +=
      combat.effects[a.name]?.[Math.min(80, a.level)]?.attackSpeed || 0;
  });
  if (form === "Werewolf")
    skillSpeed +=
      combat.effects.Werewolf?.[
        Math.min(80, profile.selectedTransformation?.level || 1)
      ]?.attackSpeed || 0;
  const speed = attack
    ? clamp(
        100 -
          weapon.speed +
          eias +
          skillSpeed -
          attackSlow -
          (mode === "SQ" ? 30 : 0),
        15,
        175
      )
    : Math.min(
        175,
        100 + Math.trunc((120 * weapon.fcr) / Math.max(1, 120 + weapon.fcr))
      );
  let start =
    !form && ["AM", "SO"].includes(token) && ["A1", "A2"].includes(mode)
      ? ["1hs", "1ht", "stf", "2hs", "2ht"].includes(weapon.ownWeaponClass)
        ? 2
        : weapon.ownWeaponClass === "hth"
          ? 1
          : 0
      : 0;
  if (form && attack) {
    mode = "A1";
    start = 0;
    const transformed = catalog.animations[`${token}A1HTH`];
    if (!transformed)
      return {
        rate: null,
        frames: null,
        note: "Form animation unavailable; set actions per second.",
      };
    length = transformed.frames;
    const human =
      catalog.animations[
        `${combat.classToken}A1${weapon.ownWeaponClass}`.toUpperCase()
      ];
    const divisor = human
      ? Math.trunc(
          (human.frames * 256) /
            Math.max(
              1,
              Math.trunc(
                ((100 - weapon.speed + weapon.weaponIAS) * human.speed) / 100
              )
            )
        )
      : weapon.ownWeaponClass === "hth"
        ? 19
        : 45;
    baseSpeed = Math.trunc(
      ((form === "Werewolf" ? 9 : 10) * 256) / Math.max(1, divisor)
    );
  }
  const rate = Math.max(1, Math.trunc((baseSpeed * speed) / 100));
  let frames = Math.max(1, Math.ceil(((length - start) * 256) / rate) - 1);
  if (attack && data.hits > 1) {
    if (skill.rollback !== 100 || form)
      return {
        rate: null,
        frames: null,
        note: "Set observed landed hit opportunities per second; server follow-up timing differs from the held client animation.",
      };
    const event = (form ? catalog.animations[`${token}A1HTH`] : anim)
      ?.events[0];
    if (event === undefined)
      return {
        rate: null,
        frames: null,
        note: "Follow-up hit frame unavailable; set actions per second.",
      };
    const restart = Math.trunc(
      (event *
        (100 - (profile.skillName === "Dragon Talon" ? 100 : skill.rollback))) /
        100
    );
    const first = Math.max(1, Math.ceil(((event - start) * 256) / rate));
    const follow = Math.max(1, Math.ceil(((event - restart) * 256) / rate));
    const last = Math.max(1, Math.ceil(((length - restart) * 256) / rate) - 1);
    frames = Math.max(
      first + Math.max(0, data.hits - 2) * follow + last,
      data.cooldown
    );
    return {
      rate: (data.hits * 25) / frames,
      frames,
      note: `${data.hits} follow-up hits per complete animation; uninterrupted attacks on one target.`,
    };
  }
  if (["Whirlwind", "Blade Dance"].includes(profile.skillName))
    return {
      rate: null,
      frames: null,
      note: "Set observed weapon cycles per second; movement/collisions control repeated whirlwind hits.",
    };
  frames = Math.max(frames, data.cooldown);
  return {
    rate: 25 / frames,
    frames,
    note: "Held-action animation timing at 25 game frames per second.",
  };
}

export function calculateEffectiveDamage(
  profile: DamageProfile,
  combat: DamageCombatData,
  catalog: CombatCatalog,
  settings: CombatSettings
): EffectiveCombatResult[] {
  const difficulty = clamp(Math.trunc(settings.difficulty), 0, 2),
    area = catalog.areas.find((a) => a.id === settings.areaId);
  const targets = area
    ? catalog.monsters.filter((m) => area.monsters[difficulty].includes(m.id))
    : catalog.monsters.filter((m) => m.id === settings.monsterId);
  const active = [...profile.activeAuras, ...settings.debuffs].reduce(
    (all, a) => {
      if ((all.get(a.name) || 0) < a.level) all.set(a.name, a.level);
      return all;
    },
    new Map<string, number>()
  );
  const command = profile.activeAuras.find((aura) => aura.name === "Battle Command");
  const commandOption = command?.carrier === "self"
    ? combat.commandSelfBonuses : combat.commandPartyBonuses;
  const allSkills = command ? commandOption?.[Math.min(80, command.level)] ??
    Math.min(7, 1 + Math.floor(command.level / 10)) : 0;
  const boostedWeapon = (
    w: DamageCombatData["weapons"][string]
  ): DamageCombatData["weapons"][string] => {
    const extra = w.skillBonuses?.[allSkills];
    return {
      ...w,
      baseAttackRating: w.baseAttackRating + (extra?.baseAttackRating || 0),
      fcr: Math.max(0, w.fcr - settings.castSlow),
      gearIAS: w.gearIAS + (extra?.gearIAS || 0),
      crushingBlow: w.crushingBlow + (extra?.crushingBlow || 0),
      crushingEfficiency:
        w.crushingEfficiency + (extra?.crushingEfficiency || 0),
      openWounds: w.openWounds + (extra?.openWounds || 0),
      openWoundsDps: w.openWoundsDps + (extra?.openWoundsDps || 0),
      pierce: Object.fromEntries(
        elements.map((e) => [e, w.pierce[e] + (extra?.pierce[e] || 0)])
      ) as CombatResistances,
      hands: w.hands?.map(boostedWeapon),
    };
  };
  const timingCombat = {
    ...combat,
    weapons: Object.fromEntries(
      Object.entries(combat.weapons).map(([id, w]) => [id, boostedWeapon(w)])
    ),
  };
  const weapon = timingCombat.weapons[profile.weaponId],
    skill =
      combat.skills[profile.skillId]?.levels[Math.min(80, profile.skillLevel)];
  const timingProfile = {
    ...profile,
    activeAuras: [
      ...profile.activeAuras,
      ...settings.debuffs
        .filter((d) => d.name === "Burst of Speed")
        .map((d) => ({
          ...d,
          source: "manual" as const,
          carrier: "self" as const,
        })),
    ],
  };
  const timing = actionTiming(
    timingProfile,
    timingCombat,
    catalog,
    settings.rateOverride,
    settings.attackSlow
  );
  const effects = [...active]
    .map(([name, level]) => combat.effects[name]?.[Math.min(80, level)])
    .filter((e) => Boolean(e));
  const effectReduction = (name: string, element: DamageElement) => {
    const level = active.get(name) || 0;
    const value = level ? combat.effects[name]?.[Math.min(80, level)]?.reductions[element] || 0 : 0;
    return name === (profile.sourceSkillName || profile.skillName)
      ? Math.max(value, skill?.reductions[element] || 0) : value;
  };
  const convictionLevel = Math.max(profile.targetModifiers?.convictionLevel || 0, active.get("Conviction") || 0);
  const conditions = {
    ...EMPTY_TARGET_CONDITIONS,
    conviction: Math.max(effectReduction("Conviction", "fire"), convictionLevel ? Math.min(150, 10 + 2 * convictionLevel) : 0),
    lowerResist: effectReduction("Lower Resist", "fire"),
    amplifyDamage: effectReduction("Amplify Damage", "physical"),
    battleCry: effectReduction("Battle Cry", "physical"),
    decrepify: effectReduction("Decrepify", "physical"),
    sanctuary: effectReduction("Sanctuary", "magic"),
    staticField: effectReduction("Static Field", "lightning"),
    inferno: effectReduction("Inferno", "fire"),
    arcticBlast: effectReduction("Arctic Blast", "cold"),
    plaguePoppy: Math.max(effectReduction("Poison Creeper", "poison"), effectReduction("Plague Poppy", "poison")),
    addedResistances: settings.resistanceBonus,
    protected: Boolean(settings.protected && !area),
    immunityAura: Boolean(settings.immunityAura && !area),
  };
  const raw = profile.damageComponents
    .filter((c) => c.includedInTotal !== false)
    .reduce((sum, c) => add(sum, c.damage), zero());
  const uptime = clamp(settings.uptime, 0, 100) / 100,
    overlap = Math.max(1, settings.overlap),
    count =
      profile.skillDamageMode === "summon"
        ? Math.max(1, settings.summonCount)
        : 1;
  const formAR = profile.selectedTransformation
    ? combat.effects[profile.selectedTransformation.name]?.[
        Math.min(80, profile.selectedTransformation.level)
      ]?.attackRatingPercent || 0
    : 0;
  const auraAR = [...active].reduce(
    (sum, [name, level]) => {
      const effect = combat.effects[name]?.[Math.min(80, level)];
      return (
        sum +
        (profile.activeAuras.find((a) => a.name === name)?.carrier === "self"
          ? (effect?.selfAttackRatingPercent ??
            effect?.attackRatingPercent ??
            0)
          : effect?.attackRatingPercent || 0)
      );
    },
    formAR +
      (profile.selectedTransformation?.name === "Werewolf"
        ? combat.werewolfAttackRatingBonuses?.[allSkills] || 0
        : 0)
  );
  // Thorns' aurastats give the party Open Wounds; its owner uses the passivestat damage.
  const auraWounds = [...active].reduce(
    (sum, [name, level]) => {
      const effect = combat.effects[name]?.[Math.min(80, level)];
      const isSelf =
        profile.activeAuras.find((a) => a.name === name)?.carrier === "self";
      return {
        chance: sum.chance + (effect?.openWounds || 0),
        damage:
          sum.damage +
          ((isSelf ? effect?.selfOpenWoundsDps : undefined) ??
            effect?.openWoundsDps ??
            0),
      };
    },
    { chance: 0, damage: 0 }
  );
  return targets.map((monster) => {
    const level = Math.max(
      1,
      Math.trunc(
        (area && difficulty > 0 && !monster.noRatio && !monster.boss
          ? area.levels[difficulty]
          : monster.levels[difficulty]) + settings.levelBonus
      )
    );
    const scaling =
      catalog.monsterLevels[Math.min(catalog.monsterLevels.length - 1, level)];
    const players = clamp(settings.players, 1, 8),
      lifeMultiplier =
        (1 + (players - 1) * 0.7) *
        (1 + Math.max(-99, settings.lifeBonus) / 100);
    const life = scale(
      monster.life[difficulty],
      (monster.noRatio ? 1 : scaling.life[difficulty] / 100) * lifeMultiplier
    );
    const baseDefense = Math.trunc(
      monster.defense[difficulty] *
        (monster.noRatio ? 1 : scaling.defense[difficulty] / 100)
    );
    const defense =
      Math.trunc(
        baseDefense *
          (1 + settings.defenseBonus / 100) *
          (1 - effects.reduce((sum, e) => sum + e.defensePercent, 0) / 100)
      ) - effects.reduce((sum, e) => sum + e.defenseFlat, 0);
    const pierce = {
      ...(weapon?.pierce || {
        physical: 0,
        fire: 0,
        cold: 0,
        lightning: 0,
        poison: 0,
        magic: 0,
      }),
    };
    if (profile.skillDamageMode === "summon")
      elements.forEach((e) => {
        pierce[e] = skill?.pierce[e] || 0;
      });
    else
      elements.forEach((e) => {
        pierce[e] += skill?.pierce[e] || 0;
      });
    const stats: MonsterTargetStats = monster.target?.difficulties[["normal", "nightmare", "hell"][difficulty] as "hell"] || {
      resistances: monster.resistances[difficulty], poisonLengthReduction: 0, curseResistance: 0,
      curseEffectReduction: 0, receivesImmunityAura: false, flatPhysicalReduction: 0, flatMagicReduction: 0,
      absorbPercent: {}, absorbFlat: {}, block: monster.block[difficulty], notes: [],
    };
    const target = monster.target || { id: monster.id, creatureType: monster.demon ? "demon" : monster.undead ? "undead" : "other" } as MonsterTarget;
    const sanctuaryBypass = monster.undead && !monster.boss && !monster.primeEvil && !settings.mapBoss &&
      profile.skillDamageMode !== "summon" && profile.activeAuras.some((aura) => aura.name === "Sanctuary" && aura.carrier === "self" && aura.level > 0);
    const activeConditions = { ...conditions, physicalBypass: sanctuaryBypass };
    const reductions = (element: DamageElement) => {
      const curse = (value: number) => stats.curseResistance >= 100 ? 0 : Math.floor(value * (100 - Math.min(100, stats.curseEffectReduction)) / 100);
      return element === "physical" ? [conditions.battleCry, curse(conditions.amplifyDamage), curse(conditions.decrepify)]
        : element === "magic" ? [conditions.sanctuary]
          : [element === "poison" ? 0 : conditions.conviction, curse(conditions.lowerResist),
            element === "fire" ? conditions.inferno : element === "cold" ? conditions.arcticBlast : element === "lightning" ? conditions.staticField : conditions.plaguePoppy];
    };
    const basePhysicalResistance = stats.resistances.physical + settings.resistanceBonus.physical +
      (stats.receivesImmunityAura && conditions.immunityAura ? 200 : 0);
    const woundPhysicalResistance = effectiveResistance(basePhysicalResistance, reductions("physical"), profile.targetModifiers?.resistancePierce.physical ?? pierce.physical);
    const hands = weapon?.hands || (weapon ? [weapon] : []);
    const hitData = hands.map((hand) => {
      let ar =
        hand.baseAttackRating +
        (monster.demon ? hand.demonAttackRating : 0) +
        (monster.undead ? hand.undeadAttackRating : 0);
      ar += Math.trunc(
        (ar *
          (hand.attackRatingPercent +
            (hand.mastery[Math.min(7, allSkills)] || 0) +
            (skill?.attackRatingPercent || 0) +
            auraAR)) /
          100
      );
      let targetDefense = hand.ignoreDefense && !monster.boss ? 0 : defense;
      targetDefense -= Math.trunc(
        (targetDefense *
          Math.min(
            100,
            monster.boss
              ? Math.trunc(hand.targetDefensePercent / 2)
              : hand.targetDefensePercent
          )) /
          100
      );
      const roll =
        profile.skillName === "Smite"
          ? 1
          : chanceToHit(ar, targetDefense, combat.level, level);
      const hit =
        settings.hitChanceOverride !== null
          ? clamp(settings.hitChanceOverride, 0, 100) / 100
          : profile.skillDamageMode === "spell"
            ? 1
            : profile.skillDamageMode === "summon"
              ? null
              : roll;
      return {
        ar,
        hit:
          hit === null
            ? null
            : profile.skillDamageMode === "spell" ||
                profile.skillName === "Smite"
              ? hit
              : hit *
                (1 -
                  (settings.blockChanceOverride == null
                    ? clamp(monster.block[difficulty], 0, 75)
                    : clamp(settings.blockChanceOverride, 0, 100)) /
                    100),
      };
    });
    const damageComponents = profile.damageComponents.map((component) => {
      const index = component.id.startsWith("sequence:2:") ? 1 : 0;
      const hand = hands[index] || weapon;
      return component.targetDamageBonuses || component.damageType !== "physical" || profile.skillName === "Smite" || profile.skillDamageMode !== "weapon"
        ? component : { ...component,
            baseDamage: component.baseDamage || scale(component.damage, 1 / (1 + (component.physicalBonusPercent ?? profile.breakdown.physicalBonusPercent.total) / 100)),
            physicalBonusPercent: component.physicalBonusPercent ?? profile.breakdown.physicalBonusPercent.total,
            targetDamageBonuses: { demon: hand?.demonDamage || 0, undead: hand?.undeadDamage || 0 } };
    });
    const targetProfile = { ...profile, damageComponents, targetModifiers: profile.targetModifiers || { resistancePierce: pierce, convictionLevel: 0 } };
    const mitigation = calculateTargetDamage(targetProfile, target, stats, activeConditions);
    const resistances = mitigation.resistances;
    const landed = mitigation.totals.combinedDamage;
    let expected = zero(), instant = 0, dot = 0;
    const components: EffectiveCombatResult["components"] = [];
    const periodic = damageComponents.filter((component) => component.includedInTotal === false &&
      component.timing === "over_time" && component.damageType !== "poison" && component.damageEventsPerUnit);
    const periodicResult = periodic.length ? calculateTargetDamage({ ...targetProfile, damageComponents: periodic.map((component) => ({ ...component, includedInTotal: true })), strikeBreakdowns: [], auraPulseDamageComponents: [] }, target, stats, activeConditions) : undefined;
    for (const event of [...(mitigation.events || []), ...(periodicResult?.events || [])]) {
      const hit = hitData[event.hand]?.hit ?? (profile.skillDamageMode === "spell"
        ? settings.hitChanceOverride === null ? 1 : clamp(settings.hitChanceOverride, 0, 100) / 100 : null);
      const isPeriodic = periodic.some((component) => component.id === event.id);
      if (!isPeriodic) expected = add(expected, scale(event.damage, hit ?? 1));
      components.push({ id: event.id, element: event.element, raw: event.raw, landed: event.damage,
        multiplier: Math.max(0, 1 - resistances[event.element] / 100) });
      if (event.timing === "instant") instant += average(event.damage) * (hit ?? 1);
      else if (event.durationSeconds !== undefined) {
        const duration = event.durationSeconds;
        dot += duration > 0 ? average(event.damage) / duration *
          (timing.rate === null || hit === null ? 1 : applicationCoverage(timing.rate, hit, duration)) : 0;
      } else dot += timing.rate === 0 ? 0 : average(event.damage) * (hit ?? 1);
    }
    const auraPulseDps = resolveAuraPulseComponents(profile, combat).filter((component) => component.includedInTotal !== false).reduce((sum, component) => {
      const row = component.sourceRefs.map((ref) => ref.row).find((name) => name && catalog.pulseRates[name]);
      if (profile.activeAuras.find((aura) => aura.name === row)?.carrier === "party") return sum;
      const result = calculateTargetDamage({ ...targetProfile, damageComponents: [component], strikeBreakdowns: [], auraPulseDamageComponents: [] }, target, stats, { ...activeConditions, physicalBypass: false });
      return sum + average(result.totals.combinedDamage) * (row ? catalog.pulseRates[row] : 0) * uptime * count;
    }, 0);
    const hitChance =
      profile.skillDamageMode === "spell"
        ? settings.hitChanceOverride === null
          ? 1
          : clamp(settings.hitChanceOverride, 0, 100) / 100
        : hitData.length && hitData.every((h) => h.hit !== null)
          ? hitData.reduce((sum, h) => sum + h.hit!, 0) / hitData.length
          : null;
    const available = timing.rate !== null && hitChance !== null;
    const instantDps = available
        ? instant * timing.rate! * uptime * overlap * count
        : null,
      dotDps = available ? dot * uptime * overlap * count : null;
    let crushingDps = 0,
      openWoundsDps = 0;
    if (profile.skillDamageMode === "weapon" && available) {
      const hpPercent = clamp(settings.currentLifePercent, 0, 100),
        currentLife = (average(life) * hpPercent) / 100;
      const divisor = monster.primeEvil
        ? settings.mapBoss
          ? 30
          : 70 + (100 - Math.trunc(hpPercent)) * 10
        : 8;
      const cbResistance =
        basePhysicalResistance -
        reductions("physical").reduce(
          (sum, reduction) =>
            sum +
            Math.trunc(reduction / (basePhysicalResistance >= 100 ? 2 : 1)),
          0
        );
      const bleedStreams: Array<{
        trials: number;
        chance: number;
        damage: number;
      }> = [];
      hands.forEach((hand, index) => {
        const landedRate = timing.rate! * (hitData[index]?.hit || 0);
        const ranged =
          ["bow", "xbw"].includes(hand.weaponClass) ||
          /throw|javelin/i.test(profile.skillName);
        crushingDps +=
          (((currentLife /
            (divisor + (players - 1) * 1.4) /
            (ranged ? 1.5 : 1)) *
            clamp(hand.crushingBlow + (skill?.crushingBlow || 0), 0, 100)) /
            100) *
          Math.max(
            0,
            1 +
              (hand.crushingEfficiency + (skill?.crushingEfficiency || 0)) / 100
          ) *
          Math.max(0, 1 - cbResistance / 100) *
          landedRate *
          uptime;
        const l = Math.max(1, combat.level),
          bleedBase =
            9 * Math.min(l - 1, 14) +
            18 * clamp(l - 15, 0, 15) +
            27 * clamp(l - 30, 0, 15) +
            36 * clamp(l - 45, 0, 15) +
            45 * Math.max(0, l - 60);
        const bleed =
          (Math.trunc(
            (bleedBase + 25 + 5 * (hand.openWoundsDps + auraWounds.damage)) *
              Math.max(0, 1 - woundPhysicalResistance / 100)
          ) *
            25) /
          256;
        bleedStreams.push({
          trials: timing.rate! * 5,
          chance:
            ((hitData[index]?.hit || 0) *
              clamp(hand.openWounds + auraWounds.chance, 0, 100)) /
            100,
          damage: Math.max(0, bleed),
        });
      });
      // Convolve both hands' independent applications before imposing the shared three-stack cap.
      let distribution = [1, 0, 0];
      let weight = 0,
        weightedDamage = 0;
      bleedStreams.forEach(({ trials, chance: p, damage }) => {
        const n = Math.floor(trials),
          fraction = trials - n;
        const q = 1 - p;
        const probabilities = [
          Math.pow(q, n),
          n ? n * p * Math.pow(q, n - 1) : 0,
          n > 1 ? ((n * (n - 1)) / 2) * p * p * Math.pow(q, n - 2) : 0,
        ];
        const phased = probabilities.map(
          (value, k) =>
            value * (1 - fraction * p) +
            (k ? probabilities[k - 1] * fraction * p : 0)
        );
        distribution = [0, 1, 2].map((k) =>
          phased
            .slice(0, k + 1)
            .reduce((sum, value, j) => sum + value * distribution[k - j], 0)
        );
        weight += trials * p;
        weightedDamage += trials * p * damage;
      });
      const stacks = clamp(
        3 - 3 * distribution[0] - 2 * distribution[1] - distribution[2],
        0,
        3
      );
      openWoundsDps = weight
        ? ((stacks * weightedDamage) / weight) * uptime
        : 0;
    }
    if (conditions.protected) { crushingDps = 0; openWoundsDps = 0; }
    const notes = [timing.note, ...(monster.target?.notes || []), ...stats.notes];
    if (mitigation.absorptionHealing.max > 0) notes.push(`Absorption can additionally heal up to ${mitigation.absorptionHealing.max.toFixed(1)} life per modeled payload before damage, depending on missing life.`);
    if (conditions.protected) notes.push("Target is in a protected phase; effective damage is zero.");
    if (profile.skillDamageMode === "summon")
      notes.push(
        "Summon hit chance needs an observed override; caster attack rating is not inherited. Source-backed pet pierce rules apply. For an unblockable summon payload, set monster block override to zero."
      );
    if (
      ["Corpse Explosion", "Death Sentry"].includes(
        profile.sourceSkillName || profile.skillName
      )
    )
      notes.push(
        "Partial payload only: corpse-life explosion damage is excluded from the source profile and this DPS estimate."
      );
    if (!available)
      notes.push(
        "Landed damage is available; DPS needs the missing action rate or hit chance."
      );
    if (crushingDps)
      notes.push(
        "Crushing Blow DPS changes as target life falls; shown at the selected current life."
      );
    if (monster.primeEvil)
      notes.push(
        "Enable map-boss Crushing Blow rules only for bosses on the game's special map-boss list; MonStats does not identify that list."
      );
    if (sanctuaryBypass)
      notes.push(
        "Owned Sanctuary bypasses positive physical resistance on ordinary undead for direct damage; Crushing Blow and Open Wounds retain their own resistance rules."
      );
    if (monster.demon || monster.undead)
      notes.push(
        "Matching bonus damage to demons/undead is added to weapon physical damage before resistance; the raw baseline stays unchanged."
      );
    if (openWoundsDps)
      notes.push(
        "Open Wounds is a five-second steady application-window estimate, capped at three stacks."
      );
    return {
      monster,
      absorptionHealing: mitigation.absorptionHealing,
      level,
      defense,
      life,
      raw,
      landed,
      expected,
      resistances,
      hitChance,
      attackRating: hitData[0]?.ar ?? null,
      actionsPerSecond: timing.rate,
      frames: timing.frames,
      dps: available
        ? instantDps! + dotDps! + auraPulseDps + crushingDps + openWoundsDps
        : null,
      instantDps,
      dotDps,
      auraPulseDps,
      crushingDps,
      openWoundsDps,
      components,
      notes,
    };
  });
}
