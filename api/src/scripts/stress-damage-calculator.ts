import fs from "fs";
import path from "path";
import { CharacterData, DamageComponent, DamageProfile } from "../types";
import { enrichArmoryPayload } from "../utils/armory-payload";
import { calculateDamage } from "../utils/damage-calculator";

interface StoredSnapshot {
  samples: Array<{
    gameMode: string;
    season: number;
    characterName: string;
    character: CharacterData;
  }>;
}

const snapshotPath = path.resolve(
  process.cwd(),
  "src",
  "fixtures",
  "damage-regression-snapshot.json"
);
const reportPath = path.resolve(
  process.cwd(),
  "..",
  ".codex-local",
  "damage-stress-summary.json"
);

function assertRange(
  range: { min: number; max: number },
  context: string
): void {
  if (
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max) ||
    range.min < 0 ||
    range.max < range.min
  ) {
    throw new Error(`${context}: invalid range ${JSON.stringify(range)}`);
  }
}

function includedComponents(profile: DamageProfile): DamageComponent[] {
  return profile.damageComponents.filter(
    (component) => component.includedInTotal !== false
  );
}

function validateProfile(profile: DamageProfile): void {
  const components = includedComponents(profile);
  components.forEach((component) =>
    assertRange(component.damage, `${profile.key}:${component.id}`)
  );
  assertRange(profile.damageTotals.combinedDamage, `${profile.key}:combined`);

  const summed = components.reduce(
    (total, component) => ({
      min: total.min + component.damage.min,
      max: total.max + component.damage.max,
    }),
    { min: 0, max: 0 }
  );
  if (
    Math.abs(summed.min - profile.damageTotals.combinedDamage.min) > 0.001 ||
    Math.abs(summed.max - profile.damageTotals.combinedDamage.max) > 0.001
  ) {
    throw new Error(
      `${profile.key}: component sum ${JSON.stringify(
        summed
      )} does not match combined total ${JSON.stringify(
        profile.damageTotals.combinedDamage
      )}`
    );
  }
}

function validateTransformation(
  profile: DamageProfile,
  physicalBonusPercent: number
): void {
  const previousMultiplier =
    1 + profile.breakdown.physicalBonusPercent.total / 100;
  const nextMultiplier = previousMultiplier + physicalBonusPercent / 100;

  includedComponents(profile).forEach((component) => {
    if (component.damageType !== "physical" || component.timing !== "instant") {
      return;
    }

    const baseDamage = component.baseDamage || {
      min: component.damage.min / previousMultiplier,
      max: component.damage.max / previousMultiplier,
    };
    assertRange(
      {
        min: Math.floor(baseDamage.min * nextMultiplier),
        max: Math.max(
          Math.floor(baseDamage.min * nextMultiplier),
          Math.floor(baseDamage.max * nextMultiplier)
        ),
      },
      `${profile.key}:transformation:${physicalBonusPercent}`
    );
  });
}

function main(): void {
  const snapshot = JSON.parse(
    fs.readFileSync(snapshotPath, "utf8")
  ) as StoredSnapshot;
  const uniqueCharacters = new Map<string, CharacterData>();
  snapshot.samples.forEach((sample) => {
    const key = `${sample.gameMode}:${sample.season}:${sample.characterName}`;
    if (!uniqueCharacters.has(key)) {
      uniqueCharacters.set(key, sample.character);
    }
  });

  let profilesValidated = 0;
  let transformedProfilesValidated = 0;
  uniqueCharacters.forEach((storedCharacter) => {
    const character = structuredClone(storedCharacter);
    enrichArmoryPayload(character);
    const calculation = calculateDamage(character);
    const skillsById = new Map(
      calculation.skillOptions.map((skill) => [skill.id, skill])
    );

    calculation.profiles.forEach((profile) => {
      validateProfile(profile);
      profilesValidated += 1;

      const skill = skillsById.get(profile.skillId);
      calculation.transformationOptions
        .filter(
          (option) =>
            option.id !== "none" &&
            skill?.allowedTransformationIds.includes(option.id)
        )
        .forEach((option) => {
          option.levelBonuses.forEach((bonus) => {
            validateTransformation(profile, bonus.physicalBonusPercent);
            transformedProfilesValidated += 1;
          });
        });
    });
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    source: path.relative(process.cwd(), snapshotPath),
    charactersValidated: uniqueCharacters.size,
    profilesValidated,
    transformedProfilesValidated,
    failures: 0,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
