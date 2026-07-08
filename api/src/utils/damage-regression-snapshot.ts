import {
  DamageCalculation,
  DamageComponent,
  DamageProfile,
  DamageRange,
  DamageSkillOption,
  DamageTotals,
  PoisonDamage,
} from "../types";

export interface DamageRegressionComponentSummary {
  label: string;
  source: DamageComponent["source"];
  damageType: DamageComponent["damageType"];
  timing: DamageComponent["timing"];
  damage: DamageRange;
  baseDamage?: DamageRange;
  poisonDamage?: PoisonDamage;
}

export interface DamageRegressionExpectedProfile {
  key: string;
  weaponId: string;
  skillId: string;
  skillName: string;
  sourceSkillName?: string;
  summonVariant?: string;
  chargeVariant?: DamageProfile["chargeVariant"];
  chargeNumber?: number;
  chargeCount?: number;
  chargeLabel?: string;
  skillLevel: number;
  skillDamageMode: DamageProfile["skillDamageMode"];
  playerAuraId: string;
  playerAuraCarrier: DamageProfile["playerAuraCarrier"];
  playerAuraLevel: number;
  transformationId: string;
  damageScope: Pick<DamageProfile["damageScope"], "label" | "count" | "countLabel">;
  damageTotals: DamageTotals;
  auraPulseDamageTotals?: DamageTotals;
  totalPhysicalDamage: DamageRange;
  totalElementalDamage: DamageProfile["totalElementalDamage"];
  totalPoisonDamage?: PoisonDamage;
  breakdown: DamageProfile["breakdown"];
  damageComponents: DamageRegressionComponentSummary[];
  auraPulseDamageComponents?: DamageRegressionComponentSummary[];
}

export interface DamageRegressionExpected {
  skillOption: Pick<
    DamageSkillOption,
    | "id"
    | "name"
    | "level"
    | "damageMode"
    | "sourceSkillName"
    | "summonVariant"
    | "chargeCount"
    | "defaultChargeNumber"
    | "chargeLabel"
  >;
  profile: DamageRegressionExpectedProfile;
}

export function normalizeRegressionSkillName(skillName: string): string {
  return skillName.trim().toLowerCase();
}

export function getDamageProfileScore(profile: DamageProfile): number {
  return profile.damageTotals.averageCombinedDamage;
}

export function pickHigherDamageProfile(
  left: DamageProfile,
  right: DamageProfile
): DamageProfile {
  const leftScore = [
    left.damageTotals.averageCombinedDamage,
    left.damageTotals.combinedDamage.max,
    left.damageTotals.combinedDamage.min,
  ];
  const rightScore = [
    right.damageTotals.averageCombinedDamage,
    right.damageTotals.combinedDamage.max,
    right.damageTotals.combinedDamage.min,
  ];

  for (let index = 0; index < leftScore.length; index += 1) {
    if (leftScore[index] !== rightScore[index]) {
      return leftScore[index] > rightScore[index] ? left : right;
    }
  }

  return left;
}

export function getBestProfile(
  profiles: DamageProfile[]
): DamageProfile | undefined {
  return profiles.reduce<DamageProfile | undefined>(
    (best, profile) =>
      best ? pickHigherDamageProfile(best, profile) : profile,
    undefined
  );
}

export function getSkillOptionsForSourceSkill(
  calculation: DamageCalculation,
  sourceSkillName: string
): DamageSkillOption[] {
  const normalizedSkillName = normalizeRegressionSkillName(sourceSkillName);
  return calculation.skillOptions.filter((skillOption) => {
    if (skillOption.chargeVariant === "charge") {
      return false;
    }

    const optionName = normalizeRegressionSkillName(skillOption.name);
    const optionSourceName = skillOption.sourceSkillName
      ? normalizeRegressionSkillName(skillOption.sourceSkillName)
      : optionName;

    return (
      optionName === normalizedSkillName ||
      optionSourceName === normalizedSkillName
    );
  });
}

