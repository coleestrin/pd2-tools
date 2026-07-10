import fs from "fs";
import path from "path";
import { CharacterData } from "../types";
import { enrichArmoryPayload } from "../utils/armory-payload";
import { calculateDamage } from "../utils/damage-calculator";
import {
  getBestNoManualAuraProfileForSkillOptionId,
  summarizeDamageRegressionProfile,
} from "../utils/damage-regression-snapshot";

interface StoredSample {
  skillName: string;
  characterName: string;
  character: CharacterData;
  expected: {
    skillOption: { id: string };
  };
}

interface StoredSnapshot {
  samples: StoredSample[];
}

const snapshotPath = path.resolve(
  process.cwd(),
  "src",
  "fixtures",
  "damage-regression-snapshot.json"
);

function main() {
  const snapshot = JSON.parse(
    fs.readFileSync(snapshotPath, "utf8")
  ) as StoredSnapshot;

  snapshot.samples.forEach((sample) => {
    const character = structuredClone(sample.character);
    enrichArmoryPayload(character);
    const calculation = calculateDamage(character);
    const target = getBestNoManualAuraProfileForSkillOptionId(
      calculation,
      sample.expected.skillOption.id
    );
    if (!target) {
      throw new Error(
        `No profile for ${sample.skillName} (${sample.characterName}) option ${sample.expected.skillOption.id}`
      );
    }

    sample.expected = summarizeDamageRegressionProfile(
      target.skillOption,
      target.profile
    );
  });

  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Refreshed ${snapshot.samples.length} samples in ${snapshotPath}`);
}

main();
