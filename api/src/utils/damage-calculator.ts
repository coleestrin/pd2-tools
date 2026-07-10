import fs from "fs";
import path from "path";
import CharacterStatParser from "./character-stats";
import { getExpandedItemElementalDamageRanges } from "./item-stat-expansion";
import { calculateTotalSkills } from "./skill-calculator";
import {
  ActiveAuraSummary,
  CharacterResponse,
  DamageAuraLevelBonus,
  DamageAuraOption,
  DamageCalculation,
  DamageComponent,
  DamageElement,
  DamageProfile,
  DamageRange,
  DamageSourceReference,
  DamageTotals,
  DamageSkillOption,
  DamageTransformationOption,
  DamageWeaponOption,
  CharacterData,
  IItem,
  PoisonDamage,
} from "../types";

type SkillEntry = {
  level: number;
  baseLevel: number;
};

type AuraSourceKind =
  | "player_skill"
  | "player_item"
  | "mercenary_native"
  | "mercenary_item"
  | "manual";

type AuraCarrier = "self" | "party";

type AuraSource = {
  name: string;
  level: number;
  source: AuraSourceKind;
  carrier: AuraCarrier;
};

type AuraSelection = {
  option: DamageAuraOption;
  carrier: AuraCarrier;
};

type PlayerAuraDefinition = {
  id: string;
  name: string;
  skillName: string;
  sourceSkillNames?: string[];
};

type GameTableName =
  | "Skills"
  | "Missiles"
  | "SkillDesc"
  | "MonStats"
  | "Properties"
  | "ItemStatCost";

type GameTable = {
  columns: string[];
  rowsByKey: Record<string, string[]>;
};

type GameTableDefinition = {
  fileName: string;
  keyColumn: string;
  required?: boolean;
};

type GameData = {
  tables: Partial<Record<GameTableName, GameTable>>;
};

type DamageScopeDefinition = {
  label: string;
  countColumn?: "calc1" | "calc2" | "calc3" | "calc4";
  countLabel?: string;
  note: string;
};

const PD2_GAME_DATA_DIRECTORY = path.resolve(
  process.cwd(),
  "src",
  "game-data",
  "pd2",
  "season-13"
);

const DEFAULT_DAMAGE_SCOPE: DamageProfile["damageScope"] = {
  label: "per modeled hit",
  note: "Displayed totals are per modeled hit; attack speed, cast rate, hit chance, target count, and repeated hit frequency are not multiplied into totals.",
  sourceRefs: [],
};

const SKILL_DAMAGE_SCOPE_DEFINITIONS: Record<string, DamageScopeDefinition> = {
  [normalizeSkillName("Charged Strike").toLowerCase()]: {
    label: "per weapon hit plus one bolt",
    countColumn: "calc1",
    countLabel: "released bolts",
    note: "Charged Strike totals include the weapon hit plus one modeled lightning-bolt payload. Skills.txt calc1 exposes released bolt count; bolt overlap, target size, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Lightning Strike").toLowerCase()]: {
    label: "per weapon hit plus one chain hit",
    countColumn: "calc2",
    countLabel: "chain hits",
    note: "Lightning Strike totals include the weapon hit plus one modeled chain-lightning hit. Skills.txt calc2 exposes maximum chain hits; target count, repeated jumps, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Lightning Fury").toLowerCase()]: {
    label: "per throw plus one released bolt",
    countColumn: "calc1",
    countLabel: "target bolts",
    note: "Lightning Fury totals are for the thrown hit plus one modeled released lightning payload. Skills.txt calc1 exposes target count; released bolt count, overlap, pierce, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Chain Lightning").toLowerCase()]: {
    label: "per chain hit",
    countColumn: "calc1",
    countLabel: "chain hits",
    note: "Chain Lightning totals are per chain hit. Skills.txt calc1 exposes maximum hits; jump count, target selection, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Holy Bolt").toLowerCase()]: {
    label: "per bolt",
    countColumn: "calc1",
    countLabel: "bolts",
    note: "Holy Bolt totals are per bolt. Skills.txt calc1 exposes bolts fired; projectile overlap, healing, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Bone Spear").toLowerCase()]: {
    label: "per spear",
    countColumn: "calc1",
    countLabel: "spears",
    note: "Bone Spear totals are per spear. Skills.txt calc1 exposes spear count; pierce, projectile overlap, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Psychic Hammer").toLowerCase()]: {
    label: "per hit",
    countColumn: "calc1",
    countLabel: "hits",
    note: "Psychic Hammer totals are for the first modeled hit. Skills.txt calc1 exposes hit count and calc2 exposes damage reduction per later hit; later-hit decay, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Ice Barrage").toLowerCase()]: {
    label: "per missile",
    countColumn: "calc1",
    countLabel: "missiles",
    note: "Ice Barrage totals are per missile. Skills.txt calc1 exposes missile count; overlap, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Combustion").toLowerCase()]: {
    label: "per missile",
    countColumn: "calc2",
    countLabel: "missiles",
    note: "Combustion totals are per missile. Skills.txt calc2 exposes missile count; overlap, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Twister").toLowerCase()]: {
    label: "per missile",
    countColumn: "calc1",
    countLabel: "missiles",
    note: "Twister totals are per missile. Skills.txt calc1 exposes missile count; overlap, repeated contacts, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Shock Wave").toLowerCase()]: {
    label: "per missile",
    countColumn: "calc1",
    countLabel: "missiles",
    note: "Shock Wave totals are per missile. Skills.txt calc1 exposes missile count; overlap, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Fire Claws").toLowerCase()]: {
    label: "per weapon hit plus one fire payload",
    countColumn: "calc2",
    countLabel: "fire missiles",
    note: "Fire Claws totals include the melee weapon hit plus one modeled fire payload. Skills.txt calc2 exposes fire missile count; overlap, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Zeal").toLowerCase()]: {
    label: "per weapon hit",
    countColumn: "calc1",
    countLabel: "maximum targets",
    note: "Zeal totals are per weapon hit. Skills.txt calc1 exposes maximum targets; the full attack sequence, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Fury").toLowerCase()]: {
    label: "per weapon hit",
    countColumn: "calc1",
    countLabel: "maximum targets",
    note: "Fury totals are per weapon hit. Skills.txt calc1 exposes maximum targets; the full attack sequence, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Fend").toLowerCase()]: {
    label: "per weapon hit",
    countColumn: "calc1",
    countLabel: "maximum targets",
    note: "Fend totals are per weapon hit. Skills.txt calc1 exposes maximum targets; the full attack sequence, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Dragon Talon").toLowerCase()]: {
    label: "per kick",
    countColumn: "calc1",
    countLabel: "kicks",
    note: "Dragon Talon totals are per boot-sourced kick. Skills.txt calc1 exposes kick count; the full kick sequence, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Jab").toLowerCase()]: {
    label: "per weapon hit",
    note: "Jab totals are per weapon hit. The sequence count is controlled by compiled skill behavior and is not inferred from the tables; hit chance, target count, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Exploding Arrow").toLowerCase()]: {
    label: "per arrow impact plus one cluster payload",
    countColumn: "calc2",
    countLabel: "cluster bombs",
    note: "Exploding Arrow totals include the weapon/fire impact plus one modeled cluster payload. Skills.txt calc2 exposes cluster-bomb count; cluster overlap, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Blizzard").toLowerCase()]: {
    label: "per shard impact",
    note: "Blizzard totals are per modeled shard impact. Skills.txt calc2 exposes frequency, but storm duration, shard count, random placement, overlap, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Eruption").toLowerCase()]: {
    label: "per eruption impact",
    note: "Eruption totals are per modeled impact. Skills.txt calc2 exposes frequency, but duration, repeated impacts, overlap, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Blade Shield").toLowerCase()]: {
    label: "per pulse hit",
    note: "Blade Shield totals are per modeled pulse hit. Skills.txt periodic/perdelay controls repeat timing; duration, pulse count, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Blade Fury").toLowerCase()]: {
    label: "per projectile hit",
    note: "Blade Fury totals are per projectile hit. Channel duration, projectile count, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Frenzy").toLowerCase()]: {
    label: "per weapon hit",
    countColumn: "calc4",
    countLabel: "maximum state charges",
    note: "Frenzy totals are per weapon hit. Skills.txt calc4 exposes maximum state charges, but the table damage formula is not charge-dependent; sequence timing, state uptime, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Sacrifice").toLowerCase()]: {
    label: "per weapon hit",
    note: "Sacrifice totals are outgoing damage per weapon hit. Skills.txt calc2 self-damage and calc3 explosion radius are not added to outgoing damage; secondary targets, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Dark Pact").toLowerCase()]: {
    label: "per one-curse payload",
    note: "Dark Pact totals are for the modeled one-curse payload. Additional curse state, area growth, target count, and cast rate are controlled by compiled behavior and are not multiplied into totals.",
  },
  [normalizeSkillName("Vengeance").toLowerCase()]: {
    label: "per weapon hit",
    note: "Vengeance totals are per weapon hit with modeled elemental conversion. Skills.txt calc4 exposes chain percent rather than a deterministic chain count; chained targets, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Fire Arrow").toLowerCase()]: {
    label: "per impact plus fire wall",
    note: "Fire Arrow totals include the weapon/fire impact plus one modeled firearrow firewall payload. Ground-fire duration, repeated ticks, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Immolation Arrow").toLowerCase()]: {
    label: "per impact plus fire patches",
    note: "Immolation Arrow totals include the weapon/fire impact plus one modeled instance of each server-reachable fire patch payload. Patch duration, repeated ticks, overlap, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Charged Bolt").toLowerCase()]: {
    label: "per bolt",
    countColumn: "calc1",
    countLabel: "bolts",
    note: "Charged Bolt totals are per bolt. Skills.txt calc1 exposes the bolt count, but projectile overlap and target count are not multiplied into totals.",
  },
  [normalizeSkillName("Multiple Shot").toLowerCase()]: {
    label: "per arrow",
    countColumn: "calc1",
    countLabel: "arrows",
    note: "Multiple Shot totals are per arrow hit. Skills.txt calc1 exposes the arrow count, but target count and overlap are not multiplied into totals.",
  },
  [normalizeSkillName("Strafe").toLowerCase()]: {
    label: "per arrow",
    note: "Strafe totals are per arrow hit. The full attack sequence length, hit chance, and target count are not multiplied into totals.",
  },
  [normalizeSkillName("Split Throw").toLowerCase()]: {
    label: "per projectile hit",
    countColumn: "calc1",
    countLabel: "projectiles",
    note: "Split Throw totals are per projectile hit. Skills.txt calc1 exposes the projectile count, but projectile count, target count, hit chance, and attack rate are not multiplied into totals.",
  },
  [normalizeSkillName("Teeth").toLowerCase()]: {
    label: "per projectile",
    countColumn: "calc1",
    countLabel: "projectiles",
    note: "Teeth totals are per projectile. Skills.txt calc1 exposes the projectile count, but target count and overlap are not multiplied into totals.",
  },
  [normalizeSkillName("Nova").toLowerCase()]: {
    label: "per target hit",
    note: "Nova totals are per target hit. Target count is not multiplied into totals.",
  },
  [normalizeSkillName("Frost Nova").toLowerCase()]: {
    label: "per target hit",
    note: "Frost Nova totals are per target hit. Target count is not multiplied into totals.",
  },
  [normalizeSkillName("Poison Nova").toLowerCase()]: {
    label: "per target",
    note: "Poison Nova totals are per target over the modeled poison duration. Target count is not multiplied into totals.",
  },
  [normalizeSkillName("Fist of the Heavens").toLowerCase()]: {
    label: "per primary hit plus one bolt",
    countColumn: "calc4",
    countLabel: "holy bolts",
    note: "Fist of the Heavens totals include the primary lightning hit plus one modeled holy bolt payload. Skills.txt calc4 exposes the holy bolt count, but target selection and released bolt overlap are not multiplied into totals.",
  },
  [normalizeSkillName("Meteor").toLowerCase()]: {
    label: "per impact plus ground fire",
    note: "Meteor totals include the impact physical/fire payload plus one modeled meteorfire ground-fire payload. Impact radius, target count, burn duration, and repeated ground-fire ticks are not multiplied into totals.",
  },
  [normalizeSkillName("Molten Boulder").toLowerCase()]: {
    label: "per impact plus fire path",
    note: "Molten Boulder totals include the direct physical/fire impact payload plus one modeled moltenboulderfirepath payload. Boulder travel, repeated contacts, fire path duration, and target count are not multiplied into totals.",
  },
  [normalizeSkillName("Volcano").toLowerCase()]: {
    label: "per impact",
    note: "Volcano totals are per modeled impact from Skills.txt damage fields. Eruption timing, target overlap, and repeated impacts are not multiplied into totals.",
  },
  [normalizeSkillName("Whirlwind").toLowerCase()]: {
    label: "per weapon hit",
    note: "Whirlwind totals are per modeled weapon hit. Movement duration, attack sequence timing, hit chance, and target count are not multiplied into totals.",
  },
  [normalizeSkillName("Inferno").toLowerCase()]: {
    label: "per second",
    note: "Inferno totals use Skills.txt stream damage scaled to a per-second value. Channel duration, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Inferno Sentry").toLowerCase()]: {
    label: "per second",
    note: "Inferno Sentry totals use Skills.txt stream damage scaled to a per-second value. Trap count, channel duration, target count, and fire stream overlap are not multiplied into totals.",
  },
  [normalizeSkillName("Arctic Blast").toLowerCase()]: {
    label: "per second",
    note: "Arctic Blast totals use Skills.txt stream damage scaled to a per-second value. Channel duration, target count, debuff behavior, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Blaze").toLowerCase()]: {
    label: "per second",
    note: "Blaze totals use Skills.txt ground-fire damage scaled to a per-second value. Ground path overlap, target count, and duration are not multiplied into totals.",
  },
  [normalizeSkillName("Fire Wall").toLowerCase()]: {
    label: "per second",
    note: "Fire Wall totals use Skills.txt ground-fire damage scaled to a per-second value. Wall segment overlap, target count, and duration are not multiplied into totals.",
  },
  [normalizeSkillName("Firestorm").toLowerCase()]: {
    label: "per second",
    note: "Firestorm totals use Skills.txt stream damage scaled to a per-second value. Stream overlap, target count, and cast rate are not multiplied into totals.",
  },
  [normalizeSkillName("Thunder Storm").toLowerCase()]: {
    label: "per strike plus nova",
    note: "Thunder Storm totals include the direct lightning strike plus one modeled thunderstormnova payload. Storm duration, strike frequency, nova target count, and repeated strikes are not multiplied into totals.",
  },
  [normalizeSkillName("Hurricane").toLowerCase()]: {
    label: "per projectile hit",
    note: "Hurricane totals are per modeled projectile hit from Skills.txt damage fields. Aura duration, pulse frequency, target count, and repeated hits are not multiplied into totals.",
  },
  [normalizeSkillName("Armageddon").toLowerCase()]: {
    label: "per impact plus ground fire",
    note: "Armageddon totals include the physical/fire impact plus one modeled armageddonfire ground-fire payload. Storm duration, rock count, ground-fire duration, target count, and repeated impacts are not multiplied into totals.",
  },
  [normalizeSkillName("Blade Sentinel").toLowerCase()]: {
    label: "per projectile hit",
    note: "Blade Sentinel totals are per weapon-carried projectile hit. Sentinel duration, travel path, repeated contacts, hit chance, and target count are not multiplied into totals.",
  },
  [normalizeSkillName("Charged Bolt Sentry").toLowerCase()]: {
    label: "per projectile hit",
    countColumn: "calc3",
    countLabel: "bolts",
    note: "Charged Bolt Sentry totals are per bolt hit. Skills.txt calc3 exposes bolt count, but trap count, shots fired, projectile overlap, and target count are not multiplied into totals.",
  },
  [normalizeSkillName("Wake of Fire Sentry").toLowerCase()]: {
    label: "per projectile hit",
    note: "Wake of Fire Sentry totals are per fire-wave projectile hit. Trap count, shots fired, projectile overlap, and target count are not multiplied into totals.",
  },
  [normalizeSkillName("Lightning Sentry").toLowerCase()]: {
    label: "per projectile hit",
    note: "Lightning Sentry totals are per lightning projectile hit. Trap count, shots fired, pierce or target count, and repeated hits are not multiplied into totals.",
  },
  [normalizeSkillName("Chain Lightning Sentry").toLowerCase()]: {
    label: "per projectile hit",
    note: "Chain Lightning Sentry totals are per chain-lightning projectile hit. Trap count, shots fired, chain jumps, and target count are not multiplied into totals.",
  },
  [normalizeSkillName("Death Sentry").toLowerCase()]: {
    label: "per projectile hit",
    note: "Death Sentry totals are per fire projectile hit from Skills.txt damage fields. Corpse explosion damage is corpse/target-dependent and intentionally excluded from damage totals.",
  },
  [normalizeSkillName("Corpse Explosion").toLowerCase()]: {
    label: "target input required",
    note: "Corpse Explosion corpse-life damage is corpse/target-dependent and intentionally excluded from damage totals. Displayed game-file payloads do not represent a full corpse explosion estimate.",
  },
  [normalizeSkillName("Fists of Fire").toLowerCase()]: {
    label: "per full charge release",
    note: "Fists of Fire totals include the modeled charge-release payloads exposed by Skills.txt and referenced Missiles.txt rows. Charge-building attacks, hit chance, attack speed, target count, and ground-fire duration are not multiplied into totals.",
  },
  [normalizeSkillName("Cobra Strike").toLowerCase()]: {
    label: "per full charge release",
    note: "Cobra Strike totals include the modeled charge-release payloads exposed by Skills.txt and referenced Missiles.txt rows. Charge-building attacks, hit chance, attack speed, target count, and poison cloud overlap are not multiplied into totals.",
  },
  [normalizeSkillName("Claws of Thunder").toLowerCase()]: {
    label: "per full charge release",
    note: "Claws of Thunder totals include the modeled charge-release payloads exposed by Skills.txt and referenced Missiles.txt rows. Charge-building attacks, hit chance, attack speed, target count, and projectile overlap are not multiplied into totals.",
  },
  [normalizeSkillName("Blades of Ice").toLowerCase()]: {
    label: "per full charge release",
    note: "Blades of Ice totals include the modeled charge-release payloads exposed by Skills.txt and referenced Missiles.txt rows. Charge-building attacks, hit chance, attack speed, target count, and missile overlap are not multiplied into totals.",
  },
  [normalizeSkillName("Royal Strike").toLowerCase()]: {
    label: "per full charge release",
    note: "Royal Strike totals include the modeled charge-release payloads exposed by Skills.txt and referenced Missiles.txt rows. Charge-building attacks, hit chance, attack speed, target count, and missile overlap are not multiplied into totals.",
  },
};

const MARTIAL_ARTS_CHARGE_SKILL_DEFINITIONS: Record<
  string,
  MartialArtsChargeDefinition
> = {
  [normalizeSkillName("Tiger Strike").toLowerCase()]: {
    chargeCount: 3,
    selectedSkillDamagePercentByCharge: {
      1: "ln12",
      2: "2*ln12",
      3: "3*ln12",
    },
    missileRowsByCharge: {},
  },
  [normalizeSkillName("Fists of Fire").toLowerCase()]: {
    chargeCount: 3,
    skillComponentCharge: 1,
    missileRowsByCharge: {
      1: ["fistsoffirefirewall"],
      2: ["fistsoffirenova"],
      3: ["fofmeteor", "fofmeteorfire"],
    },
  },
  [normalizeSkillName("Cobra Strike").toLowerCase()]: {
    chargeCount: 3,
    selectedSkillDamagePercentByCharge: {
      2: "clc2",
    },
    missileRowsByCharge: {
      1: ["cobrastrikepoisonbolt"],
      3: ["cobrastrikepoisoncloud"],
    },
  },
  [normalizeSkillName("Claws of Thunder").toLowerCase()]: {
    chargeCount: 3,
    skillComponentCharge: 1,
    missileRowsByCharge: {
      2: ["clawsofthundernova"],
      3: ["clawsofthunderbolt", "cotthunderstorm"],
    },
  },
  [normalizeSkillName("Blades of Ice").toLowerCase()]: {
    chargeCount: 3,
    skillComponentCharge: 1,
    missileRowsByCharge: {
      2: ["boiwavemaker", "boiwavetrail"],
      3: ["boichaosice"],
    },
  },
  [normalizeSkillName("Royal Strike").toLowerCase()]: {
    chargeCount: 3,
    missileRowsByCharge: {
      1: ["royalstrikemeteor", "royalstrikemeteorfire"],
      2: ["royalstrikechainlightning"],
      3: ["royalstrikechaosice"],
    },
  },
  [normalizeSkillName("Maul").toLowerCase()]: {
    chargeCountExpression: "calc2",
    chargeLabel: "Stack",
    selectedSkillDamagePercentPerChargeExpression: "par3",
    missileRowsByCharge: {},
  },
};

type SkillSynergyBonuses = {
  physicalPct: number;
  firePct: number;
  coldPct: number;
  lightningPct: number;
  magicPct: number;
  poisonPct: number;
};

type WeaponElementalDamageElement = "fire" | "cold" | "lightning";

type WeaponElementalDamagePercentComponent = {
  element: WeaponElementalDamageElement;
  percent: number;
  calcColumn: string;
  descColumn: string;
};

type DirectSkillDamage = {
  components: Array<{
    label: string;
    element: DamageElement;
    damage: DamageRange;
    source: "skill" | "missile";
    timing: "instant" | "over_time";
    sourceRefs: DamageSourceReference[];
    notes?: string[];
  }>;
  physical: DamageRange;
  elemental: Partial<
    Record<"fire" | "cold" | "lightning" | "magic", DamageRange>
  >;
  poisonRange?: DamageRange;
  poisonDamage?: PoisonDamage;
};

type MartialArtsChargeDefinition = {
  chargeCount?: number;
  chargeCountExpression?: string;
  chargeLabel?: string;
  skillComponentCharge?: number;
  selectedSkillDamagePercentByCharge?: Record<number, string>;
  selectedSkillDamagePercentPerChargeExpression?: string;
  missileRowsByCharge: Record<number, string[]>;
};

type WeaponSet = "primary" | "secondary";

type DamageRangeWithSource = {
  damage: DamageRange;
  sourceRefs: DamageSourceReference[];
};

type SingleWeaponHandMode = Extract<
  DamageWeaponOption["handMode"],
  "one_handed" | "two_handed" | "missile" | "unarmed"
>;

type WeaponSequenceHandMode = Extract<
  DamageWeaponOption["handMode"],
  "dual_wield" | "dual_throw"
>;

type RequiredWeaponSequenceRule = {
  handMode: WeaponSequenceHandMode;
  weapsel: string;
  seqnum?: string;
  srvstfunc?: string;
  srvdofunc?: string;
  itypea1?: string;
  itypeb1?: string;
  requiresMissilePayload: boolean;
};

type WeaponSelection = {
  option: DamageWeaponOption;
  item: IItem;
  damage: DamageRange;
  weaponSet: WeaponSet;
  slot: "right" | "left" | "feet" | "summon";
  damageSourceRefs?: DamageSourceReference[];
  baseDamageUnavailable?: boolean;
  summonSkillName?: string;
  sequenceHits?: WeaponSequenceHit[];
};

type WeaponSequenceHit = {
  label: string;
  selection: Omit<WeaponSelection, "sequenceHits">;
};

type WeaponSetContext = {
  weaponSet: WeaponSet;
  realStats?: CharacterData["realStats"];
  skillMap: Map<string, SkillEntry>;
  playerItems: IItem[];
  alwaysActiveAuras: AuraSource[];
};

type SummonVariantDefinition = {
  id: string;
  label: string;
  componentLabels: string[];
  includeMonsterAttack?: boolean;
  includeSummonedSkills?: boolean;
};

const TRANSFORMATION_SKILL_DEFINITIONS = [
  { id: "Werewolf", name: "Werewolf", gameSkillName: "Wearwolf" },
  { id: "Werebear", name: "Werebear", gameSkillName: "Wearbear" },
] as const;

const GAME_STATE_TO_TRANSFORMATION_ID: Record<string, string> = {
  wolf: "Werewolf",
  bear: "Werebear",
};

const EMPTY_SKILL_MAP = new Map<string, SkillEntry>();

const GAME_TABLE_DEFINITIONS: Record<GameTableName, GameTableDefinition> = {
  Skills: { fileName: "Skills.txt", keyColumn: "skill", required: true },
  Missiles: { fileName: "Missiles.txt", keyColumn: "Missile", required: true },
  SkillDesc: {
    fileName: "SkillDesc.txt",
    keyColumn: "skilldesc",
    required: true,
  },
  MonStats: { fileName: "MonStats.txt", keyColumn: "Id" },
  Properties: {
    fileName: "Properties.txt",
    keyColumn: "code",
    required: true,
  },
  ItemStatCost: {
    fileName: "ItemStatCost.txt",
    keyColumn: "Stat",
    required: true,
  },
};

function getRequiredGameTableFiles(): string[] {
  return Object.values(GAME_TABLE_DEFINITIONS)
    .filter((definition) => definition.required)
    .map(({ fileName }) => fileName);
}

function parseGameTableFile(filePath: string, keyColumn: string): GameTable {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line, index, allLines) => {
    return line.length > 0 || index < allLines.length - 1;
  });
  const columns = (lines.shift() || "").split("\t");
  const keyIndex = columns.indexOf(keyColumn);
  if (keyIndex < 0) {
    throw new Error(
      `${path.basename(filePath)} is missing key column ${keyColumn}`
    );
  }

  const rowsByKey: Record<string, string[]> = {};
  lines.forEach((line) => {
    const row = line.split("\t");
    const key = row[keyIndex];
    if (key && !rowsByKey[key]) {
      rowsByKey[key] = row;
    }
  });

  if (Object.keys(rowsByKey).length === 0) {
    throw new Error(`${path.basename(filePath)} does not contain keyed rows`);
  }

  return { columns, rowsByKey };
}

function loadPd2GameData(): GameData {
  const missingRequiredFiles = getRequiredGameTableFiles().filter(
    (fileName) => !fs.existsSync(path.join(PD2_GAME_DATA_DIRECTORY, fileName))
  );

  if (missingRequiredFiles.length > 0) {
    throw new Error(
      `Damage calculator requires committed PD2 game tables under api/src/game-data/pd2/season-13. Missing: ${missingRequiredFiles.join(", ")}.`
    );
  }

  const tables: Partial<Record<GameTableName, GameTable>> = {};
  (
    Object.entries(GAME_TABLE_DEFINITIONS) as Array<
      [GameTableName, GameTableDefinition]
    >
  ).forEach(([tableName, definition]) => {
    const tablePath = path.join(PD2_GAME_DATA_DIRECTORY, definition.fileName);
    if (!definition.required && !fs.existsSync(tablePath)) {
      return;
    }

    tables[tableName] = parseGameTableFile(tablePath, definition.keyColumn);
  });

  return { tables };
}

const pd2GameData = loadPd2GameData();

const GAME_DAMAGE_LEVEL_THRESHOLDS = [8, 16, 22, 28, 60] as const;

const FRAME_RATE_DAMAGE_MULTIPLIER = 75;
const FISTS_OF_FIRE_METEOR_PHYSICAL_MULTIPLIER = 2;
const INFERNO_SENTRY_STREAM_MULTIPLIER = 25 / 3;
const FIRE_STREAM_DAMAGE_MULTIPLIER = 25;
const HALF_RATE_DAMAGE_MULTIPLIER = 1 / 2;

const GAME_ETYPES: Record<
  string,
  "fire" | "cold" | "lightning" | "magic" | "poison"
> = {
  fire: "fire",
  cold: "cold",
  ltng: "lightning",
  mag: "magic",
  pois: "poison",
};

const SKILL_DESC_ELEMENTAL_DAMAGE_TEXTS: Record<
  string,
  WeaponElementalDamageElement
> = {
  AddFireDmg: "fire",
  AddColdDmg: "cold",
  AddLtngDmg: "lightning",
};

const WEAPON_ELEMENTAL_DAMAGE_CALC_DESCRIPTIONS: Record<
  string,
  WeaponElementalDamageElement
> = {
  "fire damage%": "fire",
  "cold damage%": "cold",
  "ltng damage%": "lightning",
  "lightning damage%": "lightning",
};

const SERVER_SKILL_MISSILE_COLUMNS = [
  "srvmissile",
  "srvmissilea",
  "srvmissileb",
  "srvmissilec",
] as const;

const SKILL_DESC_MISSILE_COLUMNS = [
  "descmissile1",
  "descmissile2",
  "descmissile3",
] as const;