export function getBestNoManualAuraProfileForSkillOption(
  calculation: DamageCalculation,
  skillOption: DamageSkillOption
): DamageProfile | undefined {
  return getBestProfile(
    calculation.profiles.filter(
      (profile) =>
        profile.skillId === skillOption.id && profile.playerAuraId === "none"
    )
  );
}

export function getBestNoManualAuraProfile(
  calculation: DamageCalculation
): DamageProfile | undefined {
  return getBestProfile(
    calculation.profiles.filter((profile) => profile.playerAuraId === "none")
  );
}

export function getBestProfileForSourceSkill(
  calculation: DamageCalculation,
  sourceSkillName: string
): { skillOption: DamageSkillOption; profile: DamageProfile } | undefined {
  return getSkillOptionsForSourceSkill(calculation, sourceSkillName)
    .map((skillOption) => ({
      skillOption,
      profile: getBestNoManualAuraProfileForSkillOption(
        calculation,
        skillOption
      ),
    }))
    .filter(
      (
        candidate
      ): candidate is {
        skillOption: DamageSkillOption;
        profile: DamageProfile;
      } => Boolean(candidate.profile)
    )
    .reduce<
      | {
          skillOption: DamageSkillOption;
          profile: DamageProfile;
        }
      | undefined
    >(
      (best, candidate) =>
        best
          ? pickHigherDamageProfile(best.profile, candidate.profile) ===
            best.profile
            ? best
            : candidate
          : candidate,
      undefined
    );
}

export function summarizeDamageRegressionProfile(
  skillOption: DamageSkillOption,
  profile: DamageProfile
): DamageRegressionExpected {
  const summary: DamageRegressionExpected = {
    skillOption: {
      id: skillOption.id,
      name: skillOption.name,
      level: skillOption.level,
      damageMode: skillOption.damageMode,
      sourceSkillName: skillOption.sourceSkillName,
      summonVariant: skillOption.summonVariant,
      chargeCount: skillOption.chargeCount,
      defaultChargeNumber: skillOption.defaultChargeNumber,
      chargeLabel: skillOption.chargeLabel,
    },
    profile: {
      key: profile.key,
      weaponId: profile.weaponId,
      skillId: profile.skillId,
      skillName: profile.skillName,
      sourceSkillName: profile.sourceSkillName,
      summonVariant: profile.summonVariant,
      chargeVariant: profile.chargeVariant,
      chargeNumber: profile.chargeNumber,
      chargeCount: profile.chargeCount,
      chargeLabel: profile.chargeLabel,
      skillLevel: profile.skillLevel,
      skillDamageMode: profile.skillDamageMode,
      playerAuraId: profile.playerAuraId,
      playerAuraCarrier: profile.playerAuraCarrier,
      playerAuraLevel: profile.playerAuraLevel,
      transformationId: profile.transformationId,
      damageScope: {
        label: profile.damageScope.label,
        count: profile.damageScope.count,
        countLabel: profile.damageScope.countLabel,
      },
      damageTotals: profile.damageTotals,
      auraPulseDamageTotals: profile.auraPulseDamageTotals,
      totalPhysicalDamage: profile.totalPhysicalDamage,
      totalElementalDamage: profile.totalElementalDamage,
      totalPoisonDamage: profile.totalPoisonDamage,
      breakdown: profile.breakdown,
      damageComponents: profile.damageComponents.map((component) => ({
        label: component.label,
        source: component.source,
        damageType: component.damageType,
        timing: component.timing,
        damage: component.damage,
        baseDamage: component.baseDamage,
        poisonDamage: component.poisonDamage,
      })),
      ...(profile.auraPulseDamageComponents?.length
        ? {
            auraPulseDamageComponents: profile.auraPulseDamageComponents.map(
              (component) => ({
                label: component.label,
                source: component.source,
                damageType: component.damageType,
                timing: component.timing,
                damage: component.damage,
                baseDamage: component.baseDamage,
                poisonDamage: component.poisonDamage,
              })
            ),
          }
        : {}),
    },
  };

  return JSON.parse(JSON.stringify(summary)) as DamageRegressionExpected;
}
