import fs from "fs";
import path from "path";
import { CharacterData, CharacterResponse } from "../types";
import { enrichArmoryPayload } from "./armory-payload";
import { calculateDamage } from "./damage-calculator";
import {
  DamageRegressionExpected,
  getBestNoManualAuraProfileForSkillOptionId,
  summarizeDamageRegressionProfile,
} from "./damage-regression-snapshot";

interface DamageRegressionSample {
  skillName: string;
  gameMode: string;
  season: number;
  characterName: string;
  characterLevel: number;
  qualification: {
    targetSkill: {
      name?: string;
      baseLevel: number;
      effectiveLevel: number;
    };
    synergySkills?: Array<{
      name: string;
      baseLevel: number;
      effectiveLevel: number;
    }>;
    synergyBaseLevelTotal: number;
    maxedSynergyCount: number;
    targetToBestProfileRatio: number;
  };
  expected: DamageRegressionExpected;
  character: CharacterResponse;
}

interface DamageRegressionSnapshot {
  schemaVersion: number;
  criteria: {
    minSamplesPerSkill: number;
    minCharacterLevel: number;
    minTargetBaseLevel: number;
    minTargetEffectiveLevel: number;
    minTargetToBestProfileRatio: number;
    minSynergyBaseLevelTotal: number;
    minMaxedSynergyCount: number;
  };
  coverage: {
    skillsWithSamples: number;
    totalSamples: number;
  };
  samples: DamageRegressionSample[];
}

const snapshotPath = path.resolve(
  process.cwd(),
  "src",
  "fixtures",
  "damage-regression-snapshot.json"
);

function loadSnapshot(): DamageRegressionSnapshot {
  return JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
}

describe("damage regression snapshot", () => {
  const snapshot = loadSnapshot();

  it("contains high-confidence multi-sample skill coverage", () => {
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.coverage.totalSamples).toBeGreaterThan(0);
    expect(snapshot.coverage.skillsWithSamples).toBeGreaterThan(0);

    const samplesBySkill = new Map<string, number>();
    snapshot.samples.forEach((sample) => {
      const key = `${sample.gameMode}:${sample.season}:${sample.skillName}`;
      samplesBySkill.set(key, (samplesBySkill.get(key) || 0) + 1);

      expect(sample.characterLevel).toBeGreaterThanOrEqual(
        snapshot.criteria.minCharacterLevel
      );
      expect(sample.qualification.targetSkill.baseLevel).toBeGreaterThanOrEqual(
        snapshot.criteria.minTargetBaseLevel
      );
      expect(
        sample.qualification.targetSkill.effectiveLevel
      ).toBeGreaterThanOrEqual(snapshot.criteria.minTargetEffectiveLevel);
      expect(
        sample.qualification.targetToBestProfileRatio
      ).toBeGreaterThanOrEqual(
        snapshot.criteria.minTargetToBestProfileRatio
      );

      const synergyCount = sample.qualification.synergySkills?.length || 0;
      if (synergyCount > 0) {
        expect(sample.qualification.synergyBaseLevelTotal).toBeGreaterThanOrEqual(
          Math.min(
            snapshot.criteria.minSynergyBaseLevelTotal,
            synergyCount * snapshot.criteria.minTargetBaseLevel
          )
        );
        expect(sample.qualification.maxedSynergyCount).toBeGreaterThanOrEqual(
          Math.min(snapshot.criteria.minMaxedSynergyCount, synergyCount)
        );
      }
    });

    samplesBySkill.forEach((count) => {
      expect(count).toBeGreaterThanOrEqual(
        snapshot.criteria.minSamplesPerSkill
      );
    });
  });

  it("matches saved damage summaries for every sampled character", () => {
    snapshot.samples.forEach((sample) => {
      const character = JSON.parse(
        JSON.stringify(sample.character)
      ) as CharacterData;
      enrichArmoryPayload(character);
      const calculation = calculateDamage(character);
      const target = getBestNoManualAuraProfileForSkillOptionId(
        calculation,
        sample.expected.skillOption.id
      );

      expect(target).toBeDefined();
      expect(
        summarizeDamageRegressionProfile(
          target!.skillOption,
          target!.profile
        )
      ).toEqual(sample.expected);
    });
  });

  it("covers every modeled Raise Skeletal Mage variant", () => {
    const variants = new Set(
      snapshot.samples
        .filter((sample) => sample.skillName === "Raise Skeletal Mage")
        .map(
          (sample) =>
            sample.expected.skillOption.summonVariant ||
            sample.expected.profile.summonVariant
        )
        .filter(Boolean)
    );

    expect(Array.from(variants).sort()).toEqual([
      "cold-mage",
      "fire-mage",
      "lightning-mage",
      "poison-mage",
    ]);
  });
});
