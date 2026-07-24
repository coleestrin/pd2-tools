import { THEME_COLORS } from "../../theme";

const PHYSICAL_DAMAGE_COLOR = "#bdbc99";
const COMBINED_DAMAGE_COLOR = "#2dd4bf";

export const STAT_COLORS = {
  life: THEME_COLORS.red,
  mana: THEME_COLORS.blue,
  strength: THEME_COLORS.red,
  dexterity: THEME_COLORS.green,
  vitality: THEME_COLORS.red,
  energy: THEME_COLORS.blue,
  fire: THEME_COLORS.red,
  cold: THEME_COLORS.blue,
  lightning: THEME_COLORS.yellow,
  poison: THEME_COLORS.green,
  magic: THEME_COLORS.orange,
  combinedDamage: COMBINED_DAMAGE_COLOR,
  combinedDamageText: THEME_COLORS.white,
  fasterCastRate: THEME_COLORS.cyan,
  fasterHitRecovery: THEME_COLORS.grape,
  fasterRunWalk: THEME_COLORS.green,
  increasedAttackSpeed: THEME_COLORS.blue,
  crushingBlow: THEME_COLORS.orange,
  criticalStrike: THEME_COLORS.violet,
  deadlyStrike: THEME_COLORS.yellow,
  openWounds: THEME_COLORS.red,
  lifeLeech: THEME_COLORS.red,
  manaLeech: THEME_COLORS.blue,
  magicFind: THEME_COLORS.violet,
  goldFind: THEME_COLORS.yellow,
  physicalDamageReduction: PHYSICAL_DAMAGE_COLOR,
  zeroValue: THEME_COLORS.gray,
} as const;
