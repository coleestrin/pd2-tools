export interface DamageRange {
  min: number;
  max: number;
}

export interface PoisonDamage {
  total: number;
  durationSeconds: number;
}

export interface PoisonDamagePayload extends PoisonDamage {
  damage: DamageRange;
}

export type DamageElement =
  | "physical"
  | "fire"
  | "cold"
  | "lightning"
  | "magic"
  | "poison";

export type DamageComponentSource =
  | "weapon"
  | "item"
  | "skill"
  | "summon"
  | "monster"
  | "missile"
  | "aura"
  | "passive"
  | "stat"
  | "transformation"
  | "unknown";

export type DamageComponentTiming = "instant" | "over_time";

export interface DamageSourceReference {
  table: string;
  row?: string;
  columns: string[];
  note?: string;
}

export interface DamageComponent {
  id: string;
  label: string;
  source: DamageComponentSource;
  damageType: DamageElement;
  timing: DamageComponentTiming;
  damage: DamageRange;
  baseDamage?: DamageRange;
  poisonDamage?: PoisonDamage;
  includedInTotal?: boolean;
  sourceRefs: DamageSourceReference[];
  notes: string[];
}

export interface DamageTotals {
  instantDamage: DamageRange;
  overTimeDamage: DamageRange;
  combinedDamage: DamageRange;
  averageInstantDamage: number;
  averageCombinedDamage: number;
  byElement: Partial<Record<DamageElement, DamageRange>>;
  poisonDamage?: PoisonDamage;
}

export interface DamageWeaponOption {
  id: string;
  label: string;
  weaponSet: "primary" | "secondary";
  slot: "right" | "left" | "feet" | "summon";
  handMode:
    | "one_handed"
    | "two_handed"
    | "missile"
    | "kick"
    | "summon"
    | "unarmed"
    | "dual_wield"
    | "dual_throw";
  itemName: string;
  baseName: string;
  weaponType: string;
  sequenceHits?: DamageSequenceHit[];
}

export interface DamageSkillOption {
  id: string;
  name: string;
  level: number;
  damageMode: "weapon" | "spell" | "summon";
  sourceSkillName?: string;
  summonVariant?: string;
  chargeVariant?: "average" | "charge";
  chargeNumber?: number;
  chargeCount?: number;
  defaultChargeNumber?: number;
  chargeLabel?: string;
  canUseTransformation: boolean;
  allowedTransformationIds: string[];
}

export interface DamageAuraOption {
  id: string;
  name: string;
  level: number;
  levelOptions: number[];
  levelBonuses: DamageAuraLevelBonus[];
  selfLevelBonuses: DamageAuraLevelBonus[];
  partyLevelBonuses: DamageAuraLevelBonus[];
  source: "none" | "character_skill" | "manual";
}

export interface DamageAuraLevelBonus {
  level: number;
  skillLevelBonus: number;
  physicalBonusPercent: number;
  elementalDamage: Partial<
    Record<Exclude<DamageElement, "physical" | "poison">, DamageRange>
  >;
  poisonDamage?: PoisonDamagePayload;
}

export interface DamageTransformationOption {
  id: string;
  name: string;
  level: number;
  levelOptions: number[];
  levelBonuses: Array<{
    level: number;
    physicalBonusPercent: number;
  }>;
}

export interface ActiveAuraSummary {
  name: string;
  level: number;
  source:
    | "player_skill"
    | "player_item"
    | "mercenary_native"
    | "mercenary_item"
    | "manual";
  carrier: "self" | "party";
}

export interface DamageSequenceHit {
  label: string;
  weaponId: string;
  weaponSet: "primary" | "secondary";
  slot: "right" | "left";
  handMode: "one_handed" | "two_handed" | "missile" | "unarmed";
  itemName: string;
}

export interface DamageProfileBreakdown {
  weaponDamage: DamageRange;
  flatPhysicalDamage: DamageRange;
  physicalBonusPercent: {
    stat: number;
    nonWeapon: number;
    passive: number;
    selectedSkill: number;
    selectedSkillSynergy: number;
    transformation: number;
    activeAuras: number;
    total: number;
  };
  elementalDamage: Partial<
    Record<Exclude<DamageElement, "physical" | "poison">, DamageRange>
  >;
  poisonDamage?: PoisonDamage;
}

export interface DamageProfileScope {
  label: string;
  count?: number;
  countLabel?: string;
  note: string;
  sourceRefs: DamageSourceReference[];
}

export interface DamageProfile {
  key: string;
  weaponId: string;
  skillId: string;
  playerAuraId: string;
  playerAuraCarrier: "self" | "party";
  playerAuraLevel: number;
  transformationId: string;
  skillDamageMode: "weapon" | "spell" | "summon";
  skillName: string;
  sourceSkillName?: string;
  summonVariant?: string;
  chargeVariant?: "average" | "charge";
  chargeNumber?: number;
  chargeCount?: number;
  chargeLabel?: string;
  skillLevel: number;
  sequenceHits?: DamageSequenceHit[];
  selectedPlayerAura?: {
    name: string;
    level: number;
    carrier: "self" | "party";
  };
  selectedTransformation?: {
    name: string;
    level: number;
  };
  activeAuras: ActiveAuraSummary[];
  damageScope: DamageProfileScope;
  damageComponents: DamageComponent[];
  damageTotals: DamageTotals;
  auraPulseDamageComponents?: DamageComponent[];
  auraPulseDamageTotals?: DamageTotals;
  totalPhysicalDamage: DamageRange;
  totalElementalDamage: Partial<
    Record<Exclude<DamageElement, "physical" | "poison">, DamageRange>
  >;
  totalPoisonDamage?: PoisonDamage;
  totalDamage: DamageRange;
  averageHitDamage: number;
  breakdown: DamageProfileBreakdown;
  notes: string[];
}

export interface DamageCalculation {
  weaponOptions: DamageWeaponOption[];
  skillOptions: DamageSkillOption[];
  playerAuraOptions: DamageAuraOption[];
  transformationOptions: DamageTransformationOption[];
  alwaysActiveAuras: ActiveAuraSummary[];
  defaultSelection?: {
    weaponId: string;
    skillId: string;
    playerAuraId: string;
    playerAuraCarrier: "self" | "party";
    playerAuraLevel: number;
    transformationId: string;
  };
  profiles: DamageProfile[];
  notes: string[];
}
