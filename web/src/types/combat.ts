import type { DamageElement, DamageRange } from "./damage";
export type CombatResistances = Record<DamageElement, number>;
export interface CombatMonster {
  target?: import("./damage-target").MonsterTarget;
  id: string;
  name: string;
  demon: boolean;
  undead: boolean;
  boss: boolean;
  primeEvil: boolean;
  noRatio: boolean;
  levels: number[];
  defense: number[];
  life: DamageRange[];
  block: number[];
  resistances: CombatResistances[];
}
export interface CombatArea {
  id: string;
  name: string;
  map: boolean;
  levels: number[];
  monsters: string[][];
}
export interface CombatAnimation {
  frames: number;
  speed: number;
  events: number[];
}
export interface CombatCatalog {
  monsters: CombatMonster[];
  areas: CombatArea[];
  pulseRates: Record<string, number>;
  monsterLevels: Array<{ level: number; defense: number[]; life: number[] }>;
  animations: Record<string, CombatAnimation>;
  sequences: Record<string, Record<string, number>>;
}
export interface CombatWeapon {
  hands?: CombatWeapon[];
  skillBonuses?: Array<{
    baseAttackRating?: number;
    pierce: CombatResistances;
    gearIAS: number;
    crushingBlow: number;
    crushingEfficiency: number;
    openWounds: number;
    openWoundsDps: number;
  }>;
  baseAttackRating: number;
  attackRatingPercent: number;
  mastery: number[];
  weaponClass: string;
  ownWeaponClass: string;
  speed: number;
  weaponIAS: number;
  gearIAS: number;
  fcr: number;
  ignoreDefense: boolean;
  targetDefensePercent: number;
  demonAttackRating: number;
  undeadAttackRating: number;
  demonDamage: number;
  undeadDamage: number;
  crushingBlow: number;
  crushingEfficiency: number;
  openWounds: number;
  openWoundsDps: number;
  pierce: CombatResistances;
}
export interface CombatSkillLevel {
  attackRatingPercent: number;
  cooldown: number;
  attackSpeed: number;
  hits: number;
  crushingBlow?: number;
  crushingEfficiency?: number;
  reductions: CombatResistances;
  pierce: CombatResistances;
}
export interface CombatSkill {
  animation: string;
  sequence: string;
  attackRate: boolean;
  rollback: number;
  levels: CombatSkillLevel[];
}
export interface CombatAuraLevel {
  selfAttackRatingPercent?: number;
  attackSpeed: number;
  attackRatingPercent: number;
  defensePercent: number;
  defenseFlat: number;
  reductions: CombatResistances;
  openWounds?: number;
  openWoundsDps?: number;
  selfOpenWoundsDps?: number;
}
export interface DamageCombatData {
  commandSelfBonuses?: number[];
  commandPartyBonuses?: number[];
  auraPulses?: Record<
    "primary" | "secondary",
    Record<string, Partial<Record<DamageElement, DamageRange>>[]>
  >;
  werewolfAttackRatingBonuses?: number[];
  level: number;
  classToken: string;
  weapons: Record<string, CombatWeapon>;
  skills: Record<string, CombatSkill>;
  effects: Record<string, CombatAuraLevel[]>;
}
export interface CombatSettings {
  protected?: boolean;
  immunityAura?: boolean;
  mapBoss: boolean;
  attackSlow: number;
  castSlow: number;
  difficulty: number;
  areaId: string | null;
  monsterId: string;
  players: number;
  levelBonus: number;
  defenseBonus: number;
  lifeBonus: number;
  resistanceBonus: CombatResistances;
  debuffs: Array<{ name: string; level: number }>;
  rateOverride: number | null;
  hitChanceOverride: number | null;
  blockChanceOverride: number | null;
  uptime: number;
  overlap: number;
  summonCount: number;
  currentLifePercent: number;
}
export interface EffectiveCombatResult {
  monster: CombatMonster;
  level: number;
  defense: number;
  life: DamageRange;
  raw: DamageRange;
  landed: DamageRange;
  expected: DamageRange;
  resistances: CombatResistances;
  hitChance: number | null;
  attackRating: number | null;
  actionsPerSecond: number | null;
  frames: number | null;
  dps: number | null;
  instantDps: number | null;
  dotDps: number | null;
  auraPulseDps: number;
  crushingDps: number;
  openWoundsDps: number;
  components: Array<{
    id: string;
    element: DamageElement;
    raw: DamageRange;
    landed: DamageRange;
    multiplier: number;
  }>;
  absorptionHealing?: DamageRange;
  notes: string[];
}