const SKILL_WEAPON_TYPE_COLUMN_PREFIXES = ["itypea", "itypeb"] as const;

const ITEM_WEAPON_TYPE_PARENTS: Record<string, string[]> = {
  abow: ["bow", "amaz"],
  ajav: ["jave", "amaz"],
  assn: ["clas", "asm"],
  aspe: ["spea", "amaz"],
  axe: ["mgen"],
  blun: ["mgen"],
  bow: ["miss", "rng"],
  club: ["blun"],
  comb: ["mele", "thro"],
  h2h: ["mele", "assn"],
  h2h2: ["h2h"],
  hamm: ["blun"],
  jave: ["comb", "spea"],
  knif: ["mgen", "asm"],
  mace: ["blun"],
  mele: ["weap"],
  mgen: ["mele"],
  miss: ["weap", "rng"],
  orb: ["weap", "sorc"],
  pole: ["mele", "pas"],
  rod: ["blun"],
  sc9: ["pole"],
  scep: ["rod", "gen"],
  spea: ["mele", "pas"],
  staf: ["rod"],
  swor: ["mgen"],
  taxe: ["comb", "axe"],
  thro: ["weap", "rng"],
  tkni: ["comb", "knif"],
  wand: ["rod"],
  xbow: ["miss", "rng"],
};

const KNOWN_SKILL_WEAPON_TYPE_CODES = new Set([
  "asm",
  "comb",
  "h2h",
  "h2h2",
  "jave",
  "knif",
  "mele",
  "miss",
  "sc9",
  "shld",
  "spea",
  "thro",
  "weap",
]);

const REQUIRED_WEAPON_SEQUENCE_SKILLS: Record<
  string,
  RequiredWeaponSequenceRule
> = {
  "Double Throw": {
    handMode: "dual_throw",
    weapsel: "3",
    seqnum: "15",
    srvdofunc: "154",
    itypea1: "comb",
    itypeb1: "comb",
    requiresMissilePayload: true,
  },
  "Double Swing": {
    handMode: "dual_wield",
    weapsel: "3",
    seqnum: "11",
    srvdofunc: "70",
    itypea1: "mele",
    itypeb1: "mele",
    requiresMissilePayload: false,
  },
  Frenzy: {
    handMode: "dual_wield",
    weapsel: "3",
    seqnum: "11",
    srvstfunc: "78",
    srvdofunc: "9",
    itypea1: "mele",
    itypeb1: "mele",
    requiresMissilePayload: false,
  },
  "Dragon Claw": {
    handMode: "dual_wield",
    weapsel: "3",
    seqnum: "16",
    srvstfunc: "25",
    srvdofunc: "46",
    itypea1: "h2h",
    itypeb1: "h2h",
    requiresMissilePayload: false,
  },
};

const MISSILE_CHILD_COLUMNS = [
  "ExplosionMissile",
  "SubMissile1",
  "SubMissile2",
  "SubMissile3",
  "HitSubMissile1",
  "HitSubMissile2",
  "HitSubMissile3",
  "HitSubMissile4",
] as const;

const SKILL_NAME_ALIASES: Record<string, string> = {
  "Amplify Damage": "AmpDmg",
  "Blood Golem": "BloodGolem",
  "Curse Mastery": "CurMas",
  Decoy: "Dopplezon",
  "Fire Blast": "Fire Trauma",
  "Fire Golem": "FireGolem",
  "Iron Golem": "IronGolem",
  "Lower Resist": "LowRes",
  "Shock Web": "Shock Field",
  "Slow Missiles": "Slow Movement",
  "Wake of Fire": "Wake of Fire Sentry",
  "Wake of Inferno": "Inferno Sentry",
  "Claw Mastery": "Claw and Dagger Mastery",
  "One Hand Mastery": "One Handed Mastery",
  "Two Hand Mastery": "Two Handed Mastery",
  Berserker: "Berserk",
  "Blessed Shield": "Holy Shield",
  "Raise Skeleton": "Raise Skeleton Warrior",
  "Phoenix Strike": "Royal Strike",
  "Poison Creeper": "Plague Poppy",
  Lycanthropy: "Shape Shifting",
  "Carrion Vine": "Cycle of Life",
  Fissure: "Eruption",
  "Summon Dire Wolf": "Summon Fenris",
  "Solar Creeper": "Vines",
  Werewolf: "Wearwolf",
  Werebear: "Wearbear",
};

const REVERSE_SKILL_NAME_ALIASES = Object.fromEntries(
  Object.entries(SKILL_NAME_ALIASES).map(([from, to]) => [to, from])
);

const PRIMARY_WEAPON_EQUIPMENT_SLOTS = new Set(["Right Hand", "Left Hand"]);
const SECONDARY_WEAPON_EQUIPMENT_SLOTS = new Set([
  "Right Hand Switch",
  "Left Hand Switch",
]);
const ALL_HAND_EQUIPMENT_SLOTS = new Set([
  ...PRIMARY_WEAPON_EQUIPMENT_SLOTS,
  ...SECONDARY_WEAPON_EQUIPMENT_SLOTS,
]);

function normalizeSkillName(skillName: string): string {
  return skillName.trim();
}

function getCaseInsensitiveRecordValue(
  record: Record<string, string>,
  key: string
): string | undefined {
  const normalizedKey = key.toLowerCase();
  const matchingKey = Object.keys(record).find(
    (candidate) => candidate.toLowerCase() === normalizedKey
  );
  return matchingKey ? record[matchingKey] : undefined;
}

function getEquivalentSkillNames(skillName: string): string[] {
  const normalized = normalizeSkillName(skillName);
  const names = new Set([normalized]);
  const aliasTarget = getCaseInsensitiveRecordValue(
    SKILL_NAME_ALIASES,
    normalized
  );
  const reverseAliasTarget = getCaseInsensitiveRecordValue(
    REVERSE_SKILL_NAME_ALIASES,
    normalized
  );

  if (aliasTarget) {
    names.add(aliasTarget);
  }

  if (reverseAliasTarget) {
    names.add(reverseAliasTarget);
  }

  for (const [from, to] of Object.entries(SKILL_NAME_ALIASES)) {
    if (to.toLowerCase() === normalized.toLowerCase()) {
      names.add(from);
    }
  }

  return Array.from(names);
}

const gameColumnIndexes = new Map<GameTableName, Map<string, number>>();

function getGameTable(tableName: GameTableName): GameTable {
  const table = pd2GameData.tables[tableName];
  if (!table) {
    throw new Error(
      `PD2 game table ${tableName} is not available in the extract`
    );
  }

  return table;
}

function getOptionalGameTable(tableName: GameTableName): GameTable | undefined {
  return pd2GameData.tables[tableName];
}

function getGameColumnIndex(
  tableName: GameTableName,
  columnName: string
): number {
  const cached = gameColumnIndexes.get(tableName);
  if (cached) {
    return cached.get(columnName) ?? -1;
  }

  const indexes = new Map<string, number>();
  getGameTable(tableName).columns.forEach((column, index) => {
    indexes.set(column, index);
  });
  gameColumnIndexes.set(tableName, indexes);
  return indexes.get(columnName) ?? -1;
}

function getGameRow(
  tableName: GameTableName,
  key: string
): string[] | undefined {
  const table = getGameTable(tableName);
  for (const candidate of getEquivalentSkillNames(key)) {
    const direct = table.rowsByKey[candidate];
    if (direct) {
      return direct;
    }
  }

  const normalizedKey = key.toLowerCase();
  return Object.entries(table.rowsByKey).find(
    ([rowKey]) => rowKey.toLowerCase() === normalizedKey
  )?.[1];
}

function getOptionalGameRow(
  tableName: GameTableName,
  key: string
): string[] | undefined {
  const table = getOptionalGameTable(tableName);
  if (!table) {
    return undefined;
  }

  const direct = table.rowsByKey[key];
  if (direct) {
    return direct;
  }

  const normalizedKey = key.toLowerCase();
  return Object.entries(table.rowsByKey).find(
    ([rowKey]) => rowKey.toLowerCase() === normalizedKey
  )?.[1];
}

function getGameRowString(
  tableName: GameTableName,
  row: string[],
  columnName: string
): string {
  const index = getGameColumnIndex(tableName, columnName);
  return index >= 0 ? row[index] || "" : "";
}

function getGameRowNumber(
  tableName: GameTableName,
  row: string[],
  columnName: string
): number {
  const value = Number(getGameRowString(tableName, row, columnName));
  return Number.isFinite(value) ? value : 0;
}

function getGameSkillRowName(skillName: string): string {
  const skillRow = getGameRow("Skills", skillName);
  return skillRow
    ? getGameRowString("Skills", skillRow, "skill") || skillName
    : skillName;
}

function getMartialArtsChargeDefinition(
  skillName: string
):
  | (MartialArtsChargeDefinition & {
      sourceSkillName: string;
    })
  | undefined {
  const sourceSkillName = getGameSkillRowName(skillName);
  const definition =
    MARTIAL_ARTS_CHARGE_SKILL_DEFINITIONS[
      normalizeSkillName(sourceSkillName).toLowerCase()
    ] ||
    MARTIAL_ARTS_CHARGE_SKILL_DEFINITIONS[
      normalizeSkillName(skillName).toLowerCase()
    ];

  return definition ? { ...definition, sourceSkillName } : undefined;
}

function getChargeCountForDefinition(
  definition: MartialArtsChargeDefinition,
  sourceSkillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>
): number {
  if (definition.chargeCountExpression) {
    const skillRow = getGameRow("Skills", sourceSkillName);
    if (skillRow) {
      const expression =
        getGameRowString("Skills", skillRow, definition.chargeCountExpression) ||
        definition.chargeCountExpression;
      const count = evaluateGameCalcExpression(
        expression,
        skillRow,
        skillMap,
        level
      );
      if (count > 0) {
        return Math.max(1, Math.floor(count));
      }
    }
  }

  return definition.chargeCount || 0;
}

function getSkillProfileKeySuffix(skillOption: DamageSkillOption): string {
  return skillOption.chargeVariant === "charge" && skillOption.chargeNumber
    ? `::charge:${skillOption.chargeNumber}`
    : "";
}

function getGameSkillDescRow(skillRow: string[]): string[] | undefined {
  const descKey = getGameRowString("Skills", skillRow, "skilldesc");
  return descKey ? getGameRow("SkillDesc", descKey) : undefined;
}

function getGameSkillId(skillName: string): number {
  const row = getGameRow("Skills", skillName);
  return row ? getGameRowNumber("Skills", row, "Id") : Number.MAX_SAFE_INTEGER;
}

function getGameSkillNamesById(skillNames: string[]): string[] {
  return [...skillNames].sort(
    (left, right) => getGameSkillId(left) - getGameSkillId(right)
  );
}

function getGameSkillStats(
  skillRow: string[],
  prefix: "aura" | "passive",
  count: number
): string[] {
  return Array.from({ length: count }, (_, index) =>
    getGameRowString("Skills", skillRow, `${prefix}stat${index + 1}`)
  ).filter(Boolean);
}

function getGameStatCalcColumn(
  prefix: "aura" | "passive",
  index: number
): string {
  return prefix === "aura" ? `aurastatcalc${index}` : `passivecalc${index}`;
}

function getPassiveStatVisitKey(skillName: string, statName: string): string {
  return `${normalizeSkillName(skillName).toLowerCase()}::${statName.toLowerCase()}`;
}

function normalizeGameCalcFormula(expression: string): string {
  return expression.replace(/^"|"$/g, "").replace(/\s+/g, "").toLowerCase();
}

function isPureStatPassthrough(statName: string, expression: string): boolean {
  const normalizedExpression = normalizeGameCalcFormula(expression);
  const normalizedStat = statName.toLowerCase();

  return (
    normalizedExpression === `stat('${normalizedStat}'.accr)` ||
    normalizedExpression === `stat("${normalizedStat}".accr)`
  );
}

function getGameSkillStatValue(
  skillName: string,
  statNames: readonly string[],
  prefix: "aura" | "passive",
  count: number,
  skillMap: Map<string, SkillEntry>,
  visitingPassiveStats = new Set<string>()
): number | undefined {
  const skillRow = getGameRow("Skills", skillName);
  const level = getGameSkillEntry(skillMap, skillName).level;
  if (!skillRow || level <= 0) {
    return undefined;
  }

  for (let index = 1; index <= count; index += 1) {
    const stat = getGameRowString("Skills", skillRow, `${prefix}stat${index}`);
    if (!statNames.includes(stat)) {
      continue;
    }

    const expression = getGameRowString(
      "Skills",
      skillRow,
      getGameStatCalcColumn(prefix, index)
    );
    if (isPureStatPassthrough(stat, expression)) {
      continue;
    }

    const visitKey = getPassiveStatVisitKey(skillName, stat);
    if (visitingPassiveStats.has(visitKey)) {
      continue;
    }

    const nextVisitingPassiveStats = new Set(visitingPassiveStats);
    nextVisitingPassiveStats.add(visitKey);

    return evaluateGameCalcExpression(
      expression,
      skillRow,
      skillMap,
      level,
      nextVisitingPassiveStats
    );
  }

  return undefined;
}

function getGameSkillPassiveStatValue(
  skillName: string,
  statNames: readonly string[],
  skillMap: Map<string, SkillEntry>,
  visitingPassiveStats = new Set<string>()
): number | undefined {
  return getGameSkillStatValue(
    skillName,
    statNames,
    "passive",
    5,
    skillMap,
    visitingPassiveStats
  );
}

function getGameSkillAuraStatValue(
  skillName: string,
  statNames: readonly string[],
  skillMap: Map<string, SkillEntry>,
  visitingPassiveStats = new Set<string>()
): number | undefined {
  return getGameSkillStatValue(
    skillName,
    statNames,
    "aura",
    6,
    skillMap,
    visitingPassiveStats
  );
}

function getGamePassiveStatValue(
  statName: string,
  skillMap: Map<string, SkillEntry>,
  visitingPassiveStats = new Set<string>()
): number {
  let total = 0;

  skillMap.forEach((entry, skillName) => {
    if (entry.level <= 0) {
      return;
    }

    total +=
      getGameSkillPassiveStatValue(
        skillName,
        [statName],
        skillMap,
        visitingPassiveStats
      ) || 0;
  });

  return total;
}

const SUPPORTED_AURA_DAMAGE_STATS = new Set([
  "damagepercent",
  "firemindam",
  "firemaxdam",
  "coldmindam",
  "coldmaxdam",
  "lightmindam",
  "lightmaxdam",
  "magicmindam",
  "magicmaxdam",
]);

const SUPPORTED_AURA_POISON_STATS = new Set(["poisonmindam", "poisonmaxdam"]);

const SUPPORTED_AURA_SKILL_LEVEL_STATS = new Set(["item_allskills"]);

const SUPPORTED_AURA_EFFECT_STATS = new Set([
  ...SUPPORTED_AURA_DAMAGE_STATS,
  ...SUPPORTED_AURA_SKILL_LEVEL_STATS,
]);

const NON_SELECTABLE_BUFF_DAMAGE_STATS = new Set([
  ...SUPPORTED_AURA_DAMAGE_STATS,
  "poisonmindam",
  "poisonmaxdam",
]);

const NON_DAMAGE_SUMMON_PET_TYPES = new Set(["none", "totem", "revive"]);

const NON_SELECTABLE_SUMMON_PET_TYPES = new Set([
  ...NON_DAMAGE_SUMMON_PET_TYPES,
  "assassintrap",
  "bladesent",
  "desecrate",
]);

const SUMMON_VARIANT_DEFINITIONS: Record<string, SummonVariantDefinition[]> = {
  "Raise Skeletal Mage": [
    {
      id: "fire-mage",
      label: "Fire Mage",
      componentLabels: ["Necromage3"],
    },
    {
      id: "cold-mage",
      label: "Cold Mage",
      componentLabels: ["Necromage2"],
    },
    {
      id: "lightning-mage",
      label: "Lightning Mage",
      componentLabels: ["Necromage4"],
    },
    {
      id: "poison-mage",
      label: "Poison Mage",
      componentLabels: ["Necromage1"],
    },
  ],
};

function getSummonVariantDefinitions(
  skillName: string
): SummonVariantDefinition[] {
  return SUMMON_VARIANT_DEFINITIONS[skillName] || [];
}

function getSummonVariantDefinition(
  skillName: string,
  variantId?: string
): SummonVariantDefinition | undefined {
  if (!variantId) {
    return undefined;
  }

  return getSummonVariantDefinitions(skillName).find(
    (variant) => variant.id === variantId
  );
}

function hasAnyGameStat(skillRow: string[], stats: Set<string>): boolean {
  return [
    ...getGameSkillStats(skillRow, "aura", 6),
    ...getGameSkillStats(skillRow, "passive", 5),
  ].some((stat) => stats.has(stat));
}

function hasAllGameStats(
  skillRow: string[],
  stats: readonly string[],
  prefix: "aura" | "passive",
  count: number
): boolean {
  const rowStats = new Set(getGameSkillStats(skillRow, prefix, count));
  return stats.every((stat) => rowStats.has(stat));
}

function isInGamePlayerSkill(skillRow: string[]): boolean {
  return (
    Boolean(getGameRowString("Skills", skillRow, "charclass")) &&
    getGameRowString("Skills", skillRow, "InGame") === "1"
  );
}

function isGameSelfOnlyPoisonBuffSkill(skillRow: string[]): boolean {
  return (
    isInGamePlayerSkill(skillRow) &&
    getGameRowString("Skills", skillRow, "aura") !== "1" &&
    !getGameRowString("Skills", skillRow, "leftskill") &&
    !getGameRowString("Skills", skillRow, "summon") &&
    Boolean(getGameRowString("Skills", skillRow, "aurastate")) &&
    !getGameRowString("Skills", skillRow, "auratargetstate") &&
    getGameRowString("Skills", skillRow, "EType") === "pois" &&
    getGameRowNumber("Skills", skillRow, "ELen") > 0 &&
    hasAllGameStats(skillRow, [...SUPPORTED_AURA_POISON_STATS], "aura", 6)
  );
}

function isGameSummonSkill(skillName: string): boolean {
  const skillRow = getGameRow("Skills", skillName);
  const petType = skillRow
    ? getGameRowString("Skills", skillRow, "pettype")
    : "";
  if (NON_SELECTABLE_SUMMON_PET_TYPES.has(petType.toLowerCase())) {
    return false;
  }

  return Boolean(
    skillRow && (getGameRowString("Skills", skillRow, "summon") || petType)
  );
}

function isSelectableSummonSkill(skillName: string): boolean {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow || !isInGamePlayerSkill(skillRow)) {
    return false;
  }

  const summon = getGameRowString("Skills", skillRow, "summon");
  const petType = getGameRowString("Skills", skillRow, "pettype").toLowerCase();
  if (!summon && !petType) {
    return false;
  }

  if (NON_SELECTABLE_SUMMON_PET_TYPES.has(petType)) {
    return false;
  }

  return getSummonDamageComponents(skillName, 1, EMPTY_SKILL_MAP).length > 0;
}

function isGameSelfOrPartyBuffSkill(skillName: string): boolean {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow || !isInGamePlayerSkill(skillRow)) {
    return false;
  }

  if (getGameRowString("Skills", skillRow, "leftskill")) {
    return false;
  }

  return hasAnyGameStat(skillRow, NON_SELECTABLE_BUFF_DAMAGE_STATS);
}

function isGameWeaponCarriedPhysicalDamageSkill(skillName: string): boolean {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return false;
  }

  const hasDirectPhysicalDamage =
    Boolean(getGameRowString("Skills", skillRow, "MinDam")) ||
    Boolean(getGameRowString("Skills", skillRow, "MaxDam"));

  return (
    hasDirectPhysicalDamage &&
    getGameRowNumber("Skills", skillRow, "SrcDam") > 0 &&
    !getGameRowString("Skills", skillRow, "EType")
  );
}

function isGameKickSkill(skillName: string): boolean {
  const skillRow = getGameRow("Skills", skillName);
  return Boolean(skillRow && getGameRowNumber("Skills", skillRow, "Kick") > 0);
}

function isGameWeaponAttackSkill(skillName: string): boolean {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow || !isInGamePlayerSkill(skillRow)) {
    return false;
  }

  if (isGameWeaponCarriedPhysicalDamageSkill(skillName)) {
    return true;
  }

  if (
    getGameRowString("Skills", skillRow, "aura") === "1" ||
    getGameRowString("Skills", skillRow, "passive") === "1" ||
    getGameRowString("Skills", skillRow, "summon")
  ) {
    return false;
  }

  const descRow = getGameSkillDescRow(skillRow);
  const hasWeaponSourceDamage =
    getGameRowNumber("Skills", skillRow, "SrcDam") > 0 ||
    Boolean(getGameRowString("Skills", skillRow, "itypea1")) ||
    Boolean(getGameRowString("Skills", skillRow, "itypeb1"));
  const hasKickDamage = getGameRowNumber("Skills", skillRow, "Kick") > 0;
  const hasAttackDescription = Boolean(
    descRow && getGameRowString("SkillDesc", descRow, "descatt")
  );

  return (
    getGameRowString("Skills", skillRow, "leftskill") === "1" &&
    (hasWeaponSourceDamage || hasKickDamage || hasAttackDescription)
  );
}

function getSkillAllowedTransformationIds(skillName: string): string[] {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow || !getGameRowString("Skills", skillRow, "restrict")) {
    return [];
  }

  const stateColumns = ["State1", "State2", "State3"] as const;
  const transformationIds = stateColumns
    .map(
      (columnName) =>
        GAME_STATE_TO_TRANSFORMATION_ID[
          getGameRowString("Skills", skillRow, columnName).toLowerCase()
        ]
    )
    .filter((id): id is string => Boolean(id));

  return Array.from(new Set(transformationIds));
}

function getGameAuraDefinitionNames(
  definition: PlayerAuraDefinition
): string[] {
  return [
    definition.id,
    definition.name,
    definition.skillName,
    ...(definition.sourceSkillNames || []),
  ];
}

function namesIncludeSkillName(
  names: readonly string[],
  skillName: string
): boolean {
  const normalized = normalizeSkillName(skillName).toLowerCase();
  return names.some(
    (name) => normalizeSkillName(name).toLowerCase() === normalized
  );
}

function getDamageScopeCount(
  skillRow: string[] | undefined,
  definition: DamageScopeDefinition,
  skillMap: Map<string, SkillEntry>,
  level: number
): number | undefined {
  if (!skillRow || !definition.countColumn) {
    return undefined;
  }

  const expression = getGameRowString(
    "Skills",
    skillRow,
    definition.countColumn
  );
  if (!expression) {
    return undefined;
  }

  const count = evaluateGameCalcExpression(
    expression,
    skillRow,
    skillMap,
    level
  );
  return count > 0 ? count : undefined;
}

function getDamageScope(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>,
  damageMode: DamageSkillOption["damageMode"],
  weaponSelection: WeaponSelection
): DamageProfile["damageScope"] {
  if (damageMode === "summon") {
    return {
      label: "per summon hit",
      note: "Displayed totals are per summon hit. Summon count, AI choices, attack rate, hit chance, target count, and uptime are not multiplied into totals.",
      sourceRefs: [
        {
          table: "Skills.txt",
          row: skillName,
          columns: ["summon", "sumskill*", "petmax"],
        },
      ],
    };
  }

  if (weaponSelection.sequenceHits?.length) {
    return {
      label: "per weapon cycle",
      count: weaponSelection.sequenceHits.length,
      countLabel: "modeled hits",
      note: "Displayed totals are for one modeled weapon cycle. Movement duration, animation timing, hit chance, and target count are not multiplied into totals.",
      sourceRefs: [
        {
          table: "Skills.txt",
          row: skillName,
          columns: ["weapsel", "seqnum", "SrcDam", "srvstfunc", "srvdofunc"],
        },
      ],
    };
  }

  const skillRow = getGameRow("Skills", skillName);
  const definition =
    SKILL_DAMAGE_SCOPE_DEFINITIONS[normalizeSkillName(skillName).toLowerCase()];
  if (definition) {
    return {
      label: definition.label,
      count: getDamageScopeCount(skillRow, definition, skillMap, level),
      countLabel: definition.countLabel,
      note: definition.note,
      sourceRefs: [
        {
          table: "Skills.txt",
          row: skillName,
          columns: [
            ...(definition.countColumn ? [definition.countColumn] : []),
            "srvstfunc",
            "srvdofunc",
            "srvmissile*",
            "cltmissile*",
          ],
        },
      ],
    };
  }

  if (damageMode === "spell") {
    return {
      label: "per target hit",
      note: "Displayed totals are per target hit. Target count, repeated hit frequency, and cast rate are not multiplied into totals.",
      sourceRefs: [
        {
          table: "Skills.txt",
          row: skillName,
          columns: ["EType", "EMin", "EMax", "srvdofunc", "srvmissile*"],
        },
      ],
    };
  }

  if (weaponSelection.option.handMode === "missile") {
    return {
      label: isBowOrCrossbow(weaponSelection.item)
        ? "per projectile hit"
        : "per throw hit",
      note: "Displayed totals are per projectile hit. Projectile count, target count, hit chance, and attack rate are not multiplied into totals.",
      sourceRefs: [
        {
          table: "Skills.txt",
          row: skillName,
          columns: ["SrcDam", "srvmissile*", "cltmissile*"],
        },
      ],
    };
  }

  return DEFAULT_DAMAGE_SCOPE;
}

function getChargeDamageScope(
  skillOption: DamageSkillOption,
  displaySkillName: string,
  sourceSkillName: string
): DamageProfile["damageScope"] | undefined {
  const definition = getMartialArtsChargeDefinition(sourceSkillName);
  if (
    !definition ||
    skillOption.chargeVariant !== "charge" ||
    !skillOption.chargeNumber
  ) {
    return undefined;
  }

  const chargeNumber = skillOption.chargeNumber;
  const chargeLabel = definition.chargeLabel || "Charge";
  const chargeLabelLower = chargeLabel.toLowerCase();
  const isStack = chargeLabelLower === "stack";
  const label = `${chargeLabelLower} ${chargeNumber} ${
    isStack ? "hit" : "release"
  }`;
  const note = isStack
    ? `${displaySkillName} stack ${chargeNumber} totals include one weapon hit with the stack ${chargeNumber} damage percent exposed by Skills.txt. Stack buildup, duration, hit chance, attack speed, and target count are not multiplied into totals.`
    : `${displaySkillName} charge ${chargeNumber} totals include normal hit damage plus every modeled payload from charges 1 through ${chargeNumber}, matching PD2's cumulative charge release. Charges from other skills, charge-building attacks, hit chance, attack speed, target count, and repeated missile overlap are not multiplied into totals.`;

  return {
    label,
    count: skillOption.chargeCount || definition.chargeCount,
    countLabel: isStack ? "stacks" : "charges",
    note,
    sourceRefs: [
      {
        table: "Skills.txt",
        row: sourceSkillName,
        columns: [
          "srvdofunc",
          "srvprgfunc*",
          "prgcalc*",
          "srvmissile*",
          "cltmissile*",
        ],
      },
    ],
  };
}

function getPlayerAuraDefinitionsFromGameData(): PlayerAuraDefinition[] {
  const definitions = new Map<string, PlayerAuraDefinition>();
  const addDefinition = (definition: PlayerAuraDefinition) => {
    if (!definitions.has(definition.id)) {
      definitions.set(definition.id, definition);
    }
  };

  getGameSkillNamesById(
    Object.entries(getGameTable("Skills").rowsByKey)
      .filter(([, skillRow]) => {
        return (
          isInGamePlayerSkill(skillRow) &&
          getGameRowString("Skills", skillRow, "charclass") === "pal" &&
          getGameRowString("Skills", skillRow, "aura") === "1"
        );
      })
      .map(([skillName]) => skillName)
  ).forEach((skillName) => {
    addDefinition({ id: skillName, name: skillName, skillName });
  });

  getGameSkillNamesById(
    Object.entries(getGameTable("Skills").rowsByKey)
      .filter(([, skillRow]) => {
        return (
          isInGamePlayerSkill(skillRow) &&
          getGameRowString("Skills", skillRow, "pettype") === "totem"
        );
      })
      .map(([skillName]) => skillName)
  ).forEach((sourceSkillName) => {
    const sourceRow = getGameRow("Skills", sourceSkillName);
    if (!sourceRow) {
      return;
    }

    for (let index = 1; index <= 5; index += 1) {
      const auraSkillName = getGameRowString(
        "Skills",
        sourceRow,
        `sumskill${index}`
      );
      const auraRow = auraSkillName
        ? getGameRow("Skills", auraSkillName)
        : undefined;
      if (auraRow && getGameRowString("Skills", auraRow, "aura") === "1") {
        addDefinition({
          id: sourceSkillName,
          name: sourceSkillName,
          skillName: auraSkillName,
          sourceSkillNames: [sourceSkillName],
        });
      }
    }
  });

  getGameSkillNamesById(
    Object.entries(getGameTable("Skills").rowsByKey)
      .filter(([, skillRow]) => {
        return (
          isInGamePlayerSkill(skillRow) &&
          getGameRowString("Skills", skillRow, "aura") !== "1" &&
          !getGameRowString("Skills", skillRow, "summon") &&
          Boolean(getGameRowString("Skills", skillRow, "auratargetstate")) &&
          getGameRowString("Skills", skillRow, "aurastate") ===
            getGameRowString("Skills", skillRow, "auratargetstate") &&
          hasAnyGameStat(skillRow, SUPPORTED_AURA_EFFECT_STATS)
        );
      })
      .map(([skillName]) => skillName)
  ).forEach((skillName) => {
    addDefinition({ id: skillName, name: skillName, skillName });
  });

  getGameSkillNamesById(
    Object.entries(getGameTable("Skills").rowsByKey)
      .filter(([, skillRow]) => isGameSelfOnlyPoisonBuffSkill(skillRow))
      .map(([skillName]) => skillName)
  ).forEach((skillName) => {
    addDefinition({ id: skillName, name: skillName, skillName });
  });

  return Array.from(definitions.values());
}

const PLAYER_AURA_DEFINITIONS = getPlayerAuraDefinitionsFromGameData();

function getPlayerAuraDefinition(
  auraName: string
): PlayerAuraDefinition | undefined {
  return PLAYER_AURA_DEFINITIONS.find((definition) =>
    namesIncludeSkillName(getGameAuraDefinitionNames(definition), auraName)
  );
}

function isPlayerAuraSkill(skillName: string): boolean {
  return Boolean(getPlayerAuraDefinition(skillName));
}

function getMaxModeledSkillLevel(skillName: string): number {
  const skillRow = getGameRow("Skills", skillName);
  const maxSkillLevel = skillRow
    ? getGameRowNumber("Skills", skillRow, "maxlvl")
    : 0;
  const maxScalingLevel =
    GAME_DAMAGE_LEVEL_THRESHOLDS[GAME_DAMAGE_LEVEL_THRESHOLDS.length - 1];

  return Math.max(maxSkillLevel, maxScalingLevel);
}

function getManualAuraLevelOptions(definition: PlayerAuraDefinition): number[] {
  const maxLevel = getMaxModeledSkillLevel(definition.skillName);
  return Array.from({ length: maxLevel }, (_, index) => index + 1);
}

function getGameSkillParam(row: string[], paramNumber: number): number {
  return getGameRowNumber("Skills", row, `Param${paramNumber}`);
}

function getGameLinearParamValue(
  row: string[],
  level: number,
  firstParam: string,
  secondParam: string
): number {
  return (
    getGameSkillParam(row, Number(firstParam)) +
    Math.max(0, level - 1) * getGameSkillParam(row, Number(secondParam))
  );
}

function getGameDiminishingParamValue(
  row: string[],
  level: number,
  firstParam: string,
  secondParam: string
): number {
  const min = getGameSkillParam(row, Number(firstParam));
  const max = getGameSkillParam(row, Number(secondParam));
  const effectiveLevel = Math.max(0, level);
  const scale = Math.floor((110 * effectiveLevel) / (effectiveLevel + 6));

  return Math.min(max, min + Math.floor(((max - min) * scale) / 100));
}

function getGameLevelScaledValue(
  tableName: "Skills" | "Missiles",
  row: string[],
  level: number,
  baseColumn: string,
  levelColumns: readonly string[]
): number {
  let value = getGameRowNumber(tableName, row, baseColumn);
  let currentLevel = 1;

  GAME_DAMAGE_LEVEL_THRESHOLDS.forEach((threshold, index) => {
    const scale = getGameRowNumber(tableName, row, levelColumns[index]);
    while (currentLevel < level && currentLevel < threshold) {
      value += scale;
      currentLevel += 1;
    }
  });

  return value * getGameHitShiftMultiplier(tableName, row);
}

function getGameHitShiftMultiplier(
  tableName: GameTableName,
  row: string[]
): number {
  const hitShift = getGameRowNumber(tableName, row, "HitShift");
  return 1 / 2 ** (8 - hitShift);
}

function getGameLevelScaledRange(
  tableName: "Skills" | "Missiles",
  row: string[],
  level: number,
  minBaseColumn: string,
  maxBaseColumn: string,
  minLevelColumns: readonly string[],
  maxLevelColumns: readonly string[]
): DamageRange | undefined {
  const minBase = getGameRowString(tableName, row, minBaseColumn);
  const maxBase = getGameRowString(tableName, row, maxBaseColumn);
  if (!minBase || !maxBase) {
    return undefined;
  }

  let min = getGameRowNumber(tableName, row, minBaseColumn);
  let max = getGameRowNumber(tableName, row, maxBaseColumn);
  let currentLevel = 1;

  GAME_DAMAGE_LEVEL_THRESHOLDS.forEach((threshold, index) => {
    const minScale = getGameRowNumber(tableName, row, minLevelColumns[index]);
    const maxScale = getGameRowNumber(tableName, row, maxLevelColumns[index]);
    while (currentLevel < level && currentLevel < threshold) {
      min += minScale;
      max += maxScale;
      currentLevel += 1;
    }
  });

  const hitShift = getGameHitShiftMultiplier(tableName, row);
  return {
    min: min * hitShift,
    max: max * hitShift,
  };
}

function getGameDescDam(skillRow: string[]): string {
  const descKey = getGameRowString("Skills", skillRow, "skilldesc");
  const descRow = getGameRow("SkillDesc", descKey);
  return descRow ? getGameRowString("SkillDesc", descRow, "descdam") : "";
}

function getGameDotMultiplier(
  tableName: "Skills" | "Missiles",
  row: string[],
  elementType: string,
  skillName: string,
  rowKey: string,
  maxLevelColumns: readonly string[]
): number {
  if (elementType === "pois") {
    if (tableName === "Skills") {
      return getGameRowNumber(tableName, row, "ELen") || 1;
    }
    return getGameRowNumber(tableName, row, "ELen") || 1;
  }

  if (
    tableName === "Missiles" &&
    rowKey[0] === rowKey[0]?.toLowerCase() &&
    rowKey.includes("fire") &&
    rowKey !== "fistsoffirenova"
  ) {
    return FRAME_RATE_DAMAGE_MULTIPLIER;
  }

  if (rowKey === "fofmeteor") {
    return FISTS_OF_FIRE_METEOR_PHYSICAL_MULTIPLIER;
  }

  if (tableName === "Skills") {
    const descDam = getGameDescDam(row);
    if (skillName === "Inferno Sentry") {
      return INFERNO_SENTRY_STREAM_MULTIPLIER;
    }
    if (descDam === "9" || descDam === "27") {
      return FRAME_RATE_DAMAGE_MULTIPLIER;
    }
    if (descDam === "8") {
      return FIRE_STREAM_DAMAGE_MULTIPLIER;
    }
    if (descDam === "26") {
      return HALF_RATE_DAMAGE_MULTIPLIER;
    }
  }

  void maxLevelColumns;
  return 1;
}

function getGameMasteryDamageBonusPercent(
  element: "fire" | "cold" | "lightning",
  skillMap: Map<string, SkillEntry>
): number {
  return getElementalMasteryDamageBonusPercent(element, skillMap);
}

function getGameSkillEntry(
  skillMap: Map<string, SkillEntry>,
  skillName: string
): SkillEntry {
  const direct = getSkillEntry(skillMap, skillName);
  if (direct.level > 0 || direct.baseLevel > 0) {
    return direct;
  }

  const normalized = skillName.toLowerCase();
  for (const [name, entry] of skillMap.entries()) {
    if (name.toLowerCase() === normalized) {
      return entry;
    }
  }

  const skillRow = getGameRow("Skills", skillName);
  const skillDescName = skillRow
    ? getGameRowString("Skills", skillRow, "skilldesc").toLowerCase()
    : "";
  if (skillDescName) {
    for (const [name, entry] of skillMap.entries()) {
      if (name.toLowerCase() === skillDescName) {
        return entry;
      }
    }
  }

  return direct;
}

function evaluateGameCalcExpression(
  expression: string,
  skillRow: string[],
  skillMap: Map<string, SkillEntry>,
  level = 0,
  visitingPassiveStats = new Set<string>(),
  options: { elementalAliasMode?: "scaled" | "fixed" } = {}
): number {
  if (!expression) {
    return 0;
  }

  const linear = (_: string, firstParam: string, secondParam: string) => {
    return String(
      getGameLinearParamValue(skillRow, level, firstParam, secondParam)
    );
  };
  const diminishing = (_: string, firstParam: string, secondParam: string) => {
    return String(
      getGameDiminishingParamValue(skillRow, level, firstParam, secondParam)
    );
  };
  const elementalMin = getGameLevelScaledValue(
    "Skills",
    skillRow,
    Math.max(1, level),
    "EMin",
    ["EMinLev1", "EMinLev2", "EMinLev3", "EMinLev4", "EMinLev5"]
  );
  const elementalMax = getGameLevelScaledValue(
    "Skills",
    skillRow,
    Math.max(1, level),
    "EMax",
    ["EMaxLev1", "EMaxLev2", "EMaxLev3", "EMaxLev4", "EMaxLev5"]
  );
  const usesSynergizedElemental = /\bed(?:ns|xs)\b/.test(expression);
  const elementalSynergyPercent = usesSynergizedElemental
    ? evaluateGameCalcExpression(
        getGameRowString("Skills", skillRow, "EDmgSymPerCalc"),
        skillRow,
        skillMap,
        level,
        visitingPassiveStats
      )
    : 0;
  const elementalAliasMultiplier =
    options.elementalAliasMode === "fixed" ? 256 : 1;
  const elementalMinAlias = Math.floor(elementalMin * elementalAliasMultiplier);
  const elementalMaxAlias = Math.floor(elementalMax * elementalAliasMultiplier);
  const synergizedElementalMinAlias = Math.floor(
    elementalMin *
      (1 + elementalSynergyPercent / 100) *
      elementalAliasMultiplier
  );
  const synergizedElementalMaxAlias = Math.floor(
    elementalMax *
      (1 + elementalSynergyPercent / 100) *
      elementalAliasMultiplier
  );

  const normalized = expression
    .replace(/^"|"$/g, "")
    .replace(/\bmin\(/g, "Math.min(")
    .replace(/\bmax\(/g, "Math.max(")
    .replace(/skill\('([^']+)'\.blvl\)/g, (_, skillName: string) =>
      String(getGameSkillEntry(skillMap, skillName).baseLevel)
    )
    .replace(/skill\('([^']+)'\.lvl\)/g, (_, skillName: string) =>
      String(getGameSkillEntry(skillMap, skillName).level)
    )
    .replace(
      /skill\('([^']+)'\.par([1-8])\)/g,
      (_, skillName: string, paramNumber: string) => {
        const sourceRow = getGameRow("Skills", skillName);
        return String(
          sourceRow ? getGameSkillParam(sourceRow, Number(paramNumber)) : 0
        );
      }
    )
    .replace(
      /skill\('([^']+)'\.ln([1-8])([1-8])\)/g,
      (_, skillName: string, firstParam: string, secondParam: string) => {
        const sourceRow = getGameRow("Skills", skillName);
        const sourceLevel = getGameSkillEntry(skillMap, skillName).level;
        return String(
          sourceRow && sourceLevel > 0
            ? getGameLinearParamValue(
                sourceRow,
                sourceLevel,
                firstParam,
                secondParam
              )
            : 0
        );
      }
    )
    .replace(
      /skill\('([^']+)'\.dm([1-8])([1-8])\)/g,
      (_, skillName: string, firstParam: string, secondParam: string) => {
        const sourceRow = getGameRow("Skills", skillName);
        const sourceLevel = getGameSkillEntry(skillMap, skillName).level;
        return String(
          sourceRow && sourceLevel > 0
            ? getGameDiminishingParamValue(
                sourceRow,
                sourceLevel,
                firstParam,
                secondParam
              )
            : 0
        );
      }
    )
    .replace(/\bln([1-8])([1-8])\b/g, linear)
    .replace(/\bdm([1-8])([1-8])\b/g, diminishing)
    .replace(/\btoht\b/g, () =>
      String(
        getGameRowNumber("Skills", skillRow, "ToHit") +
          Math.max(0, level - 1) *
            getGameRowNumber("Skills", skillRow, "LevToHit")
      )
    )
    .replace(/\bedmn\b/g, String(elementalMinAlias))
    .replace(/\bedmx\b/g, String(elementalMaxAlias))
    .replace(/\bedns\b/g, String(synergizedElementalMinAlias))
    .replace(/\bedxs\b/g, String(synergizedElementalMaxAlias))
    .replace(/\bclc([1-4])\b/g, (_, calcNumber: string) =>
      String(
        evaluateGameCalcExpression(
          getGameRowString("Skills", skillRow, `calc${calcNumber}`),
          skillRow,
          skillMap,
          level,
          visitingPassiveStats
        )
      )
    )
    .replace(/\blvl\b/g, String(level))
    .replace(/\bblvl\b/g, String(level))
    .replace(/stat\('([^']+)'\.accr\)/g, (_, statName: string) =>
      String(getGamePassiveStatValue(statName, skillMap, visitingPassiveStats))
    )
    .replace(/\bpar(\d+)\b/g, (_, paramNumber: string) =>
      String(getGameSkillParam(skillRow, Number(paramNumber)))
    );

  if (!/^[\d+\-*/().,\sMathminax<>!=?:]+$/.test(normalized)) {
    return 0;
  }

  try {
    return Math.floor(Function(`"use strict"; return (${normalized});`)());
  } catch {
    return 0;
  }
}

function getGameElementalBonusPercent(
  element: "fire" | "cold" | "lightning" | "magic" | "poison",
  skillMap: Map<string, SkillEntry>,
  realStats?: CharacterData["realStats"],
  sourceSkillName?: string
): number {
  const localMastery =
    sourceSkillName && element !== "magic"
      ? getLocalElementalMasteryDamageBonusPercent(
          element,
          sourceSkillName,
          skillMap
        )
      : undefined;

  if (element === "poison") {
    return getPoisonSkillDamageBonusPercent(realStats) + (localMastery || 0);
  }

  if (element === "magic") {
    return 0;
  }

  return (
    getElementalSkillDamageBonusPercent(element, realStats) +
    (localMastery ?? getGameMasteryDamageBonusPercent(element, skillMap))
  );
}

function scaleDamageRangeInStages(
  range: DamageRange,
  firstPercent: number,
  secondPercent: number
): DamageRange {
  return scaleDamageRange(scaleDamageRange(range, firstPercent), secondPercent);
}

function createGameComponent(
  label: string,
  element: DamageElement,
  baseRange: DamageRange,
  synergyPercent: number,
  elementalBonusPercent: number,
  source: "skill" | "missile",
  sourceRefs: DamageSourceReference[],
  timing: "instant" | "over_time" = "instant",
  notes: string[] = []
): DirectSkillDamage["components"][number] {
  return {
    label,
    element,
    damage: scaleDamageRangeInStages(
      baseRange,
      synergyPercent,
      elementalBonusPercent
    ),
    source,
    timing,
    sourceRefs,
    notes,
  };
}

function applyGameDotMultiplier(
  range: DamageRange,
  multiplier: number
): DamageRange {
  return {
    min: range.min * multiplier,
    max: range.max * multiplier,
  };
}

function getGameComponentTiming(
  elementType: string,
  dotMultiplier: number,
  isDirectAttackPayload = false
): "instant" | "over_time" {
  return elementType === "pois" || (!isDirectAttackPayload && dotMultiplier !== 1)
    ? "over_time"
    : "instant";
}

function hasGameMissileDamage(missileRow: string[]): boolean {
  return Boolean(
    getGameRowString("Missiles", missileRow, "MinDamage") ||
    getGameRowString("Missiles", missileRow, "MaxDamage") ||
    getGameRowString("Missiles", missileRow, "EMin") ||
    getGameRowString("Missiles", missileRow, "Emax")
  );
}

function getGameSkillMissileNames(skillRow: string[]): string[] {
  const pending: string[] = [];
  const queued = new Set<string>();
  const damageMissiles: string[] = [];
  const skillDescRow = getGameSkillDescRow(skillRow);

  const queueMissile = (missileName: string) => {
    if (!missileName || queued.has(missileName)) {
      return;
    }

    queued.add(missileName);
    pending.push(missileName);
  };

  SERVER_SKILL_MISSILE_COLUMNS.forEach((columnName) => {
    queueMissile(getGameRowString("Skills", skillRow, columnName));
  });

  if (skillDescRow) {
    SKILL_DESC_MISSILE_COLUMNS.forEach((columnName) => {
      queueMissile(getGameRowString("SkillDesc", skillDescRow, columnName));
    });

    for (let index = 1; index <= 6; index += 1) {
      [
        getGameRowString("SkillDesc", skillDescRow, `desccalca${index}`),
        getGameRowString("SkillDesc", skillDescRow, `desccalcb${index}`),
      ].forEach((calc) => {
        for (const match of calc.matchAll(/miss\('([^']+)'\./g)) {
          queueMissile(match[1]);
        }
      });
    }
  }

  while (pending.length > 0) {
    const missileName = pending.shift()!;
    const missileRow = getGameRow("Missiles", missileName);
    if (!missileRow) {
      continue;
    }

    if (hasGameMissileDamage(missileRow)) {
      damageMissiles.push(missileName);
    }

    MISSILE_CHILD_COLUMNS.forEach((columnName) => {
      queueMissile(getGameRowString("Missiles", missileRow, columnName));
    });
  }

  return damageMissiles;
}

function formatGameMissileLabel(missileName: string): string {
  return missileName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getGamePoisonDurationSeconds(skillName: string): number | undefined {
  const skillRow = getGameRow("Skills", skillName);
  if (skillRow && getGameRowString("Skills", skillRow, "EType") === "pois") {
    const frames = getGameRowNumber("Skills", skillRow, "ELen");
    return frames > 0 ? frames / 25 : undefined;
  }

  if (!skillRow) {
    return undefined;
  }

  const missileDurations = getGameSkillMissileNames(skillRow)
    .map((missileName) => getGameRow("Missiles", missileName))
    .filter((missileRow): missileRow is string[] => Boolean(missileRow))
    .filter(
      (missileRow) =>
        getGameRowString("Missiles", missileRow, "EType") === "pois"
    )
    .map((missileRow) => getGameRowNumber("Missiles", missileRow, "ELen") / 25)
    .filter((duration) => duration > 0);

  return missileDurations.length > 0
    ? Math.max(...missileDurations)
    : undefined;
}

function getSkillDescElementalDamageElements(
  skillRow: string[]
): WeaponElementalDamageElement[] {
  const skillDescRow = getGameSkillDescRow(skillRow);
  if (!skillDescRow) {
    return [];
  }

  const elements: WeaponElementalDamageElement[] = [];
  for (let index = 1; index <= 6; index += 1) {
    (["a", "b"] as const).forEach((side) => {
      const textKey = getGameRowString(
        "SkillDesc",
        skillDescRow,
        `desctext${side}${index}`
      );
      const element = SKILL_DESC_ELEMENTAL_DAMAGE_TEXTS[textKey];
      if (element && !elements.includes(element)) {
        elements.push(element);
      }
    });
  }

  return elements;
}

function getGameSkillComponents(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>,
  realStats?: CharacterData["realStats"]
): DirectSkillDamage["components"] {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return [];
  }

  const components: DirectSkillDamage["components"] = [];
  const physicalRange = getGameLevelScaledRange(
    "Skills",
    skillRow,
    level,
    "MinDam",
    "MaxDam",
    ["MinLevDam1", "MinLevDam2", "MinLevDam3", "MinLevDam4", "MinLevDam5"],
    ["MaxLevDam1", "MaxLevDam2", "MaxLevDam3", "MaxLevDam4", "MaxLevDam5"]
  );
  if (physicalRange) {
    const multiplier = getGameDotMultiplier(
      "Skills",
      skillRow,
      "Physical",
      skillName,
      skillName,
      ["MaxLevDam1", "MaxLevDam2", "MaxLevDam3", "MaxLevDam4", "MaxLevDam5"]
    );
    components.push(
      createGameComponent(
        "Physical",
        "physical",
        applyGameDotMultiplier(physicalRange, multiplier),
        evaluateGameCalcExpression(
          getGameRowString("Skills", skillRow, "DmgSymPerCalc"),
          skillRow,
          skillMap
        ),
        0,
        "skill",
        [
          {
            table: "Skills.txt",
            row: getGameRowString("Skills", skillRow, "skill") || skillName,
            columns: [
              "MinDam",
              "MaxDam",
              "MinLevDam1..5",
              "MaxLevDam1..5",
              "DmgSymPerCalc",
              "HitShift",
            ],
          },
        ]
      )
    );
  }

  const eType = getGameRowString("Skills", skillRow, "EType");
  const element = GAME_ETYPES[eType];
  const elementalRange = getGameLevelScaledRange(
    "Skills",
    skillRow,
    level,
    "EMin",
    "EMax",
    ["EMinLev1", "EMinLev2", "EMinLev3", "EMinLev4", "EMinLev5"],
    ["EMaxLev1", "EMaxLev2", "EMaxLev3", "EMaxLev4", "EMaxLev5"]
  );
  if (element && elementalRange) {
    const multiplier = getGameDotMultiplier(
      "Skills",
      skillRow,
      eType,
      skillName,
      skillName,
      ["EMaxLev1", "EMaxLev2", "EMaxLev3", "EMaxLev4", "EMaxLev5"]
    );
    components.push(
      createGameComponent(
        element[0].toUpperCase() + element.slice(1),
        element,
        applyGameDotMultiplier(elementalRange, multiplier),
        evaluateGameCalcExpression(
          getGameRowString("Skills", skillRow, "EDmgSymPerCalc"),
          skillRow,
          skillMap
        ),
        getGameElementalBonusPercent(element, skillMap, realStats, skillName),
        "skill",
        [
          {
            table: "Skills.txt",
            row: getGameRowString("Skills", skillRow, "skill") || skillName,
            columns: [
              "EType",
              "EMin",
              "EMax",
              "EMinLev1..5",
              "EMaxLev1..5",
              "EDmgSymPerCalc",
              "ELen",
              "ELevLen1..3",
              "HitShift",
            ],
          },
        ],
        getGameComponentTiming(
          eType,
          multiplier,
          isGameWeaponAttackSkill(skillName)
        )
      )
    );
  }

  if (!element && elementalRange) {
    getSkillDescElementalDamageElements(skillRow).forEach((descElement) => {
      components.push(
        createGameComponent(
          descElement[0].toUpperCase() + descElement.slice(1),
          descElement,
          elementalRange,
          evaluateGameCalcExpression(
            getGameRowString("Skills", skillRow, "EDmgSymPerCalc"),
            skillRow,
            skillMap,
            level
          ),
          getGameElementalBonusPercent(
            descElement,
            skillMap,
            realStats,
            skillName
          ),
          "skill",
          [
            {
              table: "Skills.txt",
              row: getGameRowString("Skills", skillRow, "skill") || skillName,
              columns: [
                "EMin",
                "EMax",
                "EMinLev1..5",
                "EMaxLev1..5",
                "EDmgSymPerCalc",
                "HitShift",
              ],
              note: "SkillDesc maps this blank-EType payload to elemental damage display rows.",
            },
            {
              table: "SkillDesc.txt",
              row: getGameRowString("Skills", skillRow, "skilldesc"),
              columns: ["desctext*", "desccalc*"],
            },
          ]
        )
      );
    });
  }

  for (const missileName of getGameSkillMissileNames(skillRow)) {
    components.push(
      ...getGameMissileComponents(
        skillName,
        formatGameMissileLabel(missileName),
        missileName,
        level,
        skillRow,
        skillMap,
        realStats
      )
    );
  }

  return components;
}

function shouldIncludeGameMissilePhysicalDamage(
  sourceSkillName: string,
  missileName: string
): boolean {
  if (
    normalizeSkillName(sourceSkillName) ===
      normalizeSkillName("Fists of Fire") &&
    missileName === "fofmeteor"
  ) {
    return false;
  }

  return true;
}

function getGameMissileComponents(
  sourceSkillName: string,
  label: string,
  missileName: string,
  level: number,
  sourceSkillRow: string[],
  skillMap: Map<string, SkillEntry>,
  realStats?: CharacterData["realStats"]
): DirectSkillDamage["components"] {
  const missileRow = getGameRow("Missiles", missileName);
  if (!missileRow) {
    return [];
  }

  const components: DirectSkillDamage["components"] = [];
  const physicalRange = getGameLevelScaledRange(
    "Missiles",
    missileRow,
    level,
    "MinDamage",
    "MaxDamage",
    ["MinLevDam1", "MinLevDam2", "MinLevDam3", "MinLevDam4", "MinLevDam5"],
    ["MaxLevDam1", "MaxLevDam2", "MaxLevDam3", "MaxLevDam4", "MaxLevDam5"]
  );
  if (
    physicalRange &&
    shouldIncludeGameMissilePhysicalDamage(sourceSkillName, missileName)
  ) {
    const multiplier = getGameDotMultiplier(
      "Missiles",
      missileRow,
      "Physical",
      sourceSkillName,
      missileName,
      ["MaxLevDam1", "MaxLevDam2", "MaxLevDam3", "MaxLevDam4", "MaxLevDam5"]
    );
    components.push(
      createGameComponent(
        label.includes("Physical") ? label : "Physical",
        "physical",
        applyGameDotMultiplier(physicalRange, multiplier),
        evaluateGameCalcExpression(
          getGameRowString("Missiles", missileRow, "DmgSymPerCalc"),
          sourceSkillRow,
          skillMap
        ),
        0,
        "missile",
        [
          {
            table: "Missiles.txt",
            row: missileName,
            columns: [
              "MinDamage",
              "MaxDamage",
              "MinLevDam1..5",
              "MaxLevDam1..5",
              "DmgSymPerCalc",
              "SrcDamage",
              "SrcMissDmg",
              "HitShift",
            ],
          },
        ]
      )
    );
  }

  const eType = getGameRowString("Missiles", missileRow, "EType");
  const element = GAME_ETYPES[eType];
  const elementalRange = getGameLevelScaledRange(
    "Missiles",
    missileRow,
    level,
    "EMin",
    "Emax",
    ["MinELev1", "MinELev2", "MinELev3", "MinELev4", "MinELev5"],
    ["MaxELev1", "MaxELev2", "MaxELev3", "MaxELev4", "MaxELev5"]
  );
  if (element && elementalRange) {
    const multiplier = getGameDotMultiplier(
      "Missiles",
      missileRow,
      eType,
      sourceSkillName,
      missileName,
      ["MaxELev1", "MaxELev2", "MaxELev3", "MaxELev4", "MaxELev5"]
    );
    components.push(
      createGameComponent(
        label,
        element,
        applyGameDotMultiplier(elementalRange, multiplier),
        evaluateGameCalcExpression(
          getGameRowString("Missiles", missileRow, "EDmgSymPerCalc"),
          sourceSkillRow,
          skillMap
        ),
        getGameElementalBonusPercent(
          element,
          skillMap,
          realStats,
          sourceSkillName
        ),
        "missile",
        [
          {
            table: "Missiles.txt",
            row: missileName,
            columns: [
              "EType",
              "EMin",
              "Emax",
              "MinELev1..5",
              "MaxELev1..5",
              "EDmgSymPerCalc",
              "ELen",
              "ELevLen1..3",
              "DamageRate",
              "HitShift",
            ],
          },
        ],
        getGameComponentTiming(eType, multiplier)
      )
    );
  }

  return components;
}

function summarizeGameComponents(
  components: DirectSkillDamage["components"],
  skillName: string
): DirectSkillDamage {
  const physical = createEmptyDamageRange();
  const elemental: DirectSkillDamage["elemental"] = {};
  let poisonRange: DamageRange | undefined;

  for (const component of components) {
    if (component.element === "physical") {
      physical.min += component.damage.min;
      physical.max += component.damage.max;
      continue;
    }

    if (component.element === "poison") {
      poisonRange = addDamageRange(
        poisonRange || createEmptyDamageRange(),
        component.damage
      );
      continue;
    }

    elemental[component.element] = addDamageRange(
      elemental[component.element] || createEmptyDamageRange(),
      component.damage
    );
  }

  const poisonDuration = getGamePoisonDurationSeconds(skillName) || 2;

  return {
    components,
    physical,
    elemental,
    poisonRange,
    poisonDamage: poisonRange
      ? {
          total: Math.floor((poisonRange.min + poisonRange.max) / 2),
          durationSeconds: poisonDuration,
        }
      : undefined,
  };
}

function getGameDirectSkillDamage(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>,
  realStats?: CharacterData["realStats"]
): DirectSkillDamage | undefined {
  const components = getGameSkillComponents(
    skillName,
    level,
    skillMap,
    realStats
  );
  if (components.length === 0) {
    return undefined;
  }

  return summarizeGameComponents(components, skillName);
}

function getSkillMap(characterData: CharacterData): Map<string, SkillEntry> {
  const skillMap = new Map<string, SkillEntry>();

  if (characterData.realSkills && characterData.realSkills.length > 0) {
    characterData.realSkills.forEach((skill) => {
      skillMap.set(normalizeSkillName(skill.skill), {
        level: skill.level,
        baseLevel: skill.baseLevel ?? skill.level,
      });
    });
  }

  (characterData.character.skills || []).forEach((skill) => {
    const name = normalizeSkillName(skill.name);
    if (!skillMap.has(name)) {
      skillMap.set(name, {
        level: skill.level,
        baseLevel: skill.level,
      });
    }
  });

  return skillMap;
}

function getSkillEntry(
  skillMap: Map<string, SkillEntry>,
  skillName: string
): SkillEntry {
  const candidates = getEquivalentSkillNames(skillName);
  for (const candidate of candidates) {
    const entry = skillMap.get(candidate);
    if (entry) {
      return entry;
    }
  }

  const normalizedCandidates = new Set(
    candidates.map((candidate) => candidate.toLowerCase())
  );
  for (const [name, entry] of skillMap.entries()) {
    if (normalizedCandidates.has(name.toLowerCase())) {
      return entry;
    }
  }

  return {
    level: 0,
    baseLevel: 0,
  };
}

function getLogicalHandSlot(equipment?: string): "right" | "left" | undefined {
  if (!equipment) {
    return undefined;
  }

  if (equipment.includes("Right Hand")) {
    return "right";
  }

  if (equipment.includes("Left Hand")) {
    return "left";
  }

  return undefined;
}

function getWeaponSetForEquipment(equipment?: string): WeaponSet | undefined {
  if (!equipment) {
    return undefined;
  }

  if (PRIMARY_WEAPON_EQUIPMENT_SLOTS.has(equipment)) {
    return "primary";
  }

  if (SECONDARY_WEAPON_EQUIPMENT_SLOTS.has(equipment)) {
    return "secondary";
  }

  return undefined;
}

function isActiveInventoryCharm(item: IItem): boolean {
  return Boolean(
    item.base?.type_code?.toLowerCase().includes("cha") &&
      item.location?.storage === "Inventory"
  );
}

function isEquippedItem(item: IItem): boolean {
  return item.location?.zone === "Equipped";
}

function getPlayerItemsForWeaponSet(
  items: IItem[],
  weaponSet: WeaponSet
): IItem[] {
  return items.filter((item) => {
    if (isActiveInventoryCharm(item)) {
      return true;
    }

    const itemWeaponSet = getWeaponSetForEquipment(item.location?.equipment);
    return !itemWeaponSet || itemWeaponSet === weaponSet;
  });
}

function normalizeItemsForWeaponSet(
  items: IItem[],
  weaponSet: WeaponSet
): IItem[] {
  if (weaponSet === "primary") {
    return items;
  }

  return items.map((item) => {
    const equipment = item.location?.equipment;
    if (!equipment) {
      return item;
    }

    switch (equipment) {
      case "Right Hand":
        return {
          ...item,
          location: { ...item.location, equipment: "Right Hand Switch" },
        };
      case "Left Hand":
        return {
          ...item,
          location: { ...item.location, equipment: "Left Hand Switch" },
        };
      case "Right Hand Switch":
        return {
          ...item,
          location: { ...item.location, equipment: "Right Hand" },
        };
      case "Left Hand Switch":
        return {
          ...item,
          location: { ...item.location, equipment: "Left Hand" },
        };
      default:
        return item;
    }
  });
}

function buildWeaponSetContext(
  characterData: CharacterData,
  weaponSet: WeaponSet
): WeaponSetContext {
  let realStats = weaponSet === "primary" ? characterData.realStats : undefined;
  let realSkills =
    weaponSet === "primary" ? characterData.realSkills : undefined;

  if (!realStats || !realSkills) {
    const normalizedItems = normalizeItemsForWeaponSet(
      characterData.items,
      weaponSet
    );
    const normalizedCharacterData = {
      ...characterData,
      items: normalizedItems,
    } as unknown as CharacterResponse;

    if (!realStats) {
      try {
        const statParser = new CharacterStatParser(
          normalizedCharacterData as unknown as CharacterData
        );
        realStats = statParser.parseAndGetCharStats();
      } catch {
        realStats = characterData.realStats;
      }
    }

    if (!realSkills) {
      try {
        realSkills = calculateTotalSkills(normalizedCharacterData);
      } catch {
        realSkills = characterData.realSkills;
      }
    }
  }

  const setAwareCharacterData = {
    ...characterData,
    realSkills,
  } as CharacterData;
  const playerItems = getPlayerItemsForWeaponSet(
    characterData.items,
    weaponSet
  );

  return {
    weaponSet,
    realStats,
    skillMap: getSkillMap(setAwareCharacterData),
    playerItems,
    alwaysActiveAuras: dedupeAuras(
      collectAlwaysActiveAuras(playerItems, characterData.mercenary)
    ),
  };
}

function buildWeaponSetContexts(
  characterData: CharacterData
): Record<WeaponSet, WeaponSetContext> {
  return {
    primary: buildWeaponSetContext(characterData, "primary"),
    secondary: buildWeaponSetContext(characterData, "secondary"),
  };
}

function hasDamageRange(damage?: {
  minimum?: number;
  maximum?: number;
}): damage is { minimum: number; maximum: number } {
  return (
    typeof damage?.minimum === "number" &&
    typeof damage?.maximum === "number" &&
    (damage.minimum > 0 || damage.maximum > 0)
  );
}

function getDamageFromArmoryItemData(
  item: IItem
): DamageRangeWithSource | undefined {
  const itemWithPossibleKickDamage = item as IItem & {
    damage?: IItem["damage"] & {
      kick?: { minimum?: number; maximum?: number };
    };
    base?: IItem["base"] & {
      damage?: IItem["damage"] & {
        kick?: { minimum?: number; maximum?: number };
      };
    };
  };
  const damageCandidates = [
    itemWithPossibleKickDamage.base?.damage?.kick,
    itemWithPossibleKickDamage.damage?.kick,
  ];
  const damage = damageCandidates.find(hasDamageRange);
  if (!damage) {
    return undefined;
  }

  return {
    damage: normalizeItemDamageRange(damage),
    sourceRefs: [
      {
        table: "Armory item data",
        row: item.base?.name || item.name,
        columns: ["base.damage.kick", "damage.kick"],
        note: "Equipped boot kick damage enriched from Armor.txt mindam/maxdam.",
      },
    ],
  };
}

function getBootKickDamage(item: IItem): DamageRangeWithSource | undefined {
  return getDamageFromArmoryItemData(item);
}

function isEquippedBootItem(item: IItem): boolean {
  if (
    item.location?.zone !== "Equipped" ||
    item.location?.equipment !== "Boots"
  ) {
    return false;
  }

  const typeCode = item.base?.type_code?.toLowerCase();
  const typeName = item.base?.type?.toLowerCase() || "";
  return typeCode === "boot" || typeName.includes("boot");
}

function createUnarmedItem(weaponSet: WeaponSet): IItem {
  return {
    id: `unarmed-${weaponSet}`,
    hash: `unarmed-${weaponSet}`,
    name: "Unarmed",
    category: "weapon",
    base_code: "unarmed",
    base: {
      id: "unarmed",
      category: "weapon",
      codes: {},
      name: "Unarmed",
      stackable: false,
      type: "Unarmed",
      type_code: "unarmed",
      size: { height: 1, width: 1 },
      requirements: { level: 0, strength: 0, dexterity: 0 },
    },
    quality: { id: 2, name: "Normal" },
    location: {
      zone: "Equipped",
      storage: "Equipped",
      zone_id: 1,
      storage_id: 0,
      equipment: weaponSet === "primary" ? "Right Hand" : "Right Hand Switch",
      equipment_id: 0,
    },
    position: { row: 0, column: 0 },
    properties: [],
    damage: {
      one_handed: { minimum: 1, maximum: 2 },
      two_handed: {},
      missile: {},
    },
    is_identified: true,
    is_socketed: false,
    is_new: false,
    is_ear: false,
    is_starter: false,
    is_simple: true,
    is_ethereal: false,
    is_personalized: false,
    is_runeword: false,
    socketed_count: 0,
    item_level: 0,
    graphic_id: false,
    class_specifics: false,
    socket_count: 0,
    modifiers: [],
    requirements: { level: 0, strength: 0, dexterity: 0 },
    corrupted: false,
    desecrated: false,
  } as IItem;
}

function createUnarmedSelection(weaponSet: WeaponSet): WeaponSelection {
  const setLabel = weaponSet === "primary" ? "Primary" : "Secondary";
  const item = createUnarmedItem(weaponSet);
  return {
    option: {
      id: `${weaponSet}:right:unarmed`,
      label: `${setLabel} unarmed`,
      weaponSet,
      slot: "right",
      handMode: "unarmed",
      itemName: "Unarmed",
      baseName: "Unarmed",
      weaponType: "Unarmed",
    },
    item,
    damage: { min: 1, max: 2 },
    weaponSet,
    slot: "right",
  };
}

function createKickSelection(
  weaponSet: WeaponSet,
  item: IItem
): WeaponSelection {
  const setLabel = weaponSet === "primary" ? "Primary" : "Secondary";
  const key = item.hash || String(item.id);
  const baseName = item.base?.name || item.name;
  const kickDamage = getBootKickDamage(item);

  return {
    option: {
      id: `${weaponSet}:feet:kick:${key}`,
      label: `${setLabel} boots (Kick)`,
      weaponSet,
      slot: "feet",
      handMode: "kick",
      itemName: item.name,
      baseName,
      weaponType: item.base?.type || "Boots",
    },
    item,
    damage: kickDamage?.damage || createEmptyDamageRange(),
    weaponSet,
    slot: "feet",
    damageSourceRefs: kickDamage?.sourceRefs,
    baseDamageUnavailable: !kickDamage,
  };
}

function createSummonSourceItem(skillName: string): IItem {
  const id = `summon-source-${skillName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const item = createUnarmedItem("primary");
  return {
    ...item,
    id,
    hash: id,
    name: "Summon source",
    base_code: "summon-source",
    base: {
      ...item.base,
      id: "summon-source",
      name: "Summon source",
      type: "Summon",
      type_code: "summon",
    },
    damage: {
      one_handed: {},
      two_handed: {},
      missile: {},
    },
  } as IItem;
}

function createSummonSelection(skillName: string): WeaponSelection {
  const item = createSummonSourceItem(skillName);
  const key = skillName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return {
    option: {
      id: `primary:summon:${key}`,
      label: `Summon source (${skillName})`,
      weaponSet: "primary",
      slot: "summon",
      handMode: "summon",
      itemName: skillName,
      baseName: "Summon",
      weaponType: "Summon",
    },
    item,
    damage: createEmptyDamageRange(),
    weaponSet: "primary",
    slot: "summon",
    summonSkillName: skillName,
  };
}

function getSequenceHitOption(hit: WeaponSequenceHit) {
  return {
    label: hit.label,
    weaponId: hit.selection.option.id,
    weaponSet: hit.selection.weaponSet,
    slot: hit.selection.slot as "right" | "left",
    handMode: hit.selection.option.handMode as SingleWeaponHandMode,
    itemName: hit.selection.item.name,
  };
}

function createWeaponSequenceSelection(
  weaponSet: WeaponSet,
  handMode: "dual_wield" | "dual_throw",
  hits: WeaponSequenceHit[]
): WeaponSelection {
  const setLabel = weaponSet === "primary" ? "Primary" : "Secondary";
  const label =
    handMode === "dual_throw"
      ? `${setLabel} dual throw cycle`
      : `${setLabel} dual wield cycle`;
  const itemNames = hits.map((hit) => hit.selection.item.name).join(" + ");
  const idSuffix = hits.map((hit) => hit.selection.option.id).join("+");

  return {
    option: {
      id: `${weaponSet}:${handMode}:${idSuffix}`,
      label,
      weaponSet,
      slot: "right",
      handMode,
      itemName: itemNames,
      baseName: handMode === "dual_throw" ? "Thrown pair" : "Dual wield pair",
      weaponType: handMode === "dual_throw" ? "Dual throw" : "Dual wield",
      sequenceHits: hits.map(getSequenceHitOption),
    },
    item: hits[0].selection.item,
    damage: hits.reduce(
      (total, hit) => addDamageRange(total, hit.selection.damage),
      createEmptyDamageRange()
    ),
    weaponSet,
    slot: "right",
    sequenceHits: hits,
  };
}

function addWeaponSequenceSelections(
  selections: WeaponSelection[]
): WeaponSelection[] {
  const sequenceSelections: WeaponSelection[] = [];

  (["primary", "secondary"] as const).forEach((weaponSet) => {
    const setSelections = selections.filter(
      (selection) =>
        selection.weaponSet === weaponSet && !selection.sequenceHits
    );
    const rightOneHanded = setSelections.find(
      (selection) =>
        selection.slot === "right" && selection.option.handMode === "one_handed"
    );
    const leftOneHanded = setSelections.find(
      (selection) =>
        selection.slot === "left" && selection.option.handMode === "one_handed"
    );
    const rightThrown = setSelections.find(
      (selection) =>
        selection.slot === "right" && selection.option.handMode === "missile"
    );
    const leftThrown = setSelections.find(
      (selection) =>
        selection.slot === "left" && selection.option.handMode === "missile"
    );

    if (rightOneHanded && leftOneHanded) {
      sequenceSelections.push(
        createWeaponSequenceSelection(weaponSet, "dual_wield", [
          { label: "Right hand", selection: rightOneHanded },
          { label: "Left hand", selection: leftOneHanded },
        ])
      );
    }

    if (rightThrown && leftThrown) {
      sequenceSelections.push(
        createWeaponSequenceSelection(weaponSet, "dual_throw", [
          { label: "Right hand throw", selection: rightThrown },
          { label: "Left hand throw", selection: leftThrown },
        ])
      );
    }
  });

  return [...selections, ...sequenceSelections];
}

function getWeaponOptions(characterData: CharacterData): WeaponSelection[] {
  const selections: WeaponSelection[] = [];

  (["primary", "secondary"] as const).forEach((weaponSet) => {
    const setSelectionStart = selections.length;
    const items = getPlayerItemsForWeaponSet(characterData.items, weaponSet);
    const leftHandOccupied = items.some((item) => {
      const equipment = item.location?.equipment;
      return (
        item.location?.zone === "Equipped" &&
        getLogicalHandSlot(equipment) === "left" &&
        getWeaponSetForEquipment(equipment) === weaponSet &&
        item.category !== "weapon"
      );
    });

    items.forEach((item) => {
      const equipment = item.location?.equipment;
      if (
        item.location?.zone !== "Equipped" ||
        !equipment ||
        !ALL_HAND_EQUIPMENT_SLOTS.has(equipment) ||
        getWeaponSetForEquipment(equipment) !== weaponSet ||
        item.category !== "weapon"
      ) {
        return;
      }

      const slot = getLogicalHandSlot(equipment);
      if (!slot) {
        return;
      }

      const setLabel = weaponSet === "primary" ? "Primary" : "Secondary";
      const key = item.hash || String(item.id);
      const baseName = item.base?.name || item.name;
      const weaponType = item.base?.type || "Weapon";
      const isBowWeapon = isBowOrCrossbow(item);
      const missileDamage = hasDamageRange(item.damage?.missile)
        ? item.damage!.missile
        : isBowWeapon && hasDamageRange(item.damage?.two_handed)
          ? item.damage!.two_handed
          : undefined;

      if (hasDamageRange(item.damage?.one_handed)) {
        selections.push({
          option: {
            id: `${weaponSet}:${slot}:one_handed:${key}`,
            label: `${setLabel} ${slot === "right" ? "right" : "left"} hand (1H)`,
            weaponSet,
            slot,
            handMode: "one_handed",
            itemName: item.name,
            baseName,
            weaponType,
          },
          item,
          damage: normalizeItemDamageRange(item.damage!.one_handed),
          weaponSet,
          slot,
        });
      }

      if (
        (isBowWeapon || slot === "right") &&
        (isBowWeapon || !leftHandOccupied) &&
        hasDamageRange(item.damage?.two_handed)
      ) {
        selections.push({
          option: {
            id: `${weaponSet}:${slot}:two_handed:${key}`,
            label: `${setLabel} right hand (2H)`,
            weaponSet,
            slot,
            handMode: "two_handed",
            itemName: item.name,
            baseName,
            weaponType,
          },
          item,
          damage: normalizeItemDamageRange(item.damage!.two_handed),
          weaponSet,
          slot,
        });
      }

      if (missileDamage) {
        selections.push({
          option: {
            id: `${weaponSet}:${slot}:missile:${key}`,
            label: isBowWeapon
              ? `${setLabel} bow/crossbow`
              : `${setLabel} ${slot === "right" ? "right" : "left"} hand (Thrown)`,
            weaponSet,
            slot,
            handMode: "missile",
            itemName: item.name,
            baseName,
            weaponType,
          },
          item,
          damage: normalizeItemDamageRange(missileDamage),
          weaponSet,
          slot,
        });
      }
    });

    if (selections.length === setSelectionStart) {
      selections.push(createUnarmedSelection(weaponSet));
    }

    const equippedBoots = items.find(isEquippedBootItem);
    if (equippedBoots) {
      selections.push(createKickSelection(weaponSet, equippedBoots));
    }
  });

  const summonSkillNames = Array.from(getSkillMap(characterData).entries())
    .filter(
      ([skillName, entry]) =>
        entry.level > 0 && isSelectableSummonSkill(skillName)
    )
    .map(([skillName]) => skillName);
  uniqueStrings(summonSkillNames).forEach((skillName) => {
    selections.push(createSummonSelection(skillName));
  });

  return addWeaponSequenceSelections(selections);
}

function isBowOrCrossbow(item: IItem): boolean {
  const typeCode = item.base?.type_code?.toLowerCase();
  return typeCode === "bow" || typeCode === "abow" || typeCode === "xbow";
}

function isClawWeapon(item: IItem): boolean {
  const typeCode = item.base?.type_code?.toLowerCase();
  return typeCode === "h2h" || typeCode === "h2h2";
}

function isJavelinOrSpear(item: IItem): boolean {
  const typeCode = item.base?.type_code?.toLowerCase();
  const typeName = item.base?.type?.toLowerCase() || "";

  return (
    typeCode === "jave" ||
    typeCode === "spea" ||
    typeName.includes("javelin") ||
    typeName.includes("spear")
  );
}

function isHammerWeapon(item: IItem): boolean {
  const typeCode = item.base?.type_code?.toLowerCase();
  const typeName = item.base?.type?.toLowerCase() || "";
  return typeCode === "hamm" || typeName.includes("hammer");
}

function getPayloadStatBonusPercent(
  item: IItem,
  strength: number,
  dexterity: number
): number | undefined {
  const strengthBonus = item.base?.stat_bonus?.strength || 0;
  const dexterityBonus = item.base?.stat_bonus?.dexterity || 0;
  if (strengthBonus <= 0 && dexterityBonus <= 0) {
    return undefined;
  }

  return strength * (strengthBonus / 100) + dexterity * (dexterityBonus / 100);
}

function getStatBonusPercent(
  characterClass: string,
  weaponSelection: WeaponSelection,
  strength: number,
  dexterity: number
): number {
  if (weaponSelection.option.handMode === "kick") {
    return (
      getPayloadStatBonusPercent(weaponSelection.item, strength, dexterity) ??
      strength
    );
  }

  if (isBowOrCrossbow(weaponSelection.item)) {
    return dexterity;
  }

  if (isClawWeapon(weaponSelection.item)) {
    return strength * 0.75 + dexterity * 0.75;
  }

  if (
    weaponSelection.option.handMode === "missile" &&
    !isBowOrCrossbow(weaponSelection.item)
  ) {
    return strength * 0.75 + dexterity * 0.75;
  }

  if (
    characterClass.toLowerCase() === "amazon" &&
    isJavelinOrSpear(weaponSelection.item)
  ) {
    return strength * 0.8 + dexterity * 0.5;
  }

  if (isHammerWeapon(weaponSelection.item)) {
    return strength * 1.1;
  }

  return strength;
}

function parseAuraProperty(
  property: string
): { name: string; level: number } | null {
  const match = property.match(/^Level (\d+) (.+?) Aura When Equipped$/i);
  if (!match) {
    return null;
  }

  return {
    level: Number(match[1]),
    name: normalizeSkillName(match[2]),
  };
}

function isDamageAura(auraName: string): boolean {
  if (getPlayerAuraDefinition(auraName)) {
    return true;
  }

  const skillRow = getGameRow("Skills", auraName);
  return Boolean(
    skillRow &&
    (hasAnyGameStat(skillRow, SUPPORTED_AURA_DAMAGE_STATS) ||
      GAME_ETYPES[getGameRowString("Skills", skillRow, "EType")])
  );
}

function collectAlwaysActiveAuras(
  playerItems: IItem[],
  mercenary?: CharacterData["mercenary"]
): AuraSource[] {
  const auras: AuraSource[] = [];

  playerItems.forEach((item) => {
    item.properties.forEach((property) => {
      if (!property) {
        return;
      }

      const aura = parseAuraProperty(property);
      if (aura && isDamageAura(aura.name)) {
        auras.push({
          name: aura.name,
          level: aura.level,
          source: "player_item",
          carrier: "self",
        });
      }
    });
  });

  if (mercenary?.items) {
    mercenary.items.forEach((item) => {
      item.properties.forEach((property) => {
        if (!property) {
          return;
        }

        const aura = parseAuraProperty(property);
        if (aura && isDamageAura(aura.name)) {
          auras.push({
            name: aura.name,
            level: aura.level,
            source: "mercenary_item",
            carrier: "party",
          });
        }
      });
    });
  }

  return auras;
}

function summarizeAuraSource(source: AuraSource): ActiveAuraSummary {
  return {
    name: source.name,
    level: source.level,
    source: source.source,
    carrier: source.carrier,
  };
}

function getAuraSourcePriority(source: AuraSource): number {
  switch (source.source) {
    case "player_skill":
      return 4;
    case "player_item":
      return 3;
    case "mercenary_native":
      return 2;
    case "mercenary_item":
      return 1;
    case "manual":
      return 0;
  }
}

function dedupeAuras(auraSources: AuraSource[]): AuraSource[] {
  const byName = new Map<string, AuraSource>();

  auraSources.forEach((source) => {
    const current = byName.get(source.name);
    if (!current) {
      byName.set(source.name, source);
      return;
    }

    if (source.level > current.level) {
      byName.set(source.name, source);
      return;
    }

    if (
      source.level === current.level &&
      getAuraSourcePriority(source) > getAuraSourcePriority(current)
    ) {
      byName.set(source.name, source);
    }
  });

  return Array.from(byName.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function collectPlayerAuraOptions(
  contexts: Record<WeaponSet, WeaponSetContext>
): DamageAuraOption[] {
  const options: DamageAuraOption[] = [
    {
      id: "none",
      name: "No active aura",
      level: 0,
      levelOptions: [0],
      levelBonuses: [],
      selfLevelBonuses: [],
      partyLevelBonuses: [],
      source: "none",
    },
  ];

  const auraLevels = new Map<string, number>();

  Object.values(contexts).forEach((context) => {
    Array.from(context.skillMap.entries())
      .filter(
        ([skillName, entry]) => entry.level > 0 && isPlayerAuraSkill(skillName)
      )
      .forEach(([skillName, entry]) => {
        const definition = getPlayerAuraDefinition(skillName);
        const auraId = definition?.id || normalizeSkillName(skillName);
        auraLevels.set(
          auraId,
          Math.max(auraLevels.get(auraId) || 0, entry.level)
        );
      });
  });

  PLAYER_AURA_DEFINITIONS.forEach((definition) => {
    const ownedLevel = auraLevels.get(definition.id) || 0;
    const levelOptions = getManualAuraLevelOptions(definition);
    const selfLevelBonuses = levelOptions.map((level) =>
      getManualAuraLevelBonus(definition.id, level, "self")
    );
    const partyLevelBonuses = levelOptions.map((level) =>
      getManualAuraLevelBonus(definition.id, level, "party")
    );
    options.push({
      id: definition.id,
      name: definition.name,
      level: ownedLevel || 1,
      levelOptions,
      levelBonuses: selfLevelBonuses,
      selfLevelBonuses,
      partyLevelBonuses,
      source: ownedLevel > 0 ? "character_skill" : "manual",
    });
  });

  return options;
}

function collectPlayerAuraSelections(
  playerAuraOptions: DamageAuraOption[]
): AuraSelection[] {
  return playerAuraOptions.flatMap((option) =>
    option.id === "none"
      ? [{ option, carrier: "self" as const }]
      : [
          { option, carrier: "self" as const },
          { option, carrier: "party" as const },
        ]
  );
}

function isSelectableAttackSkill(skillName: string): boolean {
  return isGameWeaponAttackSkill(skillName);
}

function isSelectableSpellSkill(skillName: string): boolean {
  const resolvedSkillName =
    getEquivalentSkillNames(skillName).find((candidate) =>
      Boolean(getGameRow("Skills", candidate))
    ) || skillName;
  if (
    isPlayerAuraSkill(resolvedSkillName) ||
    isGameSummonSkill(resolvedSkillName) ||
    isGameSelfOrPartyBuffSkill(resolvedSkillName)
  ) {
    return false;
  }

  return (
    !isSelectableAttackSkill(skillName) &&
    getGameSkillComponents(resolvedSkillName, 1, new Map()).length > 0
  );
}

function collectDamageSkillOptions(
  contexts: Record<WeaponSet, WeaponSetContext>
): DamageSkillOption[] {
  const options: DamageSkillOption[] = [
    {
      id: "Basic Attack",
      name: "Basic Attack",
      level: 1,
      damageMode: "weapon",
      canUseTransformation: true,
      allowedTransformationIds: [],
    },
  ];

  const damageSkillLevels = new Map<
    string,
    {
      id: string;
      name: string;
      level: number;
      damageMode: DamageSkillOption["damageMode"];
      sourceSkillName?: string;
      summonVariant?: string;
      chargeVariant?: DamageSkillOption["chargeVariant"];
      chargeNumber?: number;
      chargeCount?: number;
      defaultChargeNumber?: number;
      chargeLabel?: string;
      canUseTransformation: boolean;
      allowedTransformationIds: string[];
    }
  >();

  Object.values(contexts).forEach((context) => {
    Array.from(context.skillMap.entries())
      .filter(
        ([skillName, entry]) =>
          entry.level > 0 &&
          (isSelectableAttackSkill(skillName) ||
            isSelectableSpellSkill(skillName) ||
            isSelectableSummonSkill(skillName))
      )
      .forEach(([skillName, entry]) => {
        const damageMode = isSelectableAttackSkill(skillName)
          ? "weapon"
          : isSelectableSummonSkill(skillName)
            ? "summon"
            : "spell";
        const chargeDefinition =
          damageMode === "weapon"
            ? getMartialArtsChargeDefinition(skillName)
            : undefined;
        const chargeSourceSkillName = chargeDefinition?.sourceSkillName;
        const chargeCount =
          chargeDefinition && chargeSourceSkillName
            ? getChargeCountForDefinition(
                chargeDefinition,
                chargeSourceSkillName,
                entry.level,
                context.skillMap
              )
            : undefined;
        const optionSources =
          chargeDefinition && chargeCount
            ? [
                {
                  id: skillName,
                  name: skillName,
                  sourceSkillName:
                    chargeDefinition.sourceSkillName === skillName
                      ? undefined
                      : chargeDefinition.sourceSkillName,
                  summonVariant: undefined,
                  chargeVariant: undefined,
                  chargeNumber: undefined,
                  chargeCount,
                  defaultChargeNumber: chargeCount,
                  chargeLabel: chargeDefinition.chargeLabel || "Charge",
                },
              ]
            : damageMode === "summon" &&
                getSummonVariantDefinitions(skillName).length > 0
              ? getSummonVariantDefinitions(skillName).map((variant) => ({
                  id: `${skillName}::${variant.id}`,
                  name: `${skillName} (${variant.label})`,
                  sourceSkillName: skillName,
                  summonVariant: variant.id,
                  chargeVariant: undefined,
                  chargeNumber: undefined,
                  chargeCount: undefined,
                  defaultChargeNumber: undefined,
                  chargeLabel: undefined,
                }))
              : [
                  {
                    id: skillName,
                    name: skillName,
                    sourceSkillName: undefined,
                    summonVariant: undefined,
                    chargeVariant: undefined,
                    chargeNumber: undefined,
                    chargeCount: undefined,
                    defaultChargeNumber: undefined,
                    chargeLabel: undefined,
                  },
                ];

        optionSources.forEach((source) => {
          const current = damageSkillLevels.get(source.id);
          const allowedTransformationIds = Array.from(
            new Set([
              ...(current?.allowedTransformationIds || []),
              ...getSkillAllowedTransformationIds(skillName),
            ])
          );

          damageSkillLevels.set(source.id, {
            id: source.id,
            name: source.name,
            sourceSkillName: source.sourceSkillName,
            summonVariant: source.summonVariant,
            chargeVariant: source.chargeVariant,
            chargeNumber: source.chargeNumber,
            chargeCount: Math.max(
              current?.chargeCount || 0,
              source.chargeCount || 0
            ),
            defaultChargeNumber: Math.max(
              current?.defaultChargeNumber || 0,
              source.defaultChargeNumber || 0
            ),
            chargeLabel: source.chargeLabel || current?.chargeLabel,
            damageMode,
            canUseTransformation:
              Boolean(current?.canUseTransformation) ||
              allowedTransformationIds.length > 0,
            allowedTransformationIds,
            level: Math.max(current?.level || 0, entry.level),
          });
        });
      });
  });

  Array.from(damageSkillLevels.entries())
    .sort(
      (left, right) =>
        right[1].level - left[1].level ||
        left[1].name.localeCompare(right[1].name)
    )
    .forEach(([, metadata]) => {
      options.push({
        id: metadata.id,
        name: metadata.name,
        level: metadata.level,
        damageMode: metadata.damageMode,
        sourceSkillName: metadata.sourceSkillName,
        summonVariant: metadata.summonVariant,
        chargeVariant: metadata.chargeVariant,
        chargeNumber: metadata.chargeNumber,
        chargeCount: metadata.chargeCount || undefined,
        defaultChargeNumber: metadata.defaultChargeNumber || undefined,
        chargeLabel: metadata.chargeLabel,
        canUseTransformation: metadata.canUseTransformation,
        allowedTransformationIds: metadata.allowedTransformationIds,
      });
    });

  return options;
}

function collectTransformationOptions(
  contexts: Record<WeaponSet, WeaponSetContext>
): DamageTransformationOption[] {
  const getLevelOptions = (gameSkillName: string) =>
    Array.from(
      { length: getMaxModeledSkillLevel(gameSkillName) },
      (_, index) => index + 1
    );
  const getLevelBonuses = (gameSkillName: string, levels: number[]) =>
    levels.map((level) => ({
      level,
      physicalBonusPercent: getTransformationDamagePercent(
        gameSkillName,
        level
      ),
    }));
  const getTransformationLevel = (
    definition: (typeof TRANSFORMATION_SKILL_DEFINITIONS)[number]
  ) =>
    Math.max(
      1,
      ...Object.values(contexts).map(
        (context) =>
          getSkillEntry(context.skillMap, definition.id).level ||
          getGameSkillEntry(context.skillMap, definition.gameSkillName).level
      )
    );

  const options: DamageTransformationOption[] = [
    {
      id: "none",
      name: "No transformation",
      level: 0,
      levelOptions: [0],
      levelBonuses: [{ level: 0, physicalBonusPercent: 0 }],
    },
  ];

  TRANSFORMATION_SKILL_DEFINITIONS.forEach((definition) => {
    const levelOptions = getLevelOptions(definition.gameSkillName);
    options.push({
      id: definition.id,
      name: definition.name,
      level: getTransformationLevel(definition),
      levelOptions,
      levelBonuses: getLevelBonuses(definition.gameSkillName, levelOptions),
    });
  });

  return options;
}

function createEmptyDamageRange(): DamageRange {
  return { min: 0, max: 0 };
}

function createEmptyDirectSkillDamage(): DirectSkillDamage {
  return {
    components: [],
    physical: createEmptyDamageRange(),
    elemental: {},
  };
}

function normalizeDamageRange(range: DamageRange): DamageRange {
  return {
    min: Math.max(0, range.min),
    max: Math.max(Math.max(0, range.min), range.max),
  };
}

function normalizeItemDamageRange(damage: {
  minimum: number;
  maximum: number;
}): DamageRange {
  return normalizeDamageRange({
    min: damage.minimum,
    max: damage.maximum,
  });
}

function addDamageRange(
  target: DamageRange,
  addition?: DamageRange
): DamageRange {
  if (!addition) {
    return target;
  }

  return {
    min: target.min + addition.min,
    max: target.max + addition.max,
  };
}

function addPoisonDamage(
  current: PoisonDamage | undefined,
  addition: PoisonDamage | undefined
): PoisonDamage | undefined {
  if (!addition) {
    return current;
  }

  if (!current) {
    return addition;
  }

  return {
    total: current.total + addition.total,
    durationSeconds: Math.max(
      current.durationSeconds,
      addition.durationSeconds
    ),
  };
}

function isNonZeroDamageRange(range?: DamageRange): range is DamageRange {
  return Boolean(range && (range.min > 0 || range.max > 0));
}

function averageDamageRange(range: DamageRange): number {
  return Number(((range.min + range.max) / 2).toFixed(1));
}

function getCombinedDamageScore(
  profile: DamageProfile
): [number, number, number] {
  const combinedDamage = profile.damageTotals.combinedDamage;
  const averageCombinedDamage = Number.isFinite(
    profile.damageTotals.averageCombinedDamage
  )
    ? profile.damageTotals.averageCombinedDamage
    : averageDamageRange(combinedDamage);

  return [averageCombinedDamage, combinedDamage.max, combinedDamage.min];
}

function hasHigherCombinedDamage(
  profile: DamageProfile,
  currentBest: DamageProfile
): boolean {
  const profileScore = getCombinedDamageScore(profile);
  const currentBestScore = getCombinedDamageScore(currentBest);

  for (let index = 0; index < profileScore.length; index += 1) {
    if (profileScore[index] !== currentBestScore[index]) {
      return profileScore[index] > currentBestScore[index];
    }
  }

  return false;
}

function getDefaultDamageProfile(
  profiles: DamageProfile[]
): DamageProfile | null {
  const noManualAuraProfiles = profiles.filter(
    (profile) =>
      profile.playerAuraId === "none" &&
      profile.playerAuraCarrier === "self" &&
      profile.transformationId === "none"
  );
  const candidates =
    noManualAuraProfiles.length > 0 ? noManualAuraProfiles : profiles;

  return candidates.reduce<DamageProfile | null>(
    (bestProfile, profile) =>
      !bestProfile || hasHigherCombinedDamage(profile, bestProfile)
        ? profile
        : bestProfile,
    null
  );
}

function getDefaultTransformationSelection(
  skillOption: DamageSkillOption | undefined,
  transformationOptions: DamageTransformationOption[],
  fallbackTransformationId: string
): string {
  const requiredTransformation = skillOption?.allowedTransformationIds
    .map((transformationId) =>
      transformationOptions.find((option) => option.id === transformationId)
    )
    .find((option): option is DamageTransformationOption =>
      Boolean(option && option.id !== "none")
    );

  if (!requiredTransformation) {
    return fallbackTransformationId;
  }

  const level =
    requiredTransformation.level ||
    requiredTransformation.levelOptions.find(
      (optionLevel) => optionLevel > 0
    ) ||
    1;

  return `${requiredTransformation.id}:${level}`;
}

function floorScaleDamageRange(
  range: DamageRange,
  multiplier: number
): DamageRange {
  return normalizeDamageRange({
    min: Math.floor(range.min * multiplier),
    max: Math.floor(range.max * multiplier),
  });
}

function createDamageComponent(component: {
  id: string;
  label: string;
  source: DamageComponent["source"];
  damageType: DamageElement;
  timing?: DamageComponent["timing"];
  damage: DamageRange;
  baseDamage?: DamageRange;
  poisonDamage?: PoisonDamage;
  includedInTotal?: boolean;
  sourceRefs?: DamageSourceReference[];
  notes?: string[];
}): DamageComponent {
  return {
    id: component.id,
    label: component.label,
    source: component.source,
    damageType: component.damageType,
    timing: component.timing || "instant",
    damage: normalizeDamageRange(component.damage),
    baseDamage: component.baseDamage
      ? normalizeDamageRange(component.baseDamage)
      : undefined,
    poisonDamage: component.poisonDamage,
    includedInTotal: component.includedInTotal,
    sourceRefs: component.sourceRefs || [],
    notes: component.notes || [],
  };
}

function scalePhysicalDamageComponent(
  component: DamageComponent,
  multiplier: number
): DamageComponent {
  return {
    ...component,
    baseDamage: component.baseDamage || component.damage,
    damage: floorScaleDamageRange(
      component.baseDamage || component.damage,
      multiplier
    ),
  };
}

function sumDamageComponents(
  components: readonly DamageComponent[],
  filter: (component: DamageComponent) => boolean
): DamageRange {
  return components
    .filter(filter)
    .reduce(
      (total, component) => addDamageRange(total, component.damage),
      createEmptyDamageRange()
    );
}

function buildDamageTotals(
  components: readonly DamageComponent[]
): DamageTotals {
  const includedComponents = components.filter(
    (component) => component.includedInTotal !== false
  );
  const byElement: Partial<Record<DamageElement, DamageRange>> = {};
  let poisonDamage: PoisonDamage | undefined;

  includedComponents.forEach((component) => {
    if (!isNonZeroDamageRange(component.damage)) {
      return;
    }

    byElement[component.damageType] = addDamageRange(
      byElement[component.damageType] || createEmptyDamageRange(),
      component.damage
    );

    if (component.damageType === "poison") {
      poisonDamage = addPoisonDamage(
        poisonDamage,
        component.poisonDamage || {
          total: Math.floor(averageDamageRange(component.damage)),
          durationSeconds: 0,
        }
      );
    }
  });

  const instantDamage = sumDamageComponents(
    includedComponents,
    (component) => component.timing === "instant"
  );
  const overTimeDamage = sumDamageComponents(
    includedComponents,
    (component) => component.timing === "over_time"
  );
  const combinedDamage = addDamageRange(instantDamage, overTimeDamage);

  return {
    instantDamage,
    overTimeDamage,
    combinedDamage,
    averageInstantDamage: averageDamageRange(instantDamage),
    averageCombinedDamage: averageDamageRange(combinedDamage),
    byElement,
    poisonDamage,
  };
}

function elementalDamageFromTotals(
  totals: DamageTotals
): Partial<Record<"fire" | "cold" | "lightning" | "magic", DamageRange>> {
  const elemental: Partial<
    Record<"fire" | "cold" | "lightning" | "magic", DamageRange>
  > = {};
  (["fire", "cold", "lightning", "magic"] as const).forEach((element) => {
    const range = totals.byElement[element];
    if (isNonZeroDamageRange(range)) {
      elemental[element] = range;
    }
  });
  return elemental;
}

function directSkillDamageToComponents(
  skillName: string,
  directDamage: DirectSkillDamage
): DamageComponent[] {
  const poisonDuration = getGamePoisonDurationSeconds(skillName) || 0;
  return directDamage.components
    .map((component, index) => {
      const damageComponent = createDamageComponent({
        id: `${component.source}:${skillName}:${index}:${component.element}:${component.label}`,
        label:
          component.source === "missile"
            ? `Missile: ${component.label}`
            : `Skill: ${component.label}`,
        source: component.source,
        damageType: component.element,
        timing: component.timing,
        damage: component.damage,
        poisonDamage:
          component.element === "poison"
            ? {
                total: Math.floor(averageDamageRange(component.damage)),
                durationSeconds: poisonDuration,
              }
            : undefined,
        sourceRefs: component.sourceRefs,
        notes: component.notes,
      });
      return damageComponent;
    })
    .filter((component) => isNonZeroDamageRange(component.damage));
}

function getDamageComponentSourceRows(component: DamageComponent): string[] {
  return component.sourceRefs
    .map((sourceRef) => sourceRef.row)
    .filter((row): row is string => Boolean(row));
}

function getChargeNumberForDamageComponent(
  component: DamageComponent,
  definition: MartialArtsChargeDefinition,
  sourceSkillName: string
): number | undefined {
  const sourceRows = getDamageComponentSourceRows(component);
  if (
    component.source === "skill" &&
    definition.skillComponentCharge &&
    sourceRows.some(
      (row) =>
        normalizeSkillName(row).toLowerCase() ===
        normalizeSkillName(sourceSkillName).toLowerCase()
    )
  ) {
    return definition.skillComponentCharge;
  }

  const matchingCharge = Object.entries(definition.missileRowsByCharge).find(
    ([, missileRows]) =>
      sourceRows.some((row) =>
        missileRows.some(
          (missileRow) => row.toLowerCase() === missileRow.toLowerCase()
        )
      )
  );

  return matchingCharge ? Number(matchingCharge[0]) : undefined;
}

function getChargeVariantDamageComponents(
  skillOption: DamageSkillOption,
  sourceSkillName: string,
  components: DamageComponent[]
): DamageComponent[] {
  const definition = getMartialArtsChargeDefinition(sourceSkillName);
  if (
    !definition ||
    skillOption.chargeVariant !== "charge" ||
    !skillOption.chargeNumber
  ) {
    return components;
  }

  return components.filter((component) => {
    const componentCharge = getChargeNumberForDamageComponent(
      component,
      definition,
      sourceSkillName
    );
    return Boolean(
      componentCharge && componentCharge <= skillOption.chargeNumber!
    );
  });
}

function directSummonDamageToComponents(
  ownerSkillName: string,
  sourceSkillName: string,
  directDamage: DirectSkillDamage,
  labelPrefix: string,
  extraSourceRefs: DamageSourceReference[] = []
): DamageComponent[] {
  const poisonDuration = getGamePoisonDurationSeconds(sourceSkillName) || 0;
  return directDamage.components
    .map((component, index) =>
      createDamageComponent({
        id: `summon:${ownerSkillName}:${sourceSkillName}:${index}:${component.element}:${component.label}`,
        label: `${labelPrefix}: ${component.label}`,
        source: "summon",
        damageType: component.element,
        timing: component.timing,
        damage: component.damage,
        baseDamage:
          component.element === "physical" ? component.damage : undefined,
        poisonDamage:
          component.element === "poison"
            ? {
                total: Math.floor(averageDamageRange(component.damage)),
                durationSeconds: poisonDuration,
              }
            : undefined,
        sourceRefs: [...extraSourceRefs, ...component.sourceRefs],
        notes: component.notes,
      })
    )
    .filter((component) => isNonZeroDamageRange(component.damage));
}

const MONSTER_ATTACK_MODE_COLUMNS = {
  A1: ["A1MinD", "A1MaxD"],
  A2: ["A2MinD", "A2MaxD"],
  S1: ["S1MinD", "S1MaxD"],
} as const;

type MonsterAttackMode = keyof typeof MONSTER_ATTACK_MODE_COLUMNS;

function getMonsterAttackRange(
  monsterRow: string[],
  mode: MonsterAttackMode
): DamageRange | undefined {
  const [minColumn, maxColumn] = MONSTER_ATTACK_MODE_COLUMNS[mode];
  const minValue = getGameRowString("MonStats", monsterRow, minColumn);
  const maxValue = getGameRowString("MonStats", monsterRow, maxColumn);
  if (!minValue && !maxValue) {
    return undefined;
  }

  return normalizeDamageRange({
    min: getGameRowNumber("MonStats", monsterRow, minColumn),
    max: getGameRowNumber("MonStats", monsterRow, maxColumn),
  });
}

function getSummonMonsterRow(skillRow: string[]): string[] | undefined {
  const summonId = getGameRowString("Skills", skillRow, "summon");
  return summonId ? getOptionalGameRow("MonStats", summonId) : undefined;
}

function getSummonedSkillNames(skillRow: string[]): string[] {
  const names: string[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const name = getGameRowString("Skills", skillRow, `sumskill${index}`);
    if (name) {
      names.push(name);
    }
  }

  return names;
}

function getMonsterSkillNames(monsterRow: string[] | undefined): Set<string> {
  const names = new Set<string>();
  if (!monsterRow) {
    return names;
  }

  for (let index = 1; index <= 8; index += 1) {
    const name = getGameRowString("MonStats", monsterRow, `Skill${index}`);
    if (name) {
      names.add(name.toLowerCase());
    }
  }

  return names;
}

function getPreferredMonsterAttackMode(
  monsterRow: string[],
  summonedSkillNames: string[]
): MonsterAttackMode | undefined {
  const summonedNames = new Set(
    summonedSkillNames.map((name) => name.toLowerCase())
  );

  for (let index = 1; index <= 8; index += 1) {
    const monsterSkillName = getGameRowString(
      "MonStats",
      monsterRow,
      `Skill${index}`
    );
    const mode = getGameRowString(
      "MonStats",
      monsterRow,
      `Sk${index}mode`
    ).toUpperCase() as MonsterAttackMode;
    if (
      summonedNames.has(monsterSkillName.toLowerCase()) &&
      mode in MONSTER_ATTACK_MODE_COLUMNS &&
      isNonZeroDamageRange(getMonsterAttackRange(monsterRow, mode))
    ) {
      return mode;
    }
  }

  return (Object.keys(MONSTER_ATTACK_MODE_COLUMNS) as MonsterAttackMode[]).find(
    (mode) => isNonZeroDamageRange(getMonsterAttackRange(monsterRow, mode))
  );
}

function getSummonMonsterAttackComponent(
  skillName: string,
  skillRow: string[],
  monsterRow: string[],
  summonedSkillNames: string[],
  hasDirectPhysicalDamage: boolean
): DamageComponent | undefined {
  if (hasDirectPhysicalDamage) {
    return undefined;
  }

  const mode = getPreferredMonsterAttackMode(monsterRow, summonedSkillNames);
  if (!mode) {
    return undefined;
  }

  const range = getMonsterAttackRange(monsterRow, mode);
  if (!isNonZeroDamageRange(range)) {
    return undefined;
  }

  const monsterId = getGameRowString("MonStats", monsterRow, "Id");
  const [minColumn, maxColumn] = MONSTER_ATTACK_MODE_COLUMNS[mode];
  return createDamageComponent({
    id: `monster:${skillName}:${monsterId}:${mode}`,
    label: `Summon ${mode} attack`,
    source: "monster",
    damageType: "physical",
    damage: range,
    baseDamage: range,
    sourceRefs: [
      {
        table: "Skills.txt",
        row: getGameRowString("Skills", skillRow, "skill") || skillName,
        columns: ["summon", "pettype", "sumskill*", "sumsk*calc"],
      },
      {
        table: "MonStats.txt",
        row: monsterId,
        columns: [minColumn, maxColumn, `Skill1..Skill8`, `Sk1mode..Sk8mode`],
        note: "Mode-linked monster attack damage is treated as the primary modeled summon hit; alternate monster modes are not summed.",
      },
    ],
  });
}

function getSummonedSkillLevel(
  skillRow: string[],
  skillMap: Map<string, SkillEntry>,
  ownerLevel: number,
  index: number
): number {
  const calc = getGameRowString("Skills", skillRow, `sumsk${index}calc`);
  const calculated = evaluateGameCalcExpression(
    calc,
    skillRow,
    skillMap,
    ownerLevel
  );

  return Math.max(1, calculated || ownerLevel);
}

function getSummonedSkillComponents(
  ownerSkillName: string,
  skillRow: string[],
  ownerLevel: number,
  skillMap: Map<string, SkillEntry>,
  realStats: CharacterData["realStats"] | undefined,
  allowedSummonedSkillNames: Set<string>
): DamageComponent[] {
  const components: DamageComponent[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const summonedSkillName = getGameRowString(
      "Skills",
      skillRow,
      `sumskill${index}`
    );
    if (!summonedSkillName) {
      continue;
    }
    const isMonsterListedSkill = allowedSummonedSkillNames.has(
      summonedSkillName.toLowerCase()
    );
    if (!isMonsterListedSkill) {
      continue;
    }

    const summonedLevel = getSummonedSkillLevel(
      skillRow,
      skillMap,
      ownerLevel,
      index
    );
    const directDamage = getGameDirectSkillDamage(
      summonedSkillName,
      summonedLevel,
      skillMap,
      realStats
    );
    if (!directDamage) {
      continue;
    }

    components.push(
      ...directSummonDamageToComponents(
        ownerSkillName,
        summonedSkillName,
        directDamage,
        `Summoned skill (${summonedSkillName} lvl ${summonedLevel})`,
        [
          {
            table: "Skills.txt",
            row:
              getGameRowString("Skills", skillRow, "skill") || ownerSkillName,
            columns: [`sumskill${index}`, `sumsk${index}calc`],
          },
        ]
      )
    );
  }

  return components;
}

function getSummonFlatPhysicalComponents(
  skillName: string,
  skillRow: string[],
  level: number,
  skillMap: Map<string, SkillEntry>
): DamageComponent[] {
  const components: DamageComponent[] = [];

  (["aura", "passive"] as const).forEach((prefix) => {
    const maxIndex = prefix === "aura" ? 6 : 5;
    for (let index = 1; index <= maxIndex; index += 1) {
      const stat = getGameRowString(
        "Skills",
        skillRow,
        `${prefix}stat${index}`
      );
      if (stat !== "item_normaldamage") {
        continue;
      }

      const damage = evaluateGameCalcExpression(
        getGameRowString(
          "Skills",
          skillRow,
          getGameStatCalcColumn(prefix, index)
        ),
        skillRow,
        skillMap,
        level
      );
      if (damage <= 0) {
        continue;
      }

      components.push(
        createDamageComponent({
          id: `summon-flat-physical:${skillName}:${prefix}${index}`,
          label: "Summon flat physical",
          source: "skill",
          damageType: "physical",
          damage: { min: damage, max: damage },
          baseDamage: { min: damage, max: damage },
          sourceRefs: [
            {
              table: "Skills.txt",
              row: getGameRowString("Skills", skillRow, "skill") || skillName,
              columns: [
                `${prefix}stat${index}`,
                getGameStatCalcColumn(prefix, index),
              ],
              note: "item_normaldamage is modeled as flat physical damage on the summoned unit before summon damage percent scaling.",
            },
          ],
        })
      );
    }
  });

  return components;
}

function getSummonDamageComponents(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>,
  realStats?: CharacterData["realStats"],
  variantId?: string
): DamageComponent[] {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return [];
  }

  const variantDefinition = getSummonVariantDefinition(skillName, variantId);
  const directDamage = getGameDirectSkillDamage(
    skillName,
    level,
    skillMap,
    realStats
  );
  const variantDirectDamage =
    directDamage && variantDefinition
      ? {
          ...directDamage,
          components: directDamage.components.filter((component) =>
            variantDefinition.componentLabels.includes(component.label)
          ),
        }
      : directDamage;
  const directComponents = variantDirectDamage
    ? directSummonDamageToComponents(
        skillName,
        skillName,
        variantDirectDamage,
        variantDefinition
          ? `${variantDefinition.label} payload`
          : "Summon payload",
        variantDefinition
          ? [
              {
                table: "Skills.txt",
                row: getGameRowString("Skills", skillRow, "skill") || skillName,
                columns: ["skilldesc", "summon", "pettype"],
                note: "Summon variant payload selected from SkillDesc.txt missile references instead of summing all mage variants.",
              },
            ]
          : []
      )
    : [];
  const flatPhysicalComponents = getSummonFlatPhysicalComponents(
    skillName,
    skillRow,
    level,
    skillMap
  );
  const summonedSkillNames = getSummonedSkillNames(skillRow);
  const monsterRow = getSummonMonsterRow(skillRow);
  const includeSummonedSkills =
    variantDefinition?.includeSummonedSkills ?? !variantDefinition;
  const includeMonsterAttack =
    variantDefinition?.includeMonsterAttack ?? !variantDefinition;
  const summonedSkillComponents = includeSummonedSkills
    ? getSummonedSkillComponents(
        skillName,
        skillRow,
        level,
        skillMap,
        realStats,
        getMonsterSkillNames(monsterRow)
      )
    : [];
  const monsterComponent =
    monsterRow && includeMonsterAttack
      ? getSummonMonsterAttackComponent(
          skillName,
          skillRow,
          monsterRow,
          summonedSkillNames,
          directComponents.some(
            (component) => component.damageType === "physical"
          )
        )
      : undefined;

  return [
    ...directComponents,
    ...flatPhysicalComponents,
    ...(monsterComponent ? [monsterComponent] : []),
    ...summonedSkillComponents,
  ].filter((component) => isNonZeroDamageRange(component.damage));
}

function getSummonDamagePercent(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>
): number {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return 0;
  }

  let total = 0;
  (["aura", "passive"] as const).forEach((prefix) => {
    const maxIndex = prefix === "aura" ? 6 : 5;
    for (let index = 1; index <= maxIndex; index += 1) {
      if (
        getGameRowString("Skills", skillRow, `${prefix}stat${index}`) !==
        "damagepercent"
      ) {
        continue;
      }

      total += evaluateGameCalcExpression(
        getGameRowString(
          "Skills",
          skillRow,
          getGameStatCalcColumn(prefix, index)
        ),
        skillRow,
        skillMap,
        level
      );
    }
  });

  return total;
}

function componentReferencesSkillDamageSynergy(
  component: DamageComponent,
  skillName: string
): boolean {
  const normalizedSkillName = normalizeSkillName(skillName).toLowerCase();
  return component.sourceRefs.some((ref) => {
    if (
      ref.table !== "Skills.txt" ||
      normalizeSkillName(ref.row || "").toLowerCase() !== normalizedSkillName
    ) {
      return false;
    }

    return ref.columns.some((column) => column === "DmgSymPerCalc");
  });
}

function getDuplicateDirectSummonDamagePercent(
  component: DamageComponent,
  skillName: string,
  skillRow: string[] | undefined,
  level: number,
  skillMap: Map<string, SkillEntry>
): number {
  if (
    component.damageType !== "physical" ||
    !skillRow ||
    !componentReferencesSkillDamageSynergy(component, skillName)
  ) {
    return 0;
  }

  const damageSynergyFormula = normalizeGameCalcFormula(
    getGameRowString("Skills", skillRow, "DmgSymPerCalc")
  );
  if (!damageSynergyFormula) {
    return 0;
  }

  let total = 0;
  (["aura", "passive"] as const).forEach((prefix) => {
    const maxIndex = prefix === "aura" ? 6 : 5;
    for (let index = 1; index <= maxIndex; index += 1) {
      if (
        getGameRowString("Skills", skillRow, `${prefix}stat${index}`) !==
        "damagepercent"
      ) {
        continue;
      }

      const expression = getGameRowString(
        "Skills",
        skillRow,
        getGameStatCalcColumn(prefix, index)
      );
      if (normalizeGameCalcFormula(expression) !== damageSynergyFormula) {
        continue;
      }

      total += evaluateGameCalcExpression(
        expression,
        skillRow,
        skillMap,
        level
      );
    }
  });

  return total;
}

function getElementalSkillDamageBonusPercent(
  element: Exclude<
    keyof NonNullable<DamageProfile["totalElementalDamage"]>,
    ""
  >,
  realStats?: CharacterData["realStats"]
): number {
  if (!realStats) {
    return 0;
  }

  switch (element) {
    case "fire":
      return realStats.fireSkillDamage ?? 0;
    case "cold":
      return realStats.coldSkillDamage ?? 0;
    case "lightning":
      return realStats.lightningSkillDamage ?? 0;
    case "magic":
      return 0;
    default:
      return 0;
  }
}

function getElementalMasteryDamageBonusPercent(
  element: "fire" | "cold" | "lightning",
  skillMap: Map<string, SkillEntry>
): number {
  const gamePassiveStat = {
    fire: "passive_fire_mastery",
    cold: "passive_cold_mastery",
    lightning: "passive_ltng_mastery",
  }[element];
  const gameValue = getGamePassiveStatValue(gamePassiveStat, skillMap);
  return gameValue || 0;
}

function getGameElementalMasteryStatName(
  element: "fire" | "cold" | "lightning" | "poison"
): string {
  return {
    fire: "passive_fire_mastery",
    cold: "passive_cold_mastery",
    lightning: "passive_ltng_mastery",
    poison: "passive_pois_mastery",
  }[element];
}

function getLocalElementalMasteryDamageBonusPercent(
  element: "fire" | "cold" | "lightning" | "poison",
  skillName: string,
  skillMap: Map<string, SkillEntry>
): number | undefined {
  const gamePassiveStat = getGameElementalMasteryStatName(element);
  const localAuraValue = getGameSkillAuraStatValue(
    skillName,
    [gamePassiveStat],
    skillMap
  );
  if (localAuraValue !== undefined) {
    return localAuraValue;
  }

  return getGameSkillPassiveStatValue(skillName, [gamePassiveStat], skillMap);
}

function getPoisonSkillDamageBonusPercent(
  realStats?: CharacterData["realStats"]
): number {
  return realStats?.poisonSkillDamage || 0;
}

function scaleDamageRange(range: DamageRange, percent: number): DamageRange {
  return {
    min: Math.floor(range.min * (1 + percent / 100)),
    max: Math.floor(range.max * (1 + percent / 100)),
  };
}

function getSkillSynergyBonuses(
  skillName: string,
  skillMap: Map<string, SkillEntry>
): SkillSynergyBonuses {
  const bonuses: SkillSynergyBonuses = {
    physicalPct: 0,
    firePct: 0,
    coldPct: 0,
    lightningPct: 0,
    magicPct: 0,
    poisonPct: 0,
  };

  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return bonuses;
  }

  const elementalSynergyPercent = evaluateGameCalcExpression(
    getGameRowString("Skills", skillRow, "EDmgSymPerCalc"),
    skillRow,
    skillMap,
    getGameSkillEntry(skillMap, skillName).level
  );
  const element = GAME_ETYPES[getGameRowString("Skills", skillRow, "EType")];

  if (element === "fire") {
    bonuses.firePct = elementalSynergyPercent;
  } else if (element === "cold") {
    bonuses.coldPct = elementalSynergyPercent;
  } else if (element === "lightning") {
    bonuses.lightningPct = elementalSynergyPercent;
  } else if (element === "magic") {
    bonuses.magicPct = elementalSynergyPercent;
  } else if (element === "poison") {
    bonuses.poisonPct = elementalSynergyPercent;
  }

  // Direct physical payload synergies are applied when damage components are
  // built from DmgSymPerCalc. Returning them here would apply them again to
  // weapon-source damage, so physicalPct remains reserved for future verified
  // weapon-source synergy behavior.
  return bonuses;
}

function getDirectPhysicalSkillSynergyPercent(
  skillName: string,
  skillMap: Map<string, SkillEntry>
): number {
  const skillRow = getGameRow("Skills", skillName);
  if (
    !skillRow ||
    !getGameRowString("Skills", skillRow, "DmgSymPerCalc") ||
    (!getGameRowString("Skills", skillRow, "MinDam") &&
      !getGameRowString("Skills", skillRow, "MaxDam"))
  ) {
    return 0;
  }

  return evaluateGameCalcExpression(
    getGameRowString("Skills", skillRow, "DmgSymPerCalc"),
    skillRow,
    skillMap,
    getGameSkillEntry(skillMap, skillName).level
  );
}

function getDirectSkillDamage(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>,
  realStats?: CharacterData["realStats"]
): DirectSkillDamage {
  const gameDirectDamage = getGameDirectSkillDamage(
    skillName,
    level,
    skillMap,
    realStats
  );
  if (gameDirectDamage) {
    return gameDirectDamage;
  }

  return createEmptyDirectSkillDamage();
}

function getWeaponElementalDamagePercentComponents(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>
): WeaponElementalDamagePercentComponent[] {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return [];
  }

  const components: WeaponElementalDamagePercentComponent[] = [];
  for (let index = 1; index <= 4; index += 1) {
    const descColumn = `*calc${index} desc`;
    const calcColumn = `calc${index}`;
    const description = getGameRowString(
      "Skills",
      skillRow,
      descColumn
    )
      .trim()
      .toLowerCase();
    const element = WEAPON_ELEMENTAL_DAMAGE_CALC_DESCRIPTIONS[description];
    if (!element) {
      continue;
    }

    const percent = evaluateGameCalcExpression(
      getGameRowString("Skills", skillRow, calcColumn),
      skillRow,
      skillMap,
      level
    );
    if (percent <= 0) {
      continue;
    }

    components.push({
      element,
      percent,
      calcColumn,
      descColumn,
    });
  }

  return components;
}

function getSummonedAuraPulseDamageComponents(
  ownerSkillName: string,
  skillRow: string[],
  ownerLevel: number,
  skillMap: Map<string, SkillEntry>,
  realStats: CharacterData["realStats"] | undefined
): DamageComponent[] {
  const components: DamageComponent[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const summonedSkillName = getGameRowString(
      "Skills",
      skillRow,
      `sumskill${index}`
    );
    if (!summonedSkillName) {
      continue;
    }

    const summonedSkillRow = getGameRow("Skills", summonedSkillName);
    const isSummonOwnedAuraSkill = Boolean(
      summonedSkillRow &&
        getGameRowString("Skills", summonedSkillRow, "aura") === "1" &&
        !getGameRowString("Skills", summonedSkillRow, "charclass")
    );
    if (!isSummonOwnedAuraSkill) {
      continue;
    }

    const summonedLevel = getSummonedSkillLevel(
      skillRow,
      skillMap,
      ownerLevel,
      index
    );
    components.push(
      ...getAuraPulseDamageComponents(
        {
          name: summonedSkillName,
          level: summonedLevel,
          source: "player_skill",
          carrier: "party",
        },
        skillMap,
        realStats,
        `summon-aura-pulse:${ownerSkillName}`,
        `${ownerSkillName} owns ${summonedSkillName} through Skills.txt sumskill${index}; pulse damage is displayed separately and is not added to the summon hit total.`
      ).map((component) => ({
        ...component,
        label: `${ownerSkillName} ${component.label}`,
        sourceRefs: [
          {
            table: "Skills.txt",
            row:
              getGameRowString("Skills", skillRow, "skill") || ownerSkillName,
            columns: [`sumskill${index}`, `sumsk${index}calc`],
          },
          ...component.sourceRefs,
        ],
      }))
    );
  }

  return components;
}

function createWeaponElementalDamageComponents(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>,
  weaponDamage: DamageRange,
  realStats?: CharacterData["realStats"]
): DamageComponent[] {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow || !isNonZeroDamageRange(weaponDamage)) {
    return [];
  }

  return getWeaponElementalDamagePercentComponents(
    skillName,
    level,
    skillMap
  )
    .map(({ element, percent, calcColumn, descColumn }) => {
      const baseDamage = floorScaleDamageRange(weaponDamage, percent / 100);
      const elementalBonusPercent = getGameElementalBonusPercent(
        element,
        skillMap,
        realStats,
        skillName
      );
      const damage = scaleDamageRange(baseDamage, elementalBonusPercent);

      return createDamageComponent({
        id: `skill-weapon-elemental:${skillName}:${element}`,
        label: `${skillName} ${element} weapon conversion`,
        source: "skill",
        damageType: element,
        damage,
        baseDamage,
        sourceRefs: [
          {
            table: "Skills.txt",
            row: getGameRowString("Skills", skillRow, "skill") || skillName,
            columns: [calcColumn, descColumn, "SrcDam", "HitShift"],
            note: "Elemental percent is applied to the modeled weapon-source damage for this attack.",
          },
        ],
      });
    })
    .filter((component) => isNonZeroDamageRange(component.damage));
}

function isVengeanceSkill(skillName: string): boolean {
  return normalizeSkillName(skillName) === normalizeSkillName("Vengeance");
}

function getVengeanceFlatElementalDamage(level: number): DamageRange {
  const skillRow = getGameRow("Skills", "Vengeance");
  if (!skillRow) {
    return createEmptyDamageRange();
  }

  return (
    getGameLevelScaledRange(
      "Skills",
      skillRow,
      level,
      "EMin",
      "EMax",
      ["EMinLev1", "EMinLev2", "EMinLev3", "EMinLev4", "EMinLev5"],
      ["EMaxLev1", "EMaxLev2", "EMaxLev3", "EMaxLev4", "EMaxLev5"]
    ) || createEmptyDamageRange()
  );
}

function createVengeanceElementalDamageComponents(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>,
  weaponDamage: DamageRange,
  itemElementalDamage: Partial<
    Record<"fire" | "cold" | "lightning" | "magic", DamageRange>
  >,
  realStats?: CharacterData["realStats"]
): DamageComponent[] {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return [];
  }

  const flatSkillDamage = getVengeanceFlatElementalDamage(level);

  return getWeaponElementalDamagePercentComponents(
    skillName,
    level,
    skillMap
  )
    .map(({ element, percent, calcColumn, descColumn }) => {
      const baseDamage = addDamageRange(
        addDamageRange(createEmptyDamageRange(), weaponDamage),
        itemElementalDamage[element]
      );
      const convertedBaseDamage = addDamageRange(baseDamage, flatSkillDamage);
      const afterSkillPercent = floorScaleDamageRange(
        convertedBaseDamage,
        1 + percent / 100
      );
      const elementalBonusPercent = getGameElementalBonusPercent(
        element,
        skillMap,
        realStats,
        skillName
      );
      const damage = scaleDamageRange(
        afterSkillPercent,
        elementalBonusPercent
      );

      return createDamageComponent({
        id: `skill-vengeance:${element}`,
        label: `${skillName} ${element} damage`,
        source: "skill",
        damageType: element,
        damage,
        baseDamage: convertedBaseDamage,
        sourceRefs: [
          {
            table: "Skills.txt",
            row: getGameRowString("Skills", skillRow, "skill") || skillName,
            columns: [
              calcColumn,
              descColumn,
              "EMin",
              "EMax",
              "EMinLev1..5",
              "EMaxLev1..5",
              "SrcDam",
              "HitShift",
            ],
            note: "Vengeance converts physical weapon damage plus matching item elemental damage, adds its flat skill damage, then applies its elemental damage percent and elemental mastery.",
          },
          {
            table: "Armory item text",
            columns: [
              "weapon damage",
              "adds fire damage",
              "adds cold damage",
              "adds lightning damage",
            ],
            note: "Matching item fire/cold/lightning damage from equipment and active charms is included in that element's Vengeance converted base.",
          },
        ],
      });
    })
    .filter((component) => isNonZeroDamageRange(component.damage));
}

function getWeaponSourceDamageModifier(skillName: string): number {
  const skillRow = getGameRow("Skills", skillName);
  const srcDam = skillRow ? getGameRowNumber("Skills", skillRow, "SrcDam") : 0;
  return srcDam > 0 ? srcDam / 128 : 1;
}

function getSelectedSkillDamagePercent(
  skillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>
): number {
  const skillRow = getGameRow("Skills", skillName);
  const skillDescRow = skillRow ? getGameSkillDescRow(skillRow) : undefined;
  if (skillRow && skillDescRow) {
    const gameDamageValues: number[] = [];

    for (let index = 1; index <= 6; index += 1) {
      const textKeys = [
        getGameRowString("SkillDesc", skillDescRow, `desctexta${index}`),
        getGameRowString("SkillDesc", skillDescRow, `desctextb${index}`),
      ];
      if (!textKeys.includes("StrSkill4")) {
        continue;
      }

      [
        getGameRowString("SkillDesc", skillDescRow, `desccalca${index}`),
        getGameRowString("SkillDesc", skillDescRow, `desccalcb${index}`),
      ].forEach((calc) => {
        const value = evaluateGameCalcExpression(
          calc,
          skillRow,
          skillMap,
          level
        );
        if (value > 0) {
          gameDamageValues.push(value);
        }
      });
    }

    if (gameDamageValues.length > 0) {
      return Math.max(...gameDamageValues);
    }

    return 0;
  }

  return 0;
}

function getChargeVariantSelectedSkillDamagePercent(
  skillOption: DamageSkillOption,
  sourceSkillName: string,
  level: number,
  skillMap: Map<string, SkillEntry>
): number | undefined {
  const definition = getMartialArtsChargeDefinition(sourceSkillName);
  if (!definition || skillOption.chargeVariant !== "charge") {
    return undefined;
  }

  const skillRow = getGameRow("Skills", sourceSkillName);
  if (!skillRow) {
    return undefined;
  }

  const expressions = definition.selectedSkillDamagePercentByCharge || {};
  const evaluateCharge = (chargeNumber: number) =>
    evaluateGameCalcExpression(
      expressions[chargeNumber] || "",
      skillRow,
      skillMap,
      level
    );

  if (skillOption.chargeVariant === "charge") {
    const chargeNumber = skillOption.chargeNumber || 0;
    if (definition.selectedSkillDamagePercentPerChargeExpression) {
      return (
        evaluateGameCalcExpression(
          definition.selectedSkillDamagePercentPerChargeExpression,
          skillRow,
          skillMap,
          level
        ) * chargeNumber
      );
    }

    return evaluateCharge(chargeNumber);
  }

  return undefined;
}

function getTransformationDamagePercent(
  gameSkillName: string,
  level: number
): number {
  const skillRow = getGameRow("Skills", gameSkillName);
  if (!skillRow) {
    return 0;
  }

  for (let index = 1; index <= 6; index += 1) {
    if (
      getGameRowString("Skills", skillRow, `aurastat${index}`) !==
      "damagepercent"
    ) {
      continue;
    }

    return evaluateGameCalcExpression(
      getGameRowString("Skills", skillRow, `aurastatcalc${index}`),
      skillRow,
      EMPTY_SKILL_MAP,
      level
    );
  }

  return 0;
}

function getPassiveSkillDamagePercent(
  characterClass: string,
  weaponSelection: WeaponSelection,
  skillMap: Map<string, SkillEntry>
): number {
  let total = 0;

  if (isJavelinOrSpear(weaponSelection.item)) {
    total +=
      getGameSkillPassiveStatValue(
        "Javelin and Spear Mastery",
        ["passive_mastery_melee_dmg", "passive_mastery_throw_dmg"],
        skillMap
      ) || 0;
  }

  if (isClawWeapon(weaponSelection.item)) {
    total +=
      getGameSkillPassiveStatValue(
        "Claw Mastery",
        ["passive_mastery_melee_dmg"],
        skillMap
      ) || 0;
  }

  if (characterClass.toLowerCase() === "barbarian") {
    const masterySkillName =
      weaponSelection.option.handMode === "two_handed"
        ? "Two Handed Mastery"
        : "One Handed Mastery";
    total +=
      getGameSkillPassiveStatValue(
        masterySkillName,
        ["passive_mastery_melee_dmg", "passive_mastery_throw_dmg"],
        skillMap
      ) || 0;
  }

  return total;
}

function parseItemDamageStats(
  playerItems: IItem[],
  selectedWeapon: WeaponSelection
): {
  flatPhysicalDamage: DamageRange;
  nonWeaponEnhancedDamagePct: number;
  elementalDamage: Partial<
    Record<"fire" | "cold" | "lightning" | "magic", DamageRange>
  >;
  poisonDamage?: PoisonDamage;
} {
  const flatPhysicalDamage = createEmptyDamageRange();
  const elementalDamage: Partial<
    Record<"fire" | "cold" | "lightning" | "magic", DamageRange>
  > = {};
  let nonWeaponEnhancedDamagePct = 0;
  let poisonDamage: PoisonDamage | undefined;

  const selectedWeaponKey =
    selectedWeapon.item.hash || String(selectedWeapon.item.id);

  const addElementalRange = (
    element: "fire" | "cold" | "lightning" | "magic",
    min: number,
    max: number
  ) => {
    const normalizedRange = normalizeDamageRange({ min, max });
    elementalDamage[element] = addDamageRange(
      elementalDamage[element] || createEmptyDamageRange(),
      normalizedRange
    );
  };

  playerItems.forEach((item) => {
    const itemKey = item.hash || String(item.id);
    const isWeapon = item.category === "weapon";
    const isSelectedWeapon = itemKey === selectedWeaponKey;
    if (
      !isSelectedWeapon &&
      !isEquippedItem(item) &&
      !isActiveInventoryCharm(item)
    ) {
      return;
    }

    const standaloneElementalDamage: Record<
      "fire" | "cold" | "lightning" | "magic",
      DamageRange
    > = {
      fire: createEmptyDamageRange(),
      cold: createEmptyDamageRange(),
      lightning: createEmptyDamageRange(),
      magic: createEmptyDamageRange(),
    };

    const expandedElementalDamage = getExpandedItemElementalDamageRanges(item);
    (["fire", "cold", "lightning", "magic"] as const).forEach((element) => {
      const damage = expandedElementalDamage[element];
      if (damage) {
        addElementalRange(element, damage.min, damage.max);
      }
    });

    item.properties.forEach((property) => {
      if (!property) {
        return;
      }

      if (!isWeapon) {
        const enhancedDamage = property.match(/^\+?(\d+)% Enhanced Damage$/i);
        if (enhancedDamage) {
          nonWeaponEnhancedDamagePct += Number(enhancedDamage[1]);
          return;
        }

        const minDamage = property.match(/^\+(\d+) to Minimum Damage$/i);
        if (minDamage) {
          flatPhysicalDamage.min += Number(minDamage[1]);
          return;
        }

        const maxDamage = property.match(/^\+(\d+) to Maximum Damage$/i);
        if (maxDamage) {
          flatPhysicalDamage.max += Number(maxDamage[1]);
          return;
        }

        const addedPhysicalDamage = property.match(
          /^Adds (\d+)-(\d+) Damage$/i
        );
        if (addedPhysicalDamage) {
          flatPhysicalDamage.min += Number(addedPhysicalDamage[1]);
          flatPhysicalDamage.max += Number(addedPhysicalDamage[2]);
          return;
        }
      }

      if (!isWeapon || isSelectedWeapon) {
        const fireDamage = property.match(/^Adds (\d+)-(\d+) Fire Damage$/i);
        if (fireDamage) {
          if (expandedElementalDamage.fire) {
            return;
          }

          addElementalRange(
            "fire",
            Number(fireDamage[1]),
            Number(fireDamage[2])
          );
          return;
        }

        const coldDamage = property.match(/^Adds (\d+)-(\d+) Cold Damage$/i);
        if (coldDamage) {
          if (expandedElementalDamage.cold) {
            return;
          }

          addElementalRange(
            "cold",
            Number(coldDamage[1]),
            Number(coldDamage[2])
          );
          return;
        }

        const magicDamage = property.match(/^Adds (\d+)-(\d+) Magic Damage$/i);
        if (magicDamage) {
          if (expandedElementalDamage.magic) {
            return;
          }

          addElementalRange(
            "magic",
            Number(magicDamage[1]),
            Number(magicDamage[2])
          );
          return;
        }

        const lightningDamage = property.match(
          /^Adds (\d+)-(\d+) Lightning Damage$/i
        );
        if (lightningDamage) {
          if (expandedElementalDamage.lightning) {
            return;
          }

          addElementalRange(
            "lightning",
            Number(lightningDamage[1]),
            Number(lightningDamage[2])
          );
          return;
        }

        const minElementalDamage = property.match(
          /^(\+)?(\d+) to Minimum (Fire|Cold|Lightning|Magic) Damage$/i
        );
        if (minElementalDamage) {
          const element = minElementalDamage[3].toLowerCase() as
            | "fire"
            | "cold"
            | "lightning"
            | "magic";
          if (expandedElementalDamage[element]) {
            return;
          }

          standaloneElementalDamage[element].min += Number(
            minElementalDamage[2]
          );
          return;
        }

        const maxElementalDamage = property.match(
          /^(\+)?(\d+) to Maximum (Fire|Cold|Lightning|Magic) Damage$/i
        );
        if (maxElementalDamage) {
          const element = maxElementalDamage[3].toLowerCase() as
            | "fire"
            | "cold"
            | "lightning"
            | "magic";
          if (expandedElementalDamage[element]) {
            return;
          }

          standaloneElementalDamage[element].max += Number(
            maxElementalDamage[2]
          );
          return;
        }

        const poisonMatch = property.match(
          /^(?:Adds )?(\d+) Poison Damage over ([\d.]+) Seconds$/i
        );
        if (poisonMatch) {
          poisonDamage = addPoisonDamage(poisonDamage, {
            total: Number(poisonMatch[1]),
            durationSeconds: Number(poisonMatch[2]),
          });
        }
      }
    });

    (["fire", "cold", "lightning", "magic"] as const).forEach((element) => {
      const standaloneRange = standaloneElementalDamage[element];
      if (standaloneRange.min > 0 || standaloneRange.max > 0) {
        const normalizedRange = normalizeDamageRange(standaloneRange);
        addElementalRange(element, normalizedRange.min, normalizedRange.max);
      }
    });
  });

  return {
    flatPhysicalDamage: normalizeDamageRange(flatPhysicalDamage),
    nonWeaponEnhancedDamagePct,
    elementalDamage,
    poisonDamage,
  };
}

function getAuraFormulaSkillName(auraName: string): string {
  return getPlayerAuraDefinition(auraName)?.skillName || auraName;
}

function findGameAuraStatCalc(
  skillRow: string[],
  statNames: readonly string[],
  source: "self" | "party"
): string | undefined {
  const prefix = source === "self" ? "passive" : "aura";
  const slots = source === "self" ? 5 : 6;

  for (let index = 1; index <= slots; index += 1) {
    const stat = getGameRowString("Skills", skillRow, `${prefix}stat${index}`);
    if (stat && statNames.includes(stat)) {
      return getGameRowString(
        "Skills",
        skillRow,
        getGameStatCalcColumn(prefix, index)
      );
    }
  }

  return undefined;
}

const AURA_ELEMENT_STATS = {
  fire: ["firemindam", "firemaxdam"],
  cold: ["coldmindam", "coldmaxdam"],
  lightning: ["lightmindam", "lightmaxdam"],
  magic: ["magicmindam", "magicmaxdam"],
} as const;

const AURA_ELEMENT_DAMAGE_STAT_NAMES = new Set<string>([
  "firemindam",
  "firemaxdam",
  "coldmindam",
  "coldmaxdam",
  "lightmindam",
  "lightmaxdam",
  "magicmindam",
  "magicmaxdam",
]);

function usesFixedPointElementalAliases(
  calc: string,
  statNames: readonly string[]
): boolean {
  return (
    statNames.some((statName) =>
      AURA_ELEMENT_DAMAGE_STAT_NAMES.has(statName)
    ) &&
    /\bed(?:mn|mx|ns|xs)\b/.test(calc) &&
    /\/\s*256\b/.test(calc)
  );
}

function getGameAuraStatValue(
  aura: AuraSource,
  statNames: readonly string[],
  source: "self" | "party",
  skillMap: Map<string, SkillEntry>
): number | undefined {
  const skillRow = getGameRow("Skills", getAuraFormulaSkillName(aura.name));
  if (!skillRow) {
    return undefined;
  }

  const calc = findGameAuraStatCalc(skillRow, statNames, source);
  if (!calc) {
    return undefined;
  }

  if (/\bedln\b/.test(calc)) {
    return undefined;
  }

  return evaluateGameCalcExpression(
    calc,
    skillRow,
    skillMap,
    aura.level,
    new Set<string>(),
    {
      elementalAliasMode: usesFixedPointElementalAliases(calc, statNames)
        ? "fixed"
        : "scaled",
    }
  );
}

function getAuraPhysicalDamagePercent(aura: AuraSource): number {
  const skillMap = new Map<string, SkillEntry>();
  const gameSelfValue =
    aura.carrier === "self"
      ? getGameAuraStatValue(aura, ["damagepercent"], "self", skillMap)
      : undefined;
  const gamePartyValue = getGameAuraStatValue(
    aura,
    ["damagepercent"],
    "party",
    skillMap
  );
  const gameValue =
    aura.carrier === "self"
      ? (gameSelfValue ?? gamePartyValue)
      : gamePartyValue;
  if (gameValue !== undefined) {
    return gameValue;
  }

  return 0;
}

function getAuraSkillLevelBonus(aura: AuraSource): number {
  const skillMap = new Map<string, SkillEntry>();
  const gameSelfValue =
    aura.carrier === "self"
      ? getGameAuraStatValue(aura, ["item_allskills"], "self", skillMap)
      : undefined;
  const gamePartyValue = getGameAuraStatValue(
    aura,
    ["item_allskills"],
    "party",
    skillMap
  );
  const gameValue =
    aura.carrier === "self"
      ? (gameSelfValue ?? gamePartyValue)
      : gamePartyValue;

  return gameValue ?? 0;
}

function getTotalAuraSkillLevelBonus(activeAuras: AuraSource[]): number {
  return activeAuras.reduce(
    (total, aura) => total + getAuraSkillLevelBonus(aura),
    0
  );
}

function applyAuraSkillLevelBonuses(
  skillMap: Map<string, SkillEntry>,
  activeAuras: AuraSource[]
): Map<string, SkillEntry> {
  const skillLevelBonus = getTotalAuraSkillLevelBonus(activeAuras);
  if (skillLevelBonus <= 0) {
    return skillMap;
  }

  return new Map(
    Array.from(skillMap.entries()).map(([skillName, entry]) => [
      skillName,
      {
        ...entry,
        level: entry.level + skillLevelBonus,
      },
    ])
  );
}

function getGameAuraElementalRange(
  aura: AuraSource,
  element: keyof typeof AURA_ELEMENT_STATS,
  skillMap: Map<string, SkillEntry>
): DamageRange | undefined {
  const sources: Array<"self" | "party"> =
    aura.carrier === "self" ? ["self", "party"] : ["party"];
  const [minStat, maxStat] = AURA_ELEMENT_STATS[element];

  for (const source of sources) {
    const min = getGameAuraStatValue(aura, [minStat], source, skillMap);
    const max = getGameAuraStatValue(aura, [maxStat], source, skillMap);
    if (min !== undefined && max !== undefined) {
      return normalizeDamageRange({ min, max });
    }
  }

  return undefined;
}

function hasSelfElementalAuraDamageStats(
  skillRow: string[],
  element: keyof typeof AURA_ELEMENT_STATS
): boolean {
  const [minStat, maxStat] = AURA_ELEMENT_STATS[element];
  return Boolean(
    findGameAuraStatCalc(skillRow, [minStat], "self") &&
    findGameAuraStatCalc(skillRow, [maxStat], "self")
  );
}

function getGameBuffElementalRange(
  aura: AuraSource,
  element: keyof typeof AURA_ELEMENT_STATS,
  skillMap: Map<string, SkillEntry>
): DamageRange | undefined {
  const skillRow = getGameRow("Skills", getAuraFormulaSkillName(aura.name));
  if (
    !skillRow ||
    GAME_ETYPES[getGameRowString("Skills", skillRow, "EType")] !== element
  ) {
    return undefined;
  }

  const canUseElementalPayload =
    isGameSelfOrPartyBuffSkill(aura.name) ||
    (isPlayerAuraSkill(aura.name) &&
      hasSelfElementalAuraDamageStats(skillRow, element));
  if (!canUseElementalPayload) {
    return undefined;
  }

  const range = getGameLevelScaledRange(
    "Skills",
    skillRow,
    aura.level,
    "EMin",
    "EMax",
    ["EMinLev1", "EMinLev2", "EMinLev3", "EMinLev4", "EMinLev5"],
    ["EMaxLev1", "EMaxLev2", "EMaxLev3", "EMaxLev4", "EMaxLev5"]
  );
  if (!range) {
    return undefined;
  }

  return scaleDamageRange(
    range,
    evaluateGameCalcExpression(
      getGameRowString("Skills", skillRow, "EDmgSymPerCalc"),
      skillRow,
      skillMap,
      aura.level
    )
  );
}

function getAuraAttackDamage(
  aura: AuraSource,
  skillMap: Map<string, SkillEntry>,
  realStats?: CharacterData["realStats"]
): Partial<Record<"fire" | "cold" | "lightning" | "magic", DamageRange>> {
  const ranges: Partial<
    Record<"fire" | "cold" | "lightning" | "magic", DamageRange>
  > = {};

  const skillDamageBonusApplies = aura.source === "player_skill";
  const auraFormulaSkillMap =
    aura.source === "player_skill" ? skillMap : EMPTY_SKILL_MAP;
  const getAuraRange = (element: "fire" | "cold" | "lightning" | "magic") =>
    getGameAuraElementalRange(aura, element, auraFormulaSkillMap) ||
    getGameBuffElementalRange(aura, element, auraFormulaSkillMap);

  const fireRange = getAuraRange("fire");
  if (fireRange) {
    const itemBonus = skillDamageBonusApplies
      ? getElementalSkillDamageBonusPercent("fire", realStats)
      : 0;
    ranges.fire = scaleDamageRange(fireRange, itemBonus);
  }

  const coldRange = getAuraRange("cold");
  if (coldRange) {
    const itemBonus = skillDamageBonusApplies
      ? getElementalSkillDamageBonusPercent("cold", realStats)
      : 0;
    ranges.cold = scaleDamageRange(coldRange, itemBonus);
  }

  const lightningRange = getAuraRange("lightning");
  if (lightningRange) {
    const itemBonus = skillDamageBonusApplies
      ? getElementalSkillDamageBonusPercent("lightning", realStats)
      : 0;
    ranges.lightning = scaleDamageRange(lightningRange, itemBonus);
  }

  const magicRange = getAuraRange("magic");
  if (magicRange) {
    ranges.magic = magicRange;
  }

  return ranges;
}

function getAuraPoisonDamage(
  aura: AuraSource,
  skillMap: Map<string, SkillEntry>,
  realStats?: CharacterData["realStats"]
): NonNullable<DamageAuraLevelBonus["poisonDamage"]> | undefined {
  if (aura.carrier !== "self") {
    return undefined;
  }

  const skillRow = getGameRow("Skills", getAuraFormulaSkillName(aura.name));
  if (!skillRow || !isGameSelfOnlyPoisonBuffSkill(skillRow)) {
    return undefined;
  }

  const range = getGameLevelScaledRange(
    "Skills",
    skillRow,
    aura.level,
    "EMin",
    "EMax",
    ["EMinLev1", "EMinLev2", "EMinLev3", "EMinLev4", "EMinLev5"],
    ["EMaxLev1", "EMaxLev2", "EMaxLev3", "EMaxLev4", "EMaxLev5"]
  );
  const durationFrames = getGameRowNumber("Skills", skillRow, "ELen");
  if (!range || durationFrames <= 0) {
    return undefined;
  }

  const auraFormulaSkillMap =
    aura.source === "player_skill" ? skillMap : EMPTY_SKILL_MAP;
  const poisonSkillDamageBonus =
    aura.source === "player_skill"
      ? getPoisonSkillDamageBonusPercent(realStats)
      : 0;
  const damage = scaleDamageRangeInStages(
    applyGameDotMultiplier(range, durationFrames),
    evaluateGameCalcExpression(
      getGameRowString("Skills", skillRow, "EDmgSymPerCalc"),
      skillRow,
      auraFormulaSkillMap,
      aura.level
    ),
    poisonSkillDamageBonus
  );

  if (!isNonZeroDamageRange(damage)) {
    return undefined;
  }

  return {
    damage,
    total: Math.floor(averageDamageRange(damage)),
    durationSeconds: durationFrames / 25,
  };
}

function createAuraPoisonDamageComponent(
  aura: AuraSource,
  skillMap: Map<string, SkillEntry>,
  realStats: CharacterData["realStats"] | undefined,
  idPrefix: string,
  sourceNote?: string
): DamageComponent | undefined {
  const poisonDamage = getAuraPoisonDamage(aura, skillMap, realStats);
  if (!poisonDamage) {
    return undefined;
  }

  return createDamageComponent({
    id: `${idPrefix}-${aura.name}-${aura.level}-${aura.carrier}-poison`,
    label: `${aura.name} poison`,
    source: "aura",
    damageType: "poison",
    timing: "over_time",
    damage: poisonDamage.damage,
    poisonDamage: {
      total: poisonDamage.total,
      durationSeconds: poisonDamage.durationSeconds,
    },
    sourceRefs: [
      {
        table: "Skills.txt",
        row: getAuraFormulaSkillName(aura.name),
        columns: [
          "aurastat*",
          "aurastatcalc*",
          "EType",
          "EMin",
          "EMax",
          "EDmgSymPerCalc",
          "ELen",
          "HitShift",
        ],
        note: sourceNote,
      },
    ],
  });
}

function getAuraPulseDamageComponents(
  aura: AuraSource,
  skillMap: Map<string, SkillEntry>,
  realStats: CharacterData["realStats"] | undefined,
  idPrefix: string,
  sourceNote?: string
): DamageComponent[] {
  const auraSkillName = getAuraFormulaSkillName(aura.name);
  const skillRow = getGameRow("Skills", auraSkillName);
  if (!skillRow || getGameRowString("Skills", skillRow, "aura") !== "1") {
    return [];
  }

  const auraFormulaSkillMap =
    aura.source === "player_skill" ? skillMap : EMPTY_SKILL_MAP;
  const auraRealStats = aura.source === "player_skill" ? realStats : undefined;
  const directDamage = getGameDirectSkillDamage(
    auraSkillName,
    aura.level,
    auraFormulaSkillMap,
    auraRealStats
  );
  if (!directDamage) {
    return [];
  }

  const poisonDuration = getGamePoisonDurationSeconds(auraSkillName) || 0;
  return directDamage.components
    .filter((component) => component.source === "skill")
    .map((component, index) =>
      createDamageComponent({
        id: `${idPrefix}:${aura.name}:${aura.level}:${aura.carrier}:${index}:${component.element}`,
        label: `${aura.name} pulse ${component.element}`,
        source: "aura",
        damageType: component.element,
        timing: component.timing,
        damage: component.damage,
        poisonDamage:
          component.element === "poison"
            ? {
                total: Math.floor(averageDamageRange(component.damage)),
                durationSeconds: poisonDuration,
              }
            : undefined,
        sourceRefs: component.sourceRefs.map((sourceRef) => ({
          ...sourceRef,
          note: sourceRef.note || sourceNote,
        })),
        notes: component.notes,
      })
    )
    .filter((component) => isNonZeroDamageRange(component.damage));
}

function getActiveAuraPulseDamageComponents(
  activeAuras: AuraSource[],
  skillMap: Map<string, SkillEntry>,
  realStats: CharacterData["realStats"] | undefined,
  idPrefix: string
): DamageComponent[] {
  return activeAuras.flatMap((aura) =>
    getAuraPulseDamageComponents(
      aura,
      skillMap,
      realStats,
      idPrefix,
      "Aura pulse damage is displayed separately and is not added to the selected attack or spell hit totals."
    )
  );
}

function getAuraPulseProfileFields(
  auraPulseDamageComponents: DamageComponent[]
): Pick<
  DamageProfile,
  "auraPulseDamageComponents" | "auraPulseDamageTotals"
> {
  if (auraPulseDamageComponents.length === 0) {
    return {};
  }

  return {
    auraPulseDamageComponents,
    auraPulseDamageTotals: buildDamageTotals(auraPulseDamageComponents),
  };
}

function getManualAuraLevelBonus(
  auraName: string,
  level: number,
  carrier: AuraCarrier
): DamageAuraLevelBonus {
  const aura: AuraSource = {
    name: auraName,
    level,
    source: "manual",
    carrier,
  };

  return {
    level,
    skillLevelBonus: getAuraSkillLevelBonus(aura),
    physicalBonusPercent: getAuraPhysicalDamagePercent(aura),
    elementalDamage: getAuraAttackDamage(aura, new Map()),
    poisonDamage: getAuraPoisonDamage(aura, new Map()),
  };
}

function skillHasServerMissiles(skillRow: string[]): boolean {
  return SERVER_SKILL_MISSILE_COLUMNS.some((columnName) =>
    Boolean(getGameRowString("Skills", skillRow, columnName))
  );
}

function getRequiredWeaponSequenceRule(
  skillName: string
): RequiredWeaponSequenceRule | undefined {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return undefined;
  }

  const skill = getGameRowString("Skills", skillRow, "skill") || skillName;
  const ruleKey = Object.keys(REQUIRED_WEAPON_SEQUENCE_SKILLS).find(
    (candidate) => candidate.toLowerCase() === skill.toLowerCase()
  );
  const rule = ruleKey ? REQUIRED_WEAPON_SEQUENCE_SKILLS[ruleKey] : undefined;
  if (!rule) {
    return undefined;
  }

  const expectedColumns: Array<
    [
      Exclude<
        keyof RequiredWeaponSequenceRule,
        "handMode" | "requiresMissilePayload"
      >,
      string,
    ]
  > = [
    ["weapsel", "weapsel"],
    ["seqnum", "seqnum"],
    ["srvstfunc", "srvstfunc"],
    ["srvdofunc", "srvdofunc"],
    ["itypea1", "itypea1"],
    ["itypeb1", "itypeb1"],
  ];
  const matchesRequiredColumns = expectedColumns.every(
    ([ruleProperty, columnName]) =>
      !rule[ruleProperty] ||
      getGameRowString("Skills", skillRow, columnName) === rule[ruleProperty]
  );

  if (!matchesRequiredColumns) {
    return undefined;
  }

  if (skillHasServerMissiles(skillRow) !== rule.requiresMissilePayload) {
    return undefined;
  }

  return rule;
}

function getRequiredWeaponSequenceHandMode(
  skillName: string
): WeaponSequenceHandMode | undefined {
  return getRequiredWeaponSequenceRule(skillName)?.handMode;
}

function getSkillWeaponSequenceEvidence(
  skillName: string,
  handMode: DamageWeaponOption["handMode"]
): { supported: boolean; note: string } {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return {
      supported: false,
      note: `${skillName} has no Skills.txt row for weapon-sequence modeling.`,
    };
  }

  const skill = getGameRowString("Skills", skillRow, "skill") || skillName;
  const weapsel = getGameRowString("Skills", skillRow, "weapsel");
  const seqnum = getGameRowString("Skills", skillRow, "seqnum");
  const requiredHandMode = getRequiredWeaponSequenceHandMode(skillName);

  if (requiredHandMode) {
    if (handMode !== requiredHandMode) {
      return {
        supported: false,
        note: `${skill} requires ${requiredHandMode.replace("_", "-")} weapon sequence modeling from its validated Skills.txt row.`,
      };
    }

    return {
      supported: true,
      note:
        requiredHandMode === "dual_throw"
          ? `${skill} is modeled as a required two-throw weapon sequence from Skills.txt skill, weapsel, seqnum, itypea*/itypeb*, SrcDam, srvdofunc, and server missile columns.`
          : `${skill} is modeled as a required two-weapon melee sequence from Skills.txt skill, weapsel, seqnum, itypea*/itypeb*, SrcDam, srvstfunc/srvdofunc, and server missile columns.`,
    };
  }

  if (handMode === "dual_wield" && weapsel === "2" && seqnum === "10") {
    return {
      supported: true,
      note: `${skill} is modeled as one two-weapon cycle from Skills.txt weapsel=2 and seqnum=10; full movement-duration hit frequency is not inferred.`,
    };
  }

  return {
    supported: false,
    note: `${skill} does not expose a modeled ${handMode.replace("_", "-")} weapon sequence in Skills.txt.`,
  };
}

function supportsWeaponSequence(
  skillName: string,
  handMode: DamageWeaponOption["handMode"]
): boolean {
  return getSkillWeaponSequenceEvidence(skillName, handMode).supported;
}

function getSkillWeaponTypeCodes(
  skillRow: string[],
  columnPrefix: (typeof SKILL_WEAPON_TYPE_COLUMN_PREFIXES)[number]
): string[] {
  return [1, 2, 3]
    .map((index) =>
      getGameRowString("Skills", skillRow, `${columnPrefix}${index}`)
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
}

function getItemWeaponTypeCodes(item: IItem): Set<string> {
  const codes = new Set<string>();
  const queue = [
    item.base?.type_code?.trim().toLowerCase(),
    item.base_code?.trim().toLowerCase(),
  ].filter((code): code is string => Boolean(code));

  while (queue.length > 0) {
    const code = queue.shift()!;
    if (codes.has(code)) {
      continue;
    }

    codes.add(code);
    (ITEM_WEAPON_TYPE_PARENTS[code] || []).forEach((parentCode) => {
      if (!codes.has(parentCode)) {
        queue.push(parentCode);
      }
    });
  }

  if (item.category === "weapon") {
    codes.add("weap");
  }

  return codes;
}

function isSingleWeaponMeleeSelection(
  weaponSelection: WeaponSelection
): boolean {
  return (
    weaponSelection.option.handMode === "one_handed" ||
    weaponSelection.option.handMode === "two_handed"
  );
}

function isSkillWeaponTypeHandModeCompatible(
  skillWeaponType: string,
  weaponSelection: WeaponSelection
): boolean | undefined {
  switch (skillWeaponType) {
    case "miss":
      return weaponSelection.option.handMode === "missile";
    case "comb":
    case "jave":
    case "thro":
      return (
        weaponSelection.option.handMode === "missile" &&
        !isBowOrCrossbow(weaponSelection.item)
      );
    case "asm":
    case "h2h":
    case "h2h2":
    case "knif":
    case "mele":
    case "sc9":
    case "spea":
      return isSingleWeaponMeleeSelection(weaponSelection);
    case "weap":
      return (
        weaponSelection.option.handMode !== "kick" &&
        weaponSelection.option.handMode !== "summon" &&
        weaponSelection.option.handMode !== "unarmed"
      );
    case "shld":
      return false;
    default:
      return undefined;
  }
}

function weaponSelectionMatchesSkillWeaponType(
  weaponSelection: WeaponSelection,
  skillWeaponType: string
): boolean {
  const handModeCompatible = isSkillWeaponTypeHandModeCompatible(
    skillWeaponType,
    weaponSelection
  );
  if (handModeCompatible === false) {
    return false;
  }

  if (!KNOWN_SKILL_WEAPON_TYPE_CODES.has(skillWeaponType)) {
    return true;
  }

  if (skillWeaponType === "mele") {
    return isSingleWeaponMeleeSelection(weaponSelection);
  }

  if (skillWeaponType === "weap") {
    return (
      weaponSelection.item.category === "weapon" &&
      handModeCompatible === true
    );
  }

  return getItemWeaponTypeCodes(weaponSelection.item).has(skillWeaponType);
}

function weaponSelectionMatchesAnySkillWeaponType(
  weaponSelection: WeaponSelection,
  skillWeaponTypes: string[]
): boolean {
  return (
    skillWeaponTypes.length === 0 ||
    skillWeaponTypes.some((skillWeaponType) =>
      weaponSelectionMatchesSkillWeaponType(weaponSelection, skillWeaponType)
    )
  );
}

function isWeaponSelectionCompatibleWithSkillTypes(
  weaponSelection: WeaponSelection,
  skillName: string
): boolean {
  const skillRow = getGameRow("Skills", skillName);
  if (!skillRow) {
    return true;
  }

  const [primaryTypePrefix, secondaryTypePrefix] =
    SKILL_WEAPON_TYPE_COLUMN_PREFIXES;
  const primaryWeaponTypes = getSkillWeaponTypeCodes(
    skillRow,
    primaryTypePrefix
  );
  const secondaryWeaponTypes = getSkillWeaponTypeCodes(
    skillRow,
    secondaryTypePrefix
  );
  if (primaryWeaponTypes.length === 0 && secondaryWeaponTypes.length === 0) {
    return true;
  }

  if (weaponSelection.sequenceHits?.length) {
    if (secondaryWeaponTypes.length === 0) {
      return weaponSelection.sequenceHits.every((hit) =>
        weaponSelectionMatchesAnySkillWeaponType(
          hit.selection,
          primaryWeaponTypes
        )
      );
    }

    const [primaryHit, secondaryHit] = weaponSelection.sequenceHits;
    return Boolean(
      primaryHit &&
        secondaryHit &&
        weaponSelectionMatchesAnySkillWeaponType(
          primaryHit.selection,
          primaryWeaponTypes
        ) &&
        weaponSelectionMatchesAnySkillWeaponType(
          secondaryHit.selection,
          secondaryWeaponTypes
        )
    );
  }

  return weaponSelectionMatchesAnySkillWeaponType(weaponSelection, [
    ...primaryWeaponTypes,
    ...secondaryWeaponTypes,
  ]);
}

function isWeaponSelectionCompatibleWithSkill(
  weaponSelection: WeaponSelection,
  skillOption: DamageSkillOption
): boolean {
  const sourceSkillName = skillOption.sourceSkillName || skillOption.name;
  const isSummonSkill = skillOption.damageMode === "summon";
  if (isSummonSkill) {
    return (
      weaponSelection.option.handMode === "summon" &&
      normalizeSkillName(
        weaponSelection.summonSkillName || ""
      ).toLowerCase() === normalizeSkillName(sourceSkillName).toLowerCase()
    );
  }

  if (weaponSelection.option.handMode === "summon") {
    return false;
  }

  const isKickSkill = isGameKickSkill(sourceSkillName);
  if (isKickSkill) {
    return weaponSelection.option.handMode === "kick";
  }

  if (weaponSelection.option.handMode === "kick") {
    return false;
  }

  const sourceSkillRow = getGameRow("Skills", sourceSkillName);
  const skillRange = sourceSkillRow
    ? getGameRowString("Skills", sourceSkillRow, "range")
    : "";
  const isBowMeleeSelection =
    isBowOrCrossbow(weaponSelection.item) &&
    weaponSelection.option.handMode === "two_handed";
  if (
    isBowMeleeSelection &&
    (skillOption.damageMode !== "weapon" || skillRange !== "h2h")
  ) {
    return false;
  }

  if (
    skillOption.damageMode === "weapon" &&
    skillRange === "h2h" &&
    weaponSelection.option.handMode === "missile"
  ) {
    return false;
  }

  const requiredHandMode = getRequiredWeaponSequenceHandMode(sourceSkillName);

  if (requiredHandMode) {
    return (
      weaponSelection.option.handMode === requiredHandMode &&
      Boolean(weaponSelection.sequenceHits?.length) &&
      supportsWeaponSequence(sourceSkillName, requiredHandMode) &&
      isWeaponSelectionCompatibleWithSkillTypes(
        weaponSelection,
        sourceSkillName
      )
    );
  }

  if (weaponSelection.sequenceHits?.length) {
    return (
      supportsWeaponSequence(sourceSkillName, weaponSelection.option.handMode) &&
      isWeaponSelectionCompatibleWithSkillTypes(
        weaponSelection,
        sourceSkillName
      )
    );
  }

  if (skillOption.damageMode === "weapon") {
    return isWeaponSelectionCompatibleWithSkillTypes(
      weaponSelection,
      sourceSkillName
    );
  }

  return true;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getSummonAuraSource(aura: AuraSource): AuraSource {
  return {
    ...aura,
    carrier: "party",
  };
}

function getSummonModeNotes(
  skillName: string,
  skillRow?: string[],
  variantDefinition?: SummonVariantDefinition
): string[] {
  const notes = [
    `${skillName} is modeled as a per-summon damage profile from Skills.txt summon/sumskill fields and MonStats.txt attack fields when present; pet count, AI choices, attack speed, hit chance, target count, and uptime are not multiplied into totals.`,
  ];

  if (variantDefinition) {
    notes.push(
      `${variantDefinition.label} is modeled as one ${skillName} elemental variant; other variants are separate skill options and are not summed into this profile.`
    );
  }

  if (!skillRow) {
    return notes;
  }

  const petMax = getGameRowString("Skills", skillRow, "petmax");
  if (petMax) {
    notes.push(
      `Summon count is exposed as Skills.txt petmax (${petMax}) but is not multiplied into damage totals.`
    );
  }

  const monsterRow = getSummonMonsterRow(skillRow);
  if (!monsterRow) {
    notes.push(
      "MonStats.txt does not expose a stable monster row for this summon in the current extract; only Skills.txt payloads are modeled."
    );
  }

  return notes;
}

function buildSummonProfile(
  context: WeaponSetContext,
  weaponSelection: WeaponSelection,
  skillOption: DamageSkillOption,
  playerAuraSelection: AuraSelection
): DamageProfile {
  const { option: playerAuraOption } = playerAuraSelection;
  const { alwaysActiveAuras, realStats, skillMap } = context;
  const sourceSkillName = skillOption.sourceSkillName || skillOption.name;
  const variantDefinition = getSummonVariantDefinition(
    sourceSkillName,
    skillOption.summonVariant
  );
  const selectedPlayerAura =
    playerAuraOption.id === "none"
      ? undefined
      : getSummonAuraSource({
          name: playerAuraOption.name,
          level:
            getSkillEntry(skillMap, playerAuraOption.name).level ||
            playerAuraOption.level,
          source:
            playerAuraOption.source === "character_skill"
              ? ("player_skill" as const)
              : ("manual" as const),
          carrier: "party",
        });
  const activeAuras = dedupeAuras([
    ...alwaysActiveAuras.map(getSummonAuraSource),
    ...(selectedPlayerAura ? [selectedPlayerAura] : []),
  ]);
  const effectiveSkillMap = applyAuraSkillLevelBonuses(skillMap, activeAuras);
  const selectedSkillLevel =
    getSkillEntry(effectiveSkillMap, sourceSkillName).level ||
    skillOption.level;
  const selectedSkillRow = getGameRow("Skills", sourceSkillName);
  const baseComponents = getSummonDamageComponents(
    sourceSkillName,
    selectedSkillLevel,
    effectiveSkillMap,
    realStats,
    skillOption.summonVariant
  );
  const summonDamagePercent = getSummonDamagePercent(
    sourceSkillName,
    selectedSkillLevel,
    effectiveSkillMap
  );
  const auraPercent = activeAuras.reduce(
    (total, aura) => total + getAuraPhysicalDamagePercent(aura),
    0
  );
  const totalPhysicalBonusPercent = summonDamagePercent + auraPercent;
  const basePhysicalDamage = sumDamageComponents(
    baseComponents,
    (component) => component.damageType === "physical"
  );
  const scaledBaseComponents = baseComponents.map((component) => {
    if (component.damageType !== "physical") {
      return component;
    }

    const duplicateDirectPercent = getDuplicateDirectSummonDamagePercent(
      component,
      sourceSkillName,
      selectedSkillRow,
      selectedSkillLevel,
      effectiveSkillMap
    );
    const componentPhysicalBonusPercent =
      Math.max(0, summonDamagePercent - duplicateDirectPercent) + auraPercent;
    return scalePhysicalDamageComponent(
      component,
      1 + componentPhysicalBonusPercent / 100
    );
  });
  const auraElementalComponents: DamageComponent[] = [];
  activeAuras.forEach((aura) => {
    const addition = getAuraAttackDamage(aura, effectiveSkillMap, realStats);
    (["fire", "cold", "lightning", "magic"] as const).forEach((element) => {
      const damage = addition[element];
      if (!isNonZeroDamageRange(damage)) {
        return;
      }

      auraElementalComponents.push(
        createDamageComponent({
          id: `summon-aura-${aura.name}-${aura.level}-${aura.carrier}-${element}`,
          label: `${aura.name} ${element}`,
          source: "aura",
          damageType: element,
          damage,
          sourceRefs: [
            {
              table: "Skills.txt",
              row: getAuraFormulaSkillName(aura.name),
              columns: [
                "aurastat*",
                "aurastatcalc*",
                "passivestat*",
                "passivecalc*",
                "EType",
                "EMin",
                "EMax",
                "EDmgSymPerCalc",
              ],
              note: "Summon profiles apply selected attack auras as party aura payloads.",
            },
          ],
        })
      );
    });

    const poisonComponent = createAuraPoisonDamageComponent(
      aura,
      effectiveSkillMap,
      realStats,
      "summon-aura",
      "Summon profiles apply selected attack auras as party aura payloads; self-only poison buffs are not applied."
    );
    if (poisonComponent) {
      auraElementalComponents.push(poisonComponent);
    }
  });

  const damageComponents = [
    ...scaledBaseComponents,
    ...auraElementalComponents,
  ].filter((component) => isNonZeroDamageRange(component.damage));
  const damageTotals = buildDamageTotals(damageComponents);
  const auraPulseDamageComponents = [
    ...getActiveAuraPulseDamageComponents(
      activeAuras,
      effectiveSkillMap,
      realStats,
      "summon-active-aura-pulse"
    ),
    ...(selectedSkillRow
      ? getSummonedAuraPulseDamageComponents(
          sourceSkillName,
          selectedSkillRow,
          selectedSkillLevel,
          effectiveSkillMap,
          realStats
        )
      : []),
  ];
  const totalPhysicalDamage =
    damageTotals.byElement.physical || createEmptyDamageRange();
  const totalElementalDamage = elementalDamageFromTotals(damageTotals);
  const damageScope = getDamageScope(
    sourceSkillName,
    selectedSkillLevel,
    effectiveSkillMap,
    "summon",
    weaponSelection
  );
  const notes = getSummonModeNotes(
    sourceSkillName,
    selectedSkillRow,
    variantDefinition
  );

  return {
    key: `${weaponSelection.option.id}::${skillOption.id}::${playerAuraOption.id}:${playerAuraOption.level}::party`,
    weaponId: weaponSelection.option.id,
    skillId: skillOption.id,
    playerAuraId: playerAuraOption.id,
    playerAuraCarrier: playerAuraOption.id === "none" ? "self" : "party",
    playerAuraLevel: playerAuraOption.level,
    transformationId: "none",
    skillDamageMode: "summon",
    skillName: skillOption.name,
    sourceSkillName,
    summonVariant: skillOption.summonVariant,
    skillLevel: selectedSkillLevel,
    selectedPlayerAura:
      playerAuraOption.id === "none"
        ? undefined
        : {
            name: playerAuraOption.name,
            level: selectedPlayerAura?.level || playerAuraOption.level,
            carrier: "party",
          },
    activeAuras: activeAuras.map(summarizeAuraSource),
    damageScope,
    damageComponents,
    damageTotals,
    ...getAuraPulseProfileFields(auraPulseDamageComponents),
    totalPhysicalDamage,
    totalElementalDamage,
    totalPoisonDamage: damageTotals.poisonDamage,
    totalDamage: damageTotals.combinedDamage,
    averageHitDamage: damageTotals.averageCombinedDamage,
    breakdown: {
      weaponDamage: basePhysicalDamage,
      flatPhysicalDamage: createEmptyDamageRange(),
      physicalBonusPercent: {
        stat: 0,
        nonWeapon: 0,
        passive: 0,
        selectedSkill: Number(summonDamagePercent.toFixed(1)),
        selectedSkillSynergy: 0,
        transformation: 0,
        activeAuras: Number(auraPercent.toFixed(1)),
        total: Number(totalPhysicalBonusPercent.toFixed(1)),
      },
      elementalDamage: totalElementalDamage,
      poisonDamage: damageTotals.poisonDamage,
    },
    notes,
  };
}

function buildSpellProfile(
  context: WeaponSetContext,
  weaponSelection: WeaponSelection,
  skillOption: DamageSkillOption,
  playerAuraSelection: AuraSelection
): DamageProfile {
  const { option: playerAuraOption, carrier: playerAuraCarrier } =
    playerAuraSelection;
  const { alwaysActiveAuras, realStats, skillMap } = context;
  const selectedPlayerAura =
    playerAuraOption.id === "none"
      ? undefined
      : {
          name: playerAuraOption.name,
          level:
            getSkillEntry(skillMap, playerAuraOption.name).level ||
            playerAuraOption.level,
          source:
            playerAuraOption.source === "character_skill" &&
            playerAuraCarrier === "self"
              ? ("player_skill" as const)
              : ("manual" as const),
          carrier: playerAuraCarrier,
        };
  const activeAuras = dedupeAuras([
    ...alwaysActiveAuras,
    ...(selectedPlayerAura ? [selectedPlayerAura] : []),
  ]);
  const effectiveSkillMap = applyAuraSkillLevelBonuses(skillMap, activeAuras);
  const selectedSkillLevel =
    getSkillEntry(effectiveSkillMap, skillOption.name).level ||
    skillOption.level;
  const directDamage = getDirectSkillDamage(
    skillOption.name,
    selectedSkillLevel,
    effectiveSkillMap,
    realStats
  );
  const damageComponents = directSkillDamageToComponents(
    skillOption.name,
    directDamage
  );
  const directPhysicalSynergyPercent = getDirectPhysicalSkillSynergyPercent(
    skillOption.name,
    effectiveSkillMap
  );
  const damageTotals = buildDamageTotals(damageComponents);
  const auraPulseDamageComponents = getActiveAuraPulseDamageComponents(
    activeAuras,
    effectiveSkillMap,
    realStats,
    "spell-active-aura-pulse"
  );
  const totalPhysicalDamage =
    damageTotals.byElement.physical || createEmptyDamageRange();
  const totalElementalDamage = elementalDamageFromTotals(damageTotals);
  const damageScope = getDamageScope(
    skillOption.name,
    selectedSkillLevel,
    effectiveSkillMap,
    "spell",
    weaponSelection
  );
  const auraSkillLevelBonus = getTotalAuraSkillLevelBonus(activeAuras);
  const notes: string[] = [];
  if (playerAuraOption.id !== "none") {
    if (auraSkillLevelBonus > 0) {
      notes.push(
        `Selected aura all-skills bonus (+${auraSkillLevelBonus}) is applied to this spell profile.`
      );
    }

    notes.push(
      "Selected attack aura damage payloads are not applied to spell damage."
    );
  }

  return {
    key: `${weaponSelection.option.id}::${skillOption.id}::${playerAuraOption.id}:${playerAuraOption.level}::${playerAuraCarrier}`,
    weaponId: weaponSelection.option.id,
    skillId: skillOption.id,
    playerAuraId: playerAuraOption.id,
    playerAuraCarrier,
    playerAuraLevel: playerAuraOption.level,
    transformationId: "none",
    skillDamageMode: "spell",
    skillName: skillOption.name,
    skillLevel: selectedSkillLevel,
    selectedPlayerAura:
      playerAuraOption.id === "none"
        ? undefined
        : {
            name: playerAuraOption.name,
            level: selectedPlayerAura?.level || playerAuraOption.level,
            carrier: playerAuraCarrier,
          },
    activeAuras: activeAuras.map(summarizeAuraSource),
    damageScope,
    damageComponents,
    damageTotals,
    ...getAuraPulseProfileFields(auraPulseDamageComponents),
    totalPhysicalDamage,
    totalElementalDamage,
    totalPoisonDamage: damageTotals.poisonDamage,
    totalDamage: damageTotals.combinedDamage,
    averageHitDamage: damageTotals.averageCombinedDamage,
    breakdown: {
      weaponDamage: createEmptyDamageRange(),
      flatPhysicalDamage: createEmptyDamageRange(),
      physicalBonusPercent: {
        stat: 0,
        nonWeapon: 0,
        passive: 0,
        selectedSkill: 0,
        selectedSkillSynergy: directPhysicalSynergyPercent,
        transformation: 0,
        activeAuras: 0,
        total: directPhysicalSynergyPercent,
      },
      elementalDamage: totalElementalDamage,
      poisonDamage: damageTotals.poisonDamage,
    },
    notes,
  };
}

function buildSequenceProfile(
  characterData: CharacterData,
  context: WeaponSetContext,
  weaponSelection: WeaponSelection,
  skillOption: DamageSkillOption,
  playerAuraSelection: AuraSelection
): DamageProfile {
  const sequenceHits = weaponSelection.sequenceHits || [];
  const hitProfiles = sequenceHits.map((hit) => ({
    hit,
    profile: buildProfile(
      characterData,
      context,
      hit.selection,
      skillOption,
      playerAuraSelection
    ),
  }));
  const damageComponents = hitProfiles.flatMap(({ hit, profile }, index) =>
    profile.damageComponents.map((component) => ({
      ...component,
      id: `sequence:${index + 1}:${component.id}`,
      label: `${hit.label}: ${component.label}`,
    }))
  );
  const auraPulseDamageComponents = hitProfiles.flatMap(
    ({ hit, profile }, index) =>
      (profile.auraPulseDamageComponents || []).map((component) => ({
        ...component,
        id: `sequence:${index + 1}:${component.id}`,
        label: `${hit.label}: ${component.label}`,
      }))
  );
  const damageTotals = buildDamageTotals(damageComponents);
  const totalPhysicalDamage =
    damageTotals.byElement.physical || createEmptyDamageRange();
  const totalElementalDamage = elementalDamageFromTotals(damageTotals);
  const totalDamage = damageTotals.combinedDamage;
  const firstProfile = hitProfiles[0]?.profile;
  const selectedSkillLevel = firstProfile?.skillLevel ?? skillOption.level;
  const sourceSkillName = skillOption.sourceSkillName || skillOption.name;
  const damageScope =
    getChargeDamageScope(
      skillOption,
      skillOption.name,
      sourceSkillName
    ) ||
    getDamageScope(
      sourceSkillName,
      selectedSkillLevel,
      context.skillMap,
      "weapon",
      weaponSelection
    );
  const sequenceEvidence = getSkillWeaponSequenceEvidence(
    sourceSkillName,
    weaponSelection.option.handMode
  );
  const notes = uniqueStrings([
    ...hitProfiles.flatMap(({ profile }) => profile.notes),
    sequenceEvidence.note,
    "Weapon sequence totals sum independent hit components; attack speed, animation timing, movement-duration hit frequency, hit chance, and target count are not included.",
  ]);

  return {
    key: `${weaponSelection.option.id}::${skillOption.id}${getSkillProfileKeySuffix(skillOption)}::${playerAuraSelection.option.id}:${playerAuraSelection.option.level}::${playerAuraSelection.carrier}`,
    weaponId: weaponSelection.option.id,
    skillId: skillOption.id,
    playerAuraId: firstProfile?.playerAuraId ?? playerAuraSelection.option.id,
    playerAuraCarrier:
      firstProfile?.playerAuraCarrier ?? playerAuraSelection.carrier,
    playerAuraLevel:
      firstProfile?.playerAuraLevel ?? playerAuraSelection.option.level,
    transformationId: "none",
    skillDamageMode: "weapon",
    skillName: skillOption.name,
    sourceSkillName: skillOption.sourceSkillName,
    chargeVariant: skillOption.chargeVariant,
    chargeNumber: skillOption.chargeNumber,
    chargeCount: skillOption.chargeCount,
    chargeLabel: skillOption.chargeLabel,
    skillLevel: selectedSkillLevel,
    sequenceHits: weaponSelection.option.sequenceHits,
    selectedPlayerAura: firstProfile?.selectedPlayerAura,
    activeAuras: firstProfile?.activeAuras ?? [],
    damageScope,
    damageComponents,
    damageTotals,
    ...getAuraPulseProfileFields(auraPulseDamageComponents),
    totalPhysicalDamage,
    totalElementalDamage,
    totalPoisonDamage: damageTotals.poisonDamage,
    totalDamage,
    averageHitDamage: damageTotals.averageCombinedDamage,
    breakdown: {
      weaponDamage: hitProfiles.reduce(
        (total, { profile }) =>
          addDamageRange(total, profile.breakdown.weaponDamage),
        createEmptyDamageRange()
      ),
      flatPhysicalDamage: hitProfiles.reduce(
        (total, { profile }) =>
          addDamageRange(total, profile.breakdown.flatPhysicalDamage),
        createEmptyDamageRange()
      ),
      physicalBonusPercent: firstProfile?.breakdown.physicalBonusPercent ?? {
        stat: 0,
        nonWeapon: 0,
        passive: 0,
        selectedSkill: 0,
        selectedSkillSynergy: 0,
        transformation: 0,
        activeAuras: 0,
        total: 0,
      },
      elementalDamage: totalElementalDamage,
      poisonDamage: damageTotals.poisonDamage,
    },
    notes,
  };
}

function buildProfile(
  characterData: CharacterData,
  context: WeaponSetContext,
  weaponSelection: WeaponSelection,
  skillOption: DamageSkillOption,
  playerAuraSelection: AuraSelection
): DamageProfile {
  if (skillOption.damageMode === "summon") {
    return buildSummonProfile(
      context,
      weaponSelection,
      skillOption,
      playerAuraSelection
    );
  }

  if (skillOption.damageMode === "spell") {
    return buildSpellProfile(
      context,
      weaponSelection,
      skillOption,
      playerAuraSelection
    );
  }

  if (weaponSelection.sequenceHits?.length) {
    return buildSequenceProfile(
      characterData,
      context,
      weaponSelection,
      skillOption,
      playerAuraSelection
    );
  }

  const { option: playerAuraOption, carrier: playerAuraCarrier } =
    playerAuraSelection;
  const { alwaysActiveAuras, playerItems, realStats, skillMap } = context;
  const characterClass = characterData.character.class.name;
  const displaySkillName = skillOption.name;
  const selectedSkillName = skillOption.sourceSkillName || skillOption.name;

  const selectedPlayerAura =
    playerAuraOption.id === "none"
      ? undefined
      : {
          name: playerAuraOption.name,
          level:
            getSkillEntry(skillMap, playerAuraOption.name).level ||
            playerAuraOption.level,
          source:
            playerAuraOption.source === "character_skill" &&
            playerAuraCarrier === "self"
              ? ("player_skill" as const)
              : ("manual" as const),
          carrier: playerAuraCarrier,
        };

  const activeAuras = dedupeAuras([
    ...alwaysActiveAuras,
    ...(selectedPlayerAura ? [selectedPlayerAura] : []),
  ]);
  const effectiveSkillMap = applyAuraSkillLevelBonuses(skillMap, activeAuras);
  const selectedSkillLevel =
    displaySkillName === "Basic Attack"
      ? 1
      : getSkillEntry(effectiveSkillMap, displaySkillName).level ||
        getSkillEntry(effectiveSkillMap, selectedSkillName).level ||
        skillOption.level;

  const parsedItemDamage = parseItemDamageStats(playerItems, weaponSelection);
  const statBonusPercent = getStatBonusPercent(
    characterClass,
    weaponSelection,
    realStats?.strength ?? characterData.character.attributes.strength,
    realStats?.dexterity ?? characterData.character.attributes.dexterity
  );
  const passivePercent = getPassiveSkillDamagePercent(
    characterClass,
    weaponSelection,
    effectiveSkillMap
  );
  const selectedSkillPercent =
    selectedSkillName === "Basic Attack"
      ? 0
      : getChargeVariantSelectedSkillDamagePercent(
          skillOption,
          selectedSkillName,
          selectedSkillLevel,
          effectiveSkillMap
        ) ??
        getSelectedSkillDamagePercent(
          selectedSkillName,
          selectedSkillLevel,
          effectiveSkillMap
        );
  const selectedSkillSynergies =
    selectedSkillName === "Basic Attack"
      ? {
          physicalPct: 0,
          firePct: 0,
          coldPct: 0,
          lightningPct: 0,
          magicPct: 0,
          poisonPct: 0,
        }
      : getSkillSynergyBonuses(selectedSkillName, effectiveSkillMap);
  const auraPercent = activeAuras.reduce(
    (total, aura) => total + getAuraPhysicalDamagePercent(aura),
    0
  );

  const totalPhysicalBonusPercent =
    statBonusPercent +
    parsedItemDamage.nonWeaponEnhancedDamagePct +
    passivePercent +
    selectedSkillPercent +
    selectedSkillSynergies.physicalPct +
    auraPercent;

  const directDamage =
    selectedSkillName === "Basic Attack" || isVengeanceSkill(selectedSkillName)
      ? createEmptyDirectSkillDamage()
      : getDirectSkillDamage(
          selectedSkillName,
          selectedSkillLevel,
          effectiveSkillMap,
          realStats
        );
  const directDamageComponents =
    selectedSkillName === "Basic Attack"
      ? []
      : getChargeVariantDamageComponents(
          skillOption,
          selectedSkillName,
          directSkillDamageToComponents(selectedSkillName, directDamage)
        );
  const selectedSkillRow =
    selectedSkillName === "Basic Attack"
      ? undefined
      : getGameRow("Skills", selectedSkillName);
  const weaponSourceSrcDam = selectedSkillRow
    ? getGameRowNumber("Skills", selectedSkillRow, "SrcDam")
    : 0;
  const weaponSourceModifier = getWeaponSourceDamageModifier(selectedSkillName);
  const carriedWeaponDamage = {
    min: Math.floor(weaponSelection.damage.min * weaponSourceModifier),
    max: Math.floor(weaponSelection.damage.max * weaponSourceModifier),
  };
  const usesKickSource = weaponSelection.option.handMode === "kick";
  const weaponSourceLabel = usesKickSource
    ? selectedSkillName === "Basic Attack"
      ? "Boot source"
      : `Boot source (${displaySkillName})`
    : selectedSkillName === "Basic Attack"
      ? "Weapon source"
      : `Weapon source (${displaySkillName})`;
  const equipmentDamageSourceRefs =
    weaponSelection.damageSourceRefs &&
    weaponSelection.damageSourceRefs.length > 0
      ? weaponSelection.damageSourceRefs
      : [
          {
            table: "Character equipment",
            row: weaponSelection.item.name,
            columns: [usesKickSource ? "boot kick damage" : "weapon damage"],
          },
        ];
  const selectedSkillSourceNote = usesKickSource
    ? "Kick=1 marks this as a boot-sourced kick attack in the game-file skill row."
    : weaponSourceSrcDam > 0
      ? `SrcDam=${weaponSourceSrcDam} is the game-file source-damage scalar; the extracted files expose the raw value but not the engine denominator.`
      : "Source-damage and attack-signal fields are preserved from game files; opaque engine function behavior is not inferred.";
  const flatAndSkillPhysicalDamage = addDamageRange(
    parsedItemDamage.flatPhysicalDamage,
    directDamageComponents
      .filter((component) => component.damageType === "physical")
      .reduce(
        (total, component) => addDamageRange(total, component.damage),
        createEmptyDamageRange()
      )
  );
  const physicalMultiplier = 1 + totalPhysicalBonusPercent / 100;
  const physicalBaseComponents: DamageComponent[] = [];

  if (isNonZeroDamageRange(carriedWeaponDamage)) {
    physicalBaseComponents.push(
      createDamageComponent({
        id: `weapon:${weaponSelection.option.id}:${selectedSkillName}`,
        label: weaponSourceLabel,
        source: "weapon",
        damageType: "physical",
        damage: carriedWeaponDamage,
        baseDamage: carriedWeaponDamage,
        sourceRefs: [
          ...equipmentDamageSourceRefs,
          ...(selectedSkillName === "Basic Attack"
            ? []
            : [
                {
                  table: "Skills.txt",
                  row: selectedSkillName,
                  columns: usesKickSource
                    ? ["Kick", "leftskill", "descatt"]
                    : ["SrcDam", "leftskill", "descatt"],
                  note: selectedSkillSourceNote,
                },
              ]),
        ],
      })
    );
  }

  if (isNonZeroDamageRange(parsedItemDamage.flatPhysicalDamage)) {
    physicalBaseComponents.push(
      createDamageComponent({
        id: `item-flat-physical:${weaponSelection.option.id}`,
        label: "Item flat physical",
        source: "item",
        damageType: "physical",
        damage: parsedItemDamage.flatPhysicalDamage,
        baseDamage: parsedItemDamage.flatPhysicalDamage,
        sourceRefs: [
          {
            table: "Armory item text",
            columns: ["+minimum damage", "+maximum damage", "adds damage"],
          },
        ],
      })
    );
  }

  directDamageComponents
    .filter((component) => component.damageType === "physical")
    .forEach((component) => {
      physicalBaseComponents.push({
        ...component,
        baseDamage: component.damage,
      });
    });

  const physicalComponents = physicalBaseComponents.map((component) =>
    scalePhysicalDamageComponent(component, physicalMultiplier)
  );

  const itemElementalComponents: DamageComponent[] = [];
  (["fire", "cold", "lightning", "magic"] as const).forEach((element) => {
    if (
      isVengeanceSkill(selectedSkillName) &&
      (element === "fire" || element === "cold" || element === "lightning")
    ) {
      return;
    }

    const damage = parsedItemDamage.elementalDamage[element];
    if (!isNonZeroDamageRange(damage)) {
      return;
    }

    const elementalSkillDamageBonus =
      getElementalSkillDamageBonusPercent(element, realStats);
    const scaledDamage = scaleDamageRange(damage, elementalSkillDamageBonus);

    itemElementalComponents.push(
      createDamageComponent({
        id: `item-${element}:${weaponSelection.option.id}`,
        label: `Item ${element}`,
        source: "item",
        damageType: element,
        damage: scaledDamage,
        baseDamage: damage,
        sourceRefs: [
          {
            table: "Properties.txt / ItemStatCost.txt / Armory item modifiers",
            columns: [
              "elemental min/max stats",
              `adds ${element} damage`,
              `minimum ${element} damage`,
              `maximum ${element} damage`,
            ],
            note:
              elementalSkillDamageBonus !== 0
                ? `Item ${element} damage is scaled by +${elementalSkillDamageBonus}% ${element} skill damage.`
                : undefined,
          },
        ],
      })
    );
  });

  const skillPayloadComponents = directDamageComponents.filter(
    (component) => component.damageType !== "physical"
  );
  const weaponElementalDamageComponents =
    selectedSkillName === "Basic Attack"
      ? []
      : isVengeanceSkill(selectedSkillName)
        ? createVengeanceElementalDamageComponents(
            selectedSkillName,
            selectedSkillLevel,
            effectiveSkillMap,
            carriedWeaponDamage,
            parsedItemDamage.elementalDamage,
            realStats
          )
        : createWeaponElementalDamageComponents(
            selectedSkillName,
            selectedSkillLevel,
            effectiveSkillMap,
            carriedWeaponDamage,
            realStats
          );

  const auraElementalComponents: DamageComponent[] = [];
  activeAuras.forEach((aura) => {
    const addition = getAuraAttackDamage(aura, effectiveSkillMap, realStats);
    (["fire", "cold", "lightning", "magic"] as const).forEach((element) => {
      const damage = addition[element];
      if (!isNonZeroDamageRange(damage)) {
        return;
      }

      auraElementalComponents.push(
        createDamageComponent({
          id: `aura-${aura.name}-${aura.level}-${aura.carrier}-${element}`,
          label: `${aura.name} ${element}`,
          source: "aura",
          damageType: element,
          damage,
          sourceRefs: [
            {
              table: "Skills.txt",
              row: getAuraFormulaSkillName(aura.name),
              columns: [
                "aurastat*",
                "aurastatcalc*",
                "passivestat*",
                "passivecalc*",
                "EType",
                "EMin",
                "EMax",
                "EDmgSymPerCalc",
              ],
            },
          ],
        })
      );
    });

    const poisonComponent = createAuraPoisonDamageComponent(
      aura,
      effectiveSkillMap,
      realStats,
      "aura"
    );
    if (poisonComponent) {
      auraElementalComponents.push(poisonComponent);
    }
  });

  const itemPoisonComponents = parsedItemDamage.poisonDamage
    ? [
        createDamageComponent({
          id: `item-poison:${weaponSelection.option.id}`,
          label: "Item poison",
          source: "item",
          damageType: "poison",
          timing: "over_time",
          damage: {
            min: parsedItemDamage.poisonDamage.total,
            max: parsedItemDamage.poisonDamage.total,
          },
          poisonDamage: parsedItemDamage.poisonDamage,
          includedInTotal: false,
          sourceRefs: [
            {
              table: "Armory item text",
              columns: ["poison damage"],
            },
          ],
          notes: [
            "Gear poison is shown separately and excluded from totals because poison rate/length stacking with other sources is not derivable from the armory text payload.",
          ],
        }),
      ]
    : [];

  const damageComponents = [
    ...physicalComponents,
    ...itemElementalComponents,
    ...skillPayloadComponents,
    ...weaponElementalDamageComponents,
    ...auraElementalComponents,
    ...itemPoisonComponents,
  ].filter((component) => isNonZeroDamageRange(component.damage));
  const damageTotals = buildDamageTotals(damageComponents);
  const auraPulseDamageComponents = getActiveAuraPulseDamageComponents(
    activeAuras,
    effectiveSkillMap,
    realStats,
    "weapon-active-aura-pulse"
  );
  const totalPhysicalDamage =
    damageTotals.byElement.physical || createEmptyDamageRange();
  const totalElementalDamage = elementalDamageFromTotals(damageTotals);
  const totalDamage = damageTotals.combinedDamage;
  const damageScope = getDamageScope(
    selectedSkillName,
    selectedSkillLevel,
    effectiveSkillMap,
    "weapon",
    weaponSelection
  );
  const effectiveDamageScope =
    getChargeDamageScope(
      skillOption,
      displaySkillName,
      selectedSkillName
    ) || damageScope;

  const notes: string[] = [];
  if (
    selectedSkillName !== "Basic Attack" &&
    directDamageComponents.some(
      (component) => component.damageType !== "physical"
    )
  ) {
    notes.push(
      `${displaySkillName} includes independent skill or missile payload components from game-file damage fields in addition to weapon-source damage.`
    );
  }

  if (usesKickSource && weaponSelection.baseDamageUnavailable) {
    notes.push(
      "This kick profile uses equipped boots as the attack source from Skills.txt Kick=1, but boot base kick damage is unavailable because Armor.txt is not present in the current extract and the armory payload does not expose boot damage."
    );
  }

  if (usesKickSource && !weaponSelection.item.base?.stat_bonus) {
    notes.push(
      "Kick stat scaling uses the calculator's generic melee strength path because the armory payload does not expose boot StrBonus/DexBonus."
    );
  }

  return {
    key: `${weaponSelection.option.id}::${skillOption.id}${getSkillProfileKeySuffix(skillOption)}::${playerAuraOption.id}:${playerAuraOption.level}::${playerAuraCarrier}`,
    weaponId: weaponSelection.option.id,
    skillId: skillOption.id,
    playerAuraId: playerAuraOption.id,
    playerAuraCarrier,
    playerAuraLevel: playerAuraOption.level,
    transformationId: "none",
    skillDamageMode: "weapon",
    skillName: displaySkillName,
    sourceSkillName: skillOption.sourceSkillName,
    chargeVariant: skillOption.chargeVariant,
    chargeNumber: skillOption.chargeNumber,
    chargeCount: skillOption.chargeCount,
    chargeLabel: skillOption.chargeLabel,
    skillLevel: selectedSkillLevel,
    selectedPlayerAura:
      playerAuraOption.id === "none"
        ? undefined
        : {
            name: playerAuraOption.name,
            level: selectedPlayerAura?.level || playerAuraOption.level,
            carrier: playerAuraCarrier,
          },
    activeAuras: activeAuras.map(summarizeAuraSource),
    damageScope: effectiveDamageScope,
    damageComponents,
    damageTotals,
    ...getAuraPulseProfileFields(auraPulseDamageComponents),
    totalPhysicalDamage,
    totalElementalDamage,
    totalPoisonDamage: damageTotals.poisonDamage,
    totalDamage,
    averageHitDamage: damageTotals.averageCombinedDamage,
    breakdown: {
      weaponDamage: carriedWeaponDamage,
      flatPhysicalDamage: flatAndSkillPhysicalDamage,
      physicalBonusPercent: {
        stat: Number(statBonusPercent.toFixed(1)),
        nonWeapon: parsedItemDamage.nonWeaponEnhancedDamagePct,
        passive: passivePercent,
        selectedSkill: selectedSkillPercent,
        selectedSkillSynergy: Number(
          selectedSkillSynergies.physicalPct.toFixed(1)
        ),
        transformation: 0,
        activeAuras: auraPercent,
        total: Number(totalPhysicalBonusPercent.toFixed(1)),
      },
      elementalDamage: totalElementalDamage,
      poisonDamage: damageTotals.poisonDamage,
    },
    notes,
  };
}

function getPlayerAuraSelectionsForSkill(
  skillOption: DamageSkillOption,
  playerAuraSelections: AuraSelection[]
): AuraSelection[] {
  if (skillOption.damageMode !== "summon") {
    return playerAuraSelections;
  }

  return playerAuraSelections.filter(
    (selection) =>
      selection.option.id === "none" || selection.carrier === "party"
  );
}

function getProfileSkillOptions(
  skillOption: DamageSkillOption
): DamageSkillOption[] {
  if (!skillOption.chargeCount || skillOption.chargeCount <= 0) {
    return [skillOption];
  }

  return Array.from({ length: skillOption.chargeCount }, (_, index) => ({
    ...skillOption,
    chargeVariant: "charge" as const,
    chargeNumber: index + 1,
  }));
}

export function getModeledDamageMechanicCoverage() {
  const skills = getGameTable("Skills");
  return Object.keys(skills.rowsByKey)
    .filter(
      (skillName) => {
        const row = skills.rowsByKey[skillName];
        return (
          isInGamePlayerSkill(row) &&
          (isSelectableAttackSkill(skillName) ||
            isSelectableSpellSkill(skillName) ||
            isSelectableSummonSkill(skillName))
        );
      }
    )
    .map((skillName) => {
      const row = skills.rowsByKey[skillName];
      const damageMode: DamageSkillOption["damageMode"] =
        isSelectableSummonSkill(skillName)
          ? "summon"
          : isSelectableAttackSkill(skillName)
            ? "weapon"
            : "spell";
      return {
        skillName,
        damageScope: getDamageScope(
          skillName,
          20,
          new Map([[skillName, { level: 20, baseLevel: 20 }]]),
          damageMode,
          createUnarmedSelection("primary")
        ),
        periodic: getGameRowString("Skills", row, "periodic") === "1",
        targetCorpse:
          damageMode !== "summon" &&
          getGameRowString("Skills", row, "TargetCorpse") === "1",
        countCalcs: [1, 2, 3, 4]
          .map((index) => ({
            column: `calc${index}`,
            description: getGameRowString(
              "Skills",
              row,
              `*calc${index} desc`
            ),
          }))
          .filter((calc) => calc.description),
      };
    });
}

export function calculateDamage(
  characterData: CharacterData
): DamageCalculation {
  const contexts = buildWeaponSetContexts(characterData);
  const weaponSelections = getWeaponOptions(characterData);

  const skillOptions = collectDamageSkillOptions(contexts);
  const playerAuraOptions = collectPlayerAuraOptions(contexts);
  const playerAuraSelections = collectPlayerAuraSelections(playerAuraOptions);
  const transformationOptions = collectTransformationOptions(contexts);
  const alwaysActiveAuras = dedupeAuras(
    Object.values(contexts).flatMap((context) => context.alwaysActiveAuras)
  );

  const defaultSkill = skillOptions[1] || skillOptions[0];
  const defaultPlayerAura = playerAuraOptions[0];
  const defaultTransformation = transformationOptions[0];

  const profiles = weaponSelections.flatMap((weaponSelection) =>
    skillOptions.flatMap((skillOption) => {
      if (!isWeaponSelectionCompatibleWithSkill(weaponSelection, skillOption)) {
        return [];
      }

      return getProfileSkillOptions(skillOption).flatMap((profileSkillOption) =>
        getPlayerAuraSelectionsForSkill(
          profileSkillOption,
          playerAuraSelections
        ).map((playerAuraSelection) =>
          buildProfile(
            characterData,
            contexts[weaponSelection.weaponSet],
            weaponSelection,
            profileSkillOption,
            playerAuraSelection
          )
        )
      );
    })
  );
  const defaultProfile = getDefaultDamageProfile(profiles);
  const defaultSkillSelection =
    skillOptions.find(
      (skillOption) => skillOption.id === defaultProfile?.skillId
    ) || defaultSkill;
  const defaultTransformationId = getDefaultTransformationSelection(
    defaultSkillSelection,
    transformationOptions,
    defaultProfile?.transformationId ?? defaultTransformation.id
  );

  const notes = [
    "Damage is an estimate built from PD2 game files. Totals combine immediate hit damage with modeled damage-over-time totals, but they do not include attack speed, cast speed, hit chance, target resistances, crushing blow, deadly strike, critical strike, repeated summon attacks, or conditional buffs.",
  ];

  if (weaponSelections.some((selection) => selection.sequenceHits?.length)) {
    notes.push(
      "Some skills can use both equipped weapons. When the game files describe that two-weapon cycle, the calculator shows the paired hit, but it does not estimate how many times the skill hits during a movement path or animation."
    );
  }

  if (skillOptions.some((skillOption) => skillOption.damageMode === "summon")) {
    notes.push(
      "Summon skills show one source-backed per-summon hit when the game files expose stable damage data. Summon count, attack rate, AI choices, hit chance, and uptime are not multiplied into totals."
    );
  }

  if (
    weaponSelections.some(
      (selection) => selection.option.handMode === "unarmed"
    )
  ) {
    notes.push(
      "If a weapon set does not expose readable equipped weapon damage, the calculator falls back to the unarmed 1-2 base damage value."
    );
  }

  return {
    weaponOptions: weaponSelections.map((selection) => selection.option),
    skillOptions,
    playerAuraOptions,
    transformationOptions,
    alwaysActiveAuras: alwaysActiveAuras.map(summarizeAuraSource),
    defaultSelection: {
      weaponId: defaultProfile?.weaponId ?? weaponSelections[0].option.id,
      skillId: defaultProfile?.skillId ?? defaultSkill.id,
      playerAuraId: defaultProfile?.playerAuraId ?? defaultPlayerAura.id,
      playerAuraCarrier: defaultProfile?.playerAuraCarrier ?? "self",
      playerAuraLevel:
        defaultProfile?.playerAuraLevel ?? defaultPlayerAura.level,
      transformationId: defaultTransformationId,
    },
    profiles,
    notes,
  };
}
