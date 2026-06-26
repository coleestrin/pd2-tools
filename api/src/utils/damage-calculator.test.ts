//@ts-nocheck
import fs from "fs";
import path from "path";
import { CharacterData, IItem } from "../types";

const requiredGameFiles = ["Skills.txt", "Missiles.txt", "SkillDesc.txt"];
const gameDataPath = path.resolve(
  process.cwd(),
  "src",
  "game-data",
  "pd2",
  "season-13"
);
const hasRequiredGameData = requiredGameFiles.every((fileName) =>
  fs.existsSync(path.join(gameDataPath, fileName))
);

type DamageCalculatorModule = typeof import("./damage-calculator");
let calculateDamage: DamageCalculatorModule["calculateDamage"];
type ArmoryPayloadModule = typeof import("./armory-payload");
let enrichArmoryPayload: ArmoryPayloadModule["enrichArmoryPayload"];

function createStats() {
  return {
    fireRes: -70,
    maxFireRes: 75,
    coldRes: -70,
    maxColdRes: 75,
    lightningRes: -70,
    maxLightningRes: 75,
    poisonRes: -70,
    maxPoisonRes: 75,
    strength: 0,
    dexterity: 0,
    vitality: 0,
    energy: 0,
    fasterCastRate: 0,
    increasedAttackSpeed: 0,
    fasterHitRecovery: 0,
    fasterRunWalk: 0,
    crushingBlow: 0,
    deadlyStrike: 0,
    openWounds: 0,
    openWoundsDPS: 0,
    physicalDamageReduction: 0,
    magicFind: 0,
    goldFind: 0,
    lifeLeech: 0,
    manaLeech: 0,
    hpPerKill: 0,
    mpPerKill: 0,
    lAbsorbPct: 0,
    lAbsorbFlat: 0,
    cAbsorbPct: 0,
    cAbsorbFlat: 0,
    fAbsorbPct: 0,
    fAbsorbFlat: 0,
    mAbsorbFlat: 0,
    fireSkillDamage: 0,
    coldSkillDamage: 0,
    lightningSkillDamage: 0,
    poisonSkillDamage: 0,
    firePierce: 0,
    coldPierce: 0,
    lightningPierce: 0,
    poisonPierce: 0,
  };
}

function expectPhysicalBonusTotalToMatchBuckets(profile) {
  const bonus = profile.breakdown.physicalBonusPercent;
  const expectedTotal =
    bonus.stat +
    bonus.nonWeapon +
    bonus.passive +
    bonus.selectedSkill +
    bonus.selectedSkillSynergy +
    bonus.transformation +
    bonus.activeAuras;

  expect(bonus.total).toBeCloseTo(expectedTotal, 5);
}

function createWeapon(overrides: Partial<IItem> = {}): IItem {
  return {
    id: overrides.id ?? "test-weapon",
    hash: overrides.hash ?? "test-weapon",
    name: overrides.name ?? "Test Club",
    category: "weapon",
    base_code: "clb",
    base: {
      id: "clb",
      category: "weapon",
      codes: {},
      name: "Club",
      stackable: false,
      type: "Club",
      type_code: "club",
      size: { height: 3, width: 1 },
      requirements: { level: 0, strength: 0, dexterity: 0 },
    },
    quality: { id: 2, name: "Normal" },
    location: overrides.location ?? {
      zone: "Equipped",
      storage: "Equipped",
      zone_id: 1,
      storage_id: 0,
      equipment: "Right Hand",
      equipment_id: 4,
    },
    position: { row: 0, column: 0 },
    properties: [],
    damage: {
      one_handed: { minimum: 10, maximum: 20 },
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
    item_level: 1,
    graphic_id: 0,
    class_specifics: false,
    socket_count: 0,
    modifiers: [],
    corrupted: false,
    desecrated: false,
    ...overrides,
  } as unknown as IItem;
}

function createBoot(overrides: Partial<IItem> = {}): IItem {
  return {
    id: overrides.id ?? "test-boots",
    hash: overrides.hash ?? "test-boots",
    name: overrides.name ?? "Test Boots",
    category: "armor",
    base_code: "test_boots",
    base: {
      id: "test_boots",
      category: "armor",
      codes: {},
      name: "Test Boots",
      stackable: false,
      type: "Boots",
      type_code: "boot",
      size: { height: 2, width: 2 },
      requirements: { level: 0, strength: 0, dexterity: 0 },
      damage: {
        one_handed: {},
        two_handed: {},
        missile: {},
        kick: { minimum: 20, maximum: 30 },
      },
      stat_bonus: { strength: 100 },
    },
    quality: { id: 2, name: "Normal" },
    location: overrides.location ?? {
      zone: "Equipped",
      storage: "Equipped",
      zone_id: 1,
      storage_id: 0,
      equipment: "Boots",
      equipment_id: 9,
    },
    position: { row: 0, column: 0 },
    properties: [],
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
    item_level: 1,
    graphic_id: 0,
    class_specifics: false,
    socket_count: 0,
    modifiers: [],
    corrupted: false,
    desecrated: false,
    ...overrides,
  } as unknown as IItem;
}

function createSimpleItem(overrides: Partial<IItem> = {}): IItem {
  return {
    id: overrides.id ?? "test-item",
    hash: overrides.hash ?? "test-item",
    name: overrides.name ?? "Test Item",
    category: "misc",
    base_code: "rin",
    base: {
      id: "rin",
      category: "misc",
      codes: {},
      name: "Ring",
      stackable: false,
      type: "Ring",
      type_code: "ring",
      size: { height: 1, width: 1 },
      requirements: { level: 0, strength: 0, dexterity: 0 },
    },
    quality: { id: 4, name: "Magic" },
    location: {
      zone: "Stored",
      storage: "Inventory",
      zone_id: 2,
      storage_id: 1,
    },
    position: { row: 0, column: 0 },
    properties: [],
    is_identified: true,
    is_socketed: false,
    is_new: false,
    is_ear: false,
    is_starter: false,
    is_simple: false,
    is_ethereal: false,
    is_personalized: false,
    is_runeword: false,
    socketed_count: 0,
    item_level: 1,
    graphic_id: 0,
    class_specifics: false,
    socket_count: 0,
    modifiers: [],
    corrupted: false,
    desecrated: false,
    ...overrides,
  } as unknown as IItem;
}

function createCharacter(skillName: string, level: number): CharacterData {
  return {
    character: {
      name: "DamageTester",
      status: {
        is_hardcore: false,
        is_dead: false,
        is_expansion: true,
        is_ladder: true,
      },
      class: { id: 4, name: "Druid" },
      attributes: {
        strength: 0,
        dexterity: 0,
        vitality: 0,
        energy: 0,
      },
      gold: { character: 0, stash: 0, total: 0 },
      points: { stat: 0, skill: 0 },
      life: 0,
      mana: 0,
      stamina: 0,
      experience: 0,
      level: 90,
      skills: [{ id: 238, name: skillName, level }],
      season: 13,
    },
    items: [createWeapon()],
    realSkills: [{ skill: skillName, level, baseLevel: level }],
    realStats: createStats(),
  } as unknown as CharacterData;
}

const describeWithGameData = hasRequiredGameData ? describe : describe.skip;
const describeWithArmorData =
  hasRequiredGameData && fs.existsSync(path.join(gameDataPath, "Armor.txt"))
    ? describe
    : describe.skip;
const describeWithMonStatsData =
  hasRequiredGameData && fs.existsSync(path.join(gameDataPath, "MonStats.txt"))
    ? describe
    : describe.skip;

function loadGameFile(fileName: string, keyColumn: string) {
  const text = fs
    .readFileSync(path.join(gameDataPath!, fileName), "utf8")
    .replace(/^\uFEFF/, "");
  const lines = text.trimEnd().split(/\r?\n/);
  const columns = lines[0].split("\t");
  const keyIndex = columns.indexOf(keyColumn);
  const rowsByKey = new Map<string, string[]>();

  lines.slice(1).forEach((line) => {
    const cells = line.split("\t");
    rowsByKey.set(cells[keyIndex], cells);
  });

  return { columns, rowsByKey };
}

function getGameFileCell(table, row: string[], columnName: string): string {
  return row[table.columns.indexOf(columnName)] || "";
}

function getGameFileNumber(table, row: string[], columnName: string): number {
  const value = Number(getGameFileCell(table, row, columnName));
  return Number.isFinite(value) ? value : 0;
}

function getSourceLevelScaledValue(
  table,
  row: string[],
  level: number,
  baseColumn: string,
  levelColumns: readonly string[]
): number {
  let value = getGameFileNumber(table, row, baseColumn);
  let currentLevel = 1;
  const thresholds = [8, 16, 22, 28, Number.MAX_SAFE_INTEGER];

  thresholds.forEach((threshold, index) => {
    const scale = getGameFileNumber(table, row, levelColumns[index]);
    while (currentLevel < level && currentLevel < threshold) {
      value += scale;
      currentLevel += 1;
    }
  });

  const hitShift = getGameFileNumber(table, row, "HitShift");
  return value / 2 ** (8 - hitShift);
}

function getExpectedAuraPayloadsFromSkillsTxt(
  skillName: string,
  level: number
) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get(skillName)!;
  const min = getSourceLevelScaledValue(skills, row, level, "EMin", [
    "EMinLev1",
    "EMinLev2",
    "EMinLev3",
    "EMinLev4",
    "EMinLev5",
  ]);
  const max = getSourceLevelScaledValue(skills, row, level, "EMax", [
    "EMaxLev1",
    "EMaxLev2",
    "EMaxLev3",
    "EMaxLev4",
    "EMaxLev5",
  ]);
  const minCalc = getGameFileCell(skills, row, "passivecalc1");
  const maxCalc = getGameFileCell(skills, row, "passivecalc2");
  const minParam = minCalc.match(/^edns\*par(\d+)\/256$/)?.[1];
  const maxParam = maxCalc.match(/^edxs\*par(\d+)\/256$/)?.[1];

  expect(minParam).toBeDefined();
  expect(maxParam).toBeDefined();

  return {
    party: {
      min: Math.floor(min),
      max: Math.floor(max),
    },
    self: {
      min: Math.floor(
        (Math.floor(min * 256) *
          getGameFileNumber(skills, row, `Param${minParam}`)) /
          256
      ),
      max: Math.floor(
        (Math.floor(max * 256) *
          getGameFileNumber(skills, row, `Param${maxParam}`)) /
          256
      ),
    },
  };
}

function getExpectedMightPhysicalBonusFromSkillsTxt(
  level: number,
  source: "self" | "party"
) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("Might")!;
  const calcColumn = source === "self" ? "passivecalc1" : "aurastatcalc1";
  const calc = getGameFileCell(skills, row, calcColumn).replace(/\s+/g, "");
  const scaledMin = getSourceLevelScaledValue(skills, row, level, "EMin", [
    "EMinLev1",
    "EMinLev2",
    "EMinLev3",
    "EMinLev4",
    "EMinLev5",
  ]);

  if (calc === "edmn") {
    return Math.floor(scaledMin);
  }

  const divisor = calc.match(/^edmn\/(\d+)$/)?.[1];
  expect(divisor).toBeDefined();
  return Math.floor(scaledMin / Number(divisor));
}

function getExpectedBattleCommandSkillLevelBonusFromSkillsTxt(level: number) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("Battle Command")!;
  const stat = getGameFileCell(skills, row, "aurastat1");
  const calc = getGameFileCell(skills, row, "aurastatcalc1").replace(
    /\s+/g,
    ""
  );

  expect(stat).toBe("item_allskills");
  expect(calc).toBe("1+blvl/10");

  return Math.floor(1 + level / 10);
}

function getExpectedBattleCommandPhysicalBonusFromSkillsTxt(level: number) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("Battle Command")!;
  const stat = getGameFileCell(skills, row, "aurastat2");
  const calc = getGameFileCell(skills, row, "aurastatcalc2").replace(
    /\s+/g,
    ""
  );

  expect(stat).toBe("damagepercent");
  expect(calc).toBe("ln34");

  return (
    getGameFileNumber(skills, row, "Param3") +
    (level - 1) * getGameFileNumber(skills, row, "Param4")
  );
}

function getExpectedVengeanceElementalPercentFromSkillsTxt({
  vengeanceLevel,
  holyFireBaseLevel,
  holyFreezeBaseLevel,
  holyShockBaseLevel,
  convictionBaseLevel,
}: {
  vengeanceLevel: number;
  holyFireBaseLevel: number;
  holyFreezeBaseLevel: number;
  holyShockBaseLevel: number;
  convictionBaseLevel: number;
}) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("Vengeance")!;

  expect(getGameFileCell(skills, row, "*calc1 desc")).toBe("fire damage%");
  expect(getGameFileCell(skills, row, "*calc2 desc")).toBe("cold damage%");
  expect(getGameFileCell(skills, row, "*calc3 desc")).toBe("ltng damage%");

  return (
    getGameFileNumber(skills, row, "Param1") +
    Math.max(0, vengeanceLevel - 1) *
      getGameFileNumber(skills, row, "Param2") +
    (holyFireBaseLevel + holyFreezeBaseLevel + holyShockBaseLevel) *
      getGameFileNumber(skills, row, "Param8") +
    convictionBaseLevel * getGameFileNumber(skills, row, "Param7")
  );
}

function getExpectedVengeanceFlatElementalBaseFromSkillsTxt({
  vengeanceLevel,
}: {
  vengeanceLevel: number;
}) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("Vengeance")!;
  const min = getSourceLevelScaledValue(skills, row, vengeanceLevel, "EMin", [
    "EMinLev1",
    "EMinLev2",
    "EMinLev3",
    "EMinLev4",
    "EMinLev5",
  ]);
  const max = getSourceLevelScaledValue(skills, row, vengeanceLevel, "EMax", [
    "EMaxLev1",
    "EMaxLev2",
    "EMaxLev3",
    "EMaxLev4",
    "EMaxLev5",
  ]);

  expect(getGameFileCell(skills, row, "EType")).toBe("");
  expect(getGameFileCell(skills, row, "EDmgSymPerCalc")).toContain(
    "skill('Holy Fire'.blvl)"
  );

  return {
    min,
    max,
  };
}

function getExpectedWarCryPhysicalSynergyFromSkillsTxt({
  howlBaseLevel,
  battleCryBaseLevel,
  tauntBaseLevel,
  shoutBaseLevel,
  battleCommandBaseLevel,
  battleOrdersBaseLevel,
}: {
  howlBaseLevel: number;
  battleCryBaseLevel: number;
  tauntBaseLevel: number;
  shoutBaseLevel: number;
  battleCommandBaseLevel: number;
  battleOrdersBaseLevel: number;
}) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("War Cry")!;

  expect(getGameFileCell(skills, row, "DmgSymPerCalc")).toContain(
    "skill('Howl'.blvl)"
  );

  return (
    (howlBaseLevel + battleCryBaseLevel) *
      getGameFileNumber(skills, row, "Param8") +
    (tauntBaseLevel +
      shoutBaseLevel +
      battleCommandBaseLevel +
      battleOrdersBaseLevel) *
      getGameFileNumber(skills, row, "Param7")
  );
}

function getExpectedVenomPoisonPayloadFromSkillsTxt(
  venomLevel: number,
  cobraStrikeBaseLevel: number,
  poisonSkillDamage: number
) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("Venom")!;

  expect(getGameFileCell(skills, row, "aurastat1")).toBe("poisonmindam");
  expect(getGameFileCell(skills, row, "aurastatcalc1")).toBe("edns");
  expect(getGameFileCell(skills, row, "aurastat2")).toBe("poisonmaxdam");
  expect(getGameFileCell(skills, row, "aurastatcalc2")).toBe("edxs");
  expect(getGameFileCell(skills, row, "aurastat3")).toBe(
    "skill_poison_override_length"
  );
  expect(getGameFileCell(skills, row, "aurastatcalc3")).toBe("edln");

  const min = getSourceLevelScaledValue(skills, row, venomLevel, "EMin", [
    "EMinLev1",
    "EMinLev2",
    "EMinLev3",
    "EMinLev4",
    "EMinLev5",
  ]);
  const max = getSourceLevelScaledValue(skills, row, venomLevel, "EMax", [
    "EMaxLev1",
    "EMaxLev2",
    "EMaxLev3",
    "EMaxLev4",
    "EMaxLev5",
  ]);
  const durationFrames = getGameFileNumber(skills, row, "ELen");
  const synergyPercent =
    cobraStrikeBaseLevel * getGameFileNumber(skills, row, "Param8");
  const withSynergy = {
    min: Math.floor(min * durationFrames * (1 + synergyPercent / 100)),
    max: Math.floor(max * durationFrames * (1 + synergyPercent / 100)),
  };
  const damage = {
    min: Math.floor(withSynergy.min * (1 + poisonSkillDamage / 100)),
    max: Math.floor(withSynergy.max * (1 + poisonSkillDamage / 100)),
  };

  return {
    damage,
    total: Math.floor((damage.min + damage.max) / 2),
    durationSeconds: durationFrames / 25,
  };
}

function getExpectedHydraFirePayloadFromSkillsTxt(
  hydraLevel: number,
  fireBoltBaseLevel: number,
  lesserHydraBaseLevel: number,
  fireMasteryLevel: number
) {
  const skills = loadGameFile("Skills.txt", "skill");
  const hydraRow = skills.rowsByKey.get("Hydra")!;
  const fireMasteryRow = skills.rowsByKey.get("Fire Mastery")!;
  const min = getSourceLevelScaledValue(skills, hydraRow, hydraLevel, "EMin", [
    "EMinLev1",
    "EMinLev2",
    "EMinLev3",
    "EMinLev4",
    "EMinLev5",
  ]);
  const max = getSourceLevelScaledValue(skills, hydraRow, hydraLevel, "EMax", [
    "EMaxLev1",
    "EMaxLev2",
    "EMaxLev3",
    "EMaxLev4",
    "EMaxLev5",
  ]);
  const synergyPercent =
    (fireBoltBaseLevel + lesserHydraBaseLevel) *
    getGameFileNumber(skills, hydraRow, "Param8");
  const masteryPercent =
    getGameFileNumber(skills, fireMasteryRow, "Param1") +
    Math.max(0, fireMasteryLevel - 1) *
      getGameFileNumber(skills, fireMasteryRow, "Param2");

  return {
    min: Math.floor(
      Math.floor(min * (1 + synergyPercent / 100)) * (1 + masteryPercent / 100)
    ),
    max: Math.floor(
      Math.floor(max * (1 + synergyPercent / 100)) * (1 + masteryPercent / 100)
    ),
  };
}

function getExpectedSkeletalMagePayloadFromGameFiles(
  missileName: string,
  mageLevel: number,
  skeletonMasteryLevel: number
) {
  const skills = loadGameFile("Skills.txt", "skill");
  const missiles = loadGameFile("Missiles.txt", "Missile");
  const mageRow = skills.rowsByKey.get("Raise Skeletal Mage")!;
  const masteryRow = skills.rowsByKey.get("Skeleton Mastery")!;
  const missileRow = missiles.rowsByKey.get(missileName)!;
  const min = getSourceLevelScaledValue(
    missiles,
    missileRow,
    mageLevel,
    "EMin",
    ["MinELev1", "MinELev2", "MinELev3", "MinELev4", "MinELev5"]
  );
  const max = getSourceLevelScaledValue(
    missiles,
    missileRow,
    mageLevel,
    "Emax",
    ["MaxELev1", "MaxELev2", "MaxELev3", "MaxELev4", "MaxELev5"]
  );
  const dotMultiplier =
    getGameFileCell(missiles, missileRow, "EType") === "pois"
      ? getGameFileNumber(missiles, missileRow, "ELen") || 1
      : 1;
  const masteryPercent =
    skeletonMasteryLevel * getGameFileNumber(skills, masteryRow, "Param3");

  expect(getGameFileCell(skills, mageRow, "aurastat3")).toBe(
    "passive_fire_mastery"
  );
  expect(getGameFileCell(skills, mageRow, "aurastat5")).toBe(
    "passive_pois_mastery"
  );

  return {
    min: Math.floor(min * dotMultiplier * (1 + masteryPercent / 100)),
    max: Math.floor(max * dotMultiplier * (1 + masteryPercent / 100)),
  };
}

function getExpectedPlaguePoppyPoisonPayloadFromGameFiles({
  plaguePoppyLevel,
  rabiesBaseLevel,
  cycleOfLifeBaseLevel,
  vinesBaseLevel,
}: {
  plaguePoppyLevel: number;
  rabiesBaseLevel: number;
  cycleOfLifeBaseLevel: number;
  vinesBaseLevel: number;
}) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("Plague Poppy")!;
  const min = getSourceLevelScaledValue(skills, row, plaguePoppyLevel, "EMin", [
    "EMinLev1",
    "EMinLev2",
    "EMinLev3",
    "EMinLev4",
    "EMinLev5",
  ]);
  const max = getSourceLevelScaledValue(skills, row, plaguePoppyLevel, "EMax", [
    "EMaxLev1",
    "EMaxLev2",
    "EMaxLev3",
    "EMaxLev4",
    "EMaxLev5",
  ]);
  const durationFrames = getGameFileNumber(skills, row, "ELen");
  const synergyPercent =
    (rabiesBaseLevel + cycleOfLifeBaseLevel + vinesBaseLevel) *
    getGameFileNumber(skills, row, "Param8");

  expect(getGameFileCell(skills, row, "EDmgSymPerCalc")).toBe(
    "(skill('Rabies'.blvl)+skill('Cycle of Life'.blvl)+skill('Vines'.blvl))*par8"
  );
  expect(getGameFileCell(skills, row, "passivestat1")).toBe(
    "passive_pois_mastery"
  );
  expect(getGameFileCell(skills, row, "passivecalc1")).toBe(
    getGameFileCell(skills, row, "EDmgSymPerCalc")
  );

  const withSynergy = {
    min: Math.floor(min * durationFrames * (1 + synergyPercent / 100)),
    max: Math.floor(max * durationFrames * (1 + synergyPercent / 100)),
  };

  return {
    min: Math.floor(withSynergy.min * (1 + synergyPercent / 100)),
    max: Math.floor(withSynergy.max * (1 + synergyPercent / 100)),
  };
}

function getExpectedSkeletonDamagePercentFromGameFiles({
  skillName,
  skillLevel,
  raiseSkeletonBaseLevel = 0,
  skeletonArcherBaseLevel = 0,
  skeletonMasteryLevel,
}: {
  skillName: "Raise Skeleton" | "Raise Skeleton Archer";
  skillLevel: number;
  raiseSkeletonBaseLevel?: number;
  skeletonArcherBaseLevel?: number;
  skeletonMasteryLevel: number;
}) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get(skillName)!;
  let total = 0;

  if (skillName === "Raise Skeleton") {
    expect(getGameFileCell(skills, row, "aurastat1")).toBe("damagepercent");
    total +=
      skillLevel < 4
        ? 0
        : (skillLevel - 3) * getGameFileNumber(skills, row, "Param3");
    total += skeletonArcherBaseLevel * getGameFileNumber(skills, row, "Param7");
  } else {
    expect(getGameFileCell(skills, row, "DmgSymPerCalc")).toBe(
      getGameFileCell(skills, row, "passivecalc4")
    );
    total += raiseSkeletonBaseLevel * getGameFileNumber(skills, row, "Param7");
  }

  expect(getGameFileCell(skills, row, "passivestat4")).toBe("damagepercent");
  total += skeletonMasteryLevel * getGameFileNumber(skills, row, "Param8");

  return total;
}

function getExpectedSkeletonFlatPhysicalFromGameFiles({
  skillName,
  skillLevel,
  damagePercent,
  skeletonMasteryLevel,
}: {
  skillName: "Raise Skeleton" | "Raise Skeleton Archer";
  skillLevel: number;
  damagePercent: number;
  skeletonMasteryLevel: number;
}) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get(skillName)!;
  const masteryRow = skills.rowsByKey.get("Skeleton Mastery")!;
  const elementalMinAlias = getSourceLevelScaledValue(
    skills,
    row,
    skillLevel,
    "EMin",
    ["EMinLev1", "EMinLev2", "EMinLev3", "EMinLev4", "EMinLev5"]
  );
  const base =
    skeletonMasteryLevel * getGameFileNumber(skills, masteryRow, "Param2") +
    elementalMinAlias;

  expect(getGameFileCell(skills, row, "passivestat2")).toBe(
    "item_normaldamage"
  );

  return {
    base: { min: Math.floor(base), max: Math.floor(base) },
    damage: {
      min: Math.floor(base * (1 + damagePercent / 100)),
      max: Math.floor(base * (1 + damagePercent / 100)),
    },
  };
}

function getExpectedSkeletonArcherDirectPhysicalFromGameFiles({
  archerLevel,
  damagePercent,
}: {
  archerLevel: number;
  damagePercent: number;
}) {
  const skills = loadGameFile("Skills.txt", "skill");
  const row = skills.rowsByKey.get("Raise Skeleton Archer")!;
  const min = getSourceLevelScaledValue(skills, row, archerLevel, "MinDam", [
    "MinLevDam1",
    "MinLevDam2",
    "MinLevDam3",
    "MinLevDam4",
    "MinLevDam5",
  ]);
  const max = getSourceLevelScaledValue(skills, row, archerLevel, "MaxDam", [
    "MaxLevDam1",
    "MaxLevDam2",
    "MaxLevDam3",
    "MaxLevDam4",
    "MaxLevDam5",
  ]);

  return {
    min: Math.floor(min * (1 + damagePercent / 100)),
    max: Math.floor(max * (1 + damagePercent / 100)),
  };
}

describeWithGameData("damage calculator component model", () => {
  beforeAll(async () => {
    ({ calculateDamage } = await import("./damage-calculator"));
  });

  it("keeps Rabies weapon source damage and poison payload as independent components", () => {
    const calculation = calculateDamage(createCharacter("Rabies", 20));
    const rabiesProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Rabies" &&
        profile.weaponId.startsWith("primary:right:one_handed")
    );

    expect(rabiesProfile).toBeDefined();

    const weaponComponent = rabiesProfile!.damageComponents.find(
      (component) => component.source === "weapon"
    );
    const poisonComponent = rabiesProfile!.damageComponents.find(
      (component) =>
        component.damageType === "poison" && component.timing === "over_time"
    );

    expect(weaponComponent).toMatchObject({
      source: "weapon",
      damageType: "physical",
      timing: "instant",
      damage: { min: 10, max: 20 },
    });
    expect(weaponComponent!.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "Skills.txt", row: "Rabies" }),
      ])
    );
    expect(poisonComponent).toBeDefined();
    expect(poisonComponent!.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: "Skills.txt", row: "Rabies" }),
      ])
    );
    expect(rabiesProfile!.damageTotals.instantDamage.max).toBeGreaterThan(0);
    expect(rabiesProfile!.damageTotals.overTimeDamage.max).toBeGreaterThan(0);
    expect(rabiesProfile!.damageTotals.combinedDamage).toEqual({
      min:
        rabiesProfile!.damageTotals.instantDamage.min +
        rabiesProfile!.damageTotals.overTimeDamage.min,
      max:
        rabiesProfile!.damageTotals.instantDamage.max +
        rabiesProfile!.damageTotals.overTimeDamage.max,
    });
  });

  it("models Vengeance converted elemental base, flat skill damage, and mastery", () => {
    const vengeanceLevel = 20;
    const synergyBaseLevel = 20;
    const fireSkillDamage = 10;
    const coldSkillDamage = 20;
    const character = createCharacter("Vengeance", vengeanceLevel);
    character.character.class = { id: 3, name: "Paladin" };
    character.character.skills = [
      { id: 102, name: "Holy Fire", level: synergyBaseLevel },
      { id: 111, name: "Vengeance", level: vengeanceLevel },
      { id: 114, name: "Holy Freeze", level: synergyBaseLevel },
      { id: 118, name: "Holy Shock", level: synergyBaseLevel },
      { id: 123, name: "Conviction", level: synergyBaseLevel },
    ];
    character.realSkills = [
      {
        skill: "Holy Fire",
        level: synergyBaseLevel,
        baseLevel: synergyBaseLevel,
      },
      { skill: "Vengeance", level: vengeanceLevel, baseLevel: vengeanceLevel },
      {
        skill: "Holy Freeze",
        level: synergyBaseLevel,
        baseLevel: synergyBaseLevel,
      },
      {
        skill: "Holy Shock",
        level: synergyBaseLevel,
        baseLevel: synergyBaseLevel,
      },
      {
        skill: "Conviction",
        level: synergyBaseLevel,
        baseLevel: synergyBaseLevel,
      },
    ];
    character.realStats = {
      ...character.realStats!,
      fireSkillDamage,
      coldSkillDamage,
    };
    character.items = [
      createWeapon({
        damage: {
          one_handed: { minimum: 100, maximum: 200 },
          two_handed: {},
          missile: {},
        },
        properties: ["Adds 10-20 Fire Damage"],
      }),
      createSimpleItem({
        id: "equipped-cold-ring",
        hash: "equipped-cold-ring",
        name: "Equipped Cold Ring",
        location: {
          zone: "Equipped",
          storage: "Unknown",
          zone_id: 1,
          storage_id: 0,
          equipment: "Right Ring",
          equipment_id: 6,
        },
        properties: ["Adds 30-40 Cold Damage"],
      }),
      createSimpleItem({
        id: "active-lightning-charm",
        hash: "active-lightning-charm",
        name: "Active Lightning Charm",
        base: {
          id: "cm1",
          category: "charm",
          codes: {},
          name: "Small Charm",
          stackable: false,
          type: "Small Charm",
          type_code: "scha",
          size: { height: 1, width: 1 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
        properties: ["Adds 5-7 Lightning Damage"],
      }),
    ];

    const calculation = calculateDamage(character);
    const vengeanceOption = calculation.skillOptions.find(
      (skill) => skill.name === "Vengeance"
    );
    const vengeanceProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Vengeance" &&
        profile.weaponId.startsWith("primary:right:one_handed") &&
        profile.playerAuraId === "none"
    );
    const percent = getExpectedVengeanceElementalPercentFromSkillsTxt({
      vengeanceLevel,
      holyFireBaseLevel: synergyBaseLevel,
      holyFreezeBaseLevel: synergyBaseLevel,
      holyShockBaseLevel: synergyBaseLevel,
      convictionBaseLevel: synergyBaseLevel,
    });
    const flatSkillBase = getExpectedVengeanceFlatElementalBaseFromSkillsTxt({
      vengeanceLevel,
    });
    const normalItemElemental = {
      fire: { min: 10, max: 20 },
      cold: { min: 30, max: 40 },
      lightning: { min: 5, max: 7 },
    };
    const convertedWeaponBase = {
      min:
        100 +
        normalItemElemental.fire.min +
        normalItemElemental.cold.min +
        normalItemElemental.lightning.min,
      max:
        200 +
        normalItemElemental.fire.max +
        normalItemElemental.cold.max +
        normalItemElemental.lightning.max,
    };
    const vengeanceBase = {
      min: convertedWeaponBase.min + flatSkillBase.min,
      max: convertedWeaponBase.max + flatSkillBase.max,
    };
    const withVengeancePercent = {
      min: Math.floor(vengeanceBase.min * (1 + percent / 100)),
      max: Math.floor(vengeanceBase.max * (1 + percent / 100)),
    };
    const expectedVengeanceDamage = {
      fire: {
        min: Math.floor(withVengeancePercent.min * (1 + fireSkillDamage / 100)),
        max: Math.floor(withVengeancePercent.max * (1 + fireSkillDamage / 100)),
      },
      cold: {
        min: Math.floor(withVengeancePercent.min * (1 + coldSkillDamage / 100)),
        max: Math.floor(withVengeancePercent.max * (1 + coldSkillDamage / 100)),
      },
      lightning: withVengeancePercent,
    };
    const expectedElementTotals = {
      fire: {
        min: normalItemElemental.fire.min + expectedVengeanceDamage.fire.min,
        max: normalItemElemental.fire.max + expectedVengeanceDamage.fire.max,
      },
      cold: {
        min: normalItemElemental.cold.min + expectedVengeanceDamage.cold.min,
        max: normalItemElemental.cold.max + expectedVengeanceDamage.cold.max,
      },
      lightning: {
        min:
          normalItemElemental.lightning.min +
          expectedVengeanceDamage.lightning.min,
        max:
          normalItemElemental.lightning.max +
          expectedVengeanceDamage.lightning.max,
      },
    };

    expect(vengeanceOption).toMatchObject({ damageMode: "weapon" });
    expect(vengeanceProfile).toBeDefined();

    (["fire", "cold", "lightning"] as const).forEach((element) => {
      expect(
        vengeanceProfile!.damageComponents.find(
          (component) =>
            component.label === `Vengeance ${element} damage` &&
            component.damageType === element
        )
      ).toMatchObject({
        source: "skill",
        damage: expectedVengeanceDamage[element],
        baseDamage: vengeanceBase,
      });
      expect(vengeanceProfile!.totalElementalDamage[element]).toEqual(
        expectedElementTotals[element]
      );
    });

    expect(
      vengeanceProfile!.damageComponents.some((component) =>
        component.label.startsWith("Skill: ")
      )
    ).toBe(false);
    expect(
      vengeanceProfile!.damageComponents.some((component) =>
        component.label.includes("weapon conversion")
      )
    ).toBe(false);
    expect(vengeanceProfile!.damageTotals.combinedDamage.min).toBe(
      100 +
        expectedElementTotals.fire.min +
        expectedElementTotals.cold.min +
        expectedElementTotals.lightning.min
    );
    expect(vengeanceProfile!.damageTotals.combinedDamage.max).toBe(
      200 +
        expectedElementTotals.fire.max +
        expectedElementTotals.cold.max +
        expectedElementTotals.lightning.max
    );
  });

  it("limits flat item elemental damage to equipped items and active inventory charms", () => {
    const character = createCharacter("Rabies", 1);
    character.items = [
      createWeapon(),
      createSimpleItem({
        id: "equipped-ring",
        hash: "equipped-ring",
        name: "Equipped Ring",
        location: {
          zone: "Equipped",
          storage: "Unknown",
          zone_id: 1,
          storage_id: 0,
          equipment: "Right Ring",
          equipment_id: 10,
        },
        properties: ["Adds 7-9 Cold Damage"],
      }),
      createSimpleItem({
        id: "active-charm",
        hash: "active-charm",
        name: "Active Charm",
        base: {
          id: "cm1",
          category: "charm",
          codes: {},
          name: "Small Charm",
          stackable: false,
          type: "Small Charm",
          type_code: "scha",
          size: { height: 1, width: 1 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
        location: {
          zone: "Stored",
          storage: "Inventory",
          zone_id: 2,
          storage_id: 1,
          equipment: "Left Hand Switch",
          equipment_id: 0,
        },
        properties: ["Adds 3-5 Fire Damage"],
      }),
      createSimpleItem({
        id: "inventory-ring",
        hash: "inventory-ring",
        name: "Inventory Ring",
        properties: ["Adds 100-200 Fire Damage"],
      }),
      createSimpleItem({
        id: "cube-charm",
        hash: "cube-charm",
        name: "Cube Charm",
        base: {
          id: "cm1",
          category: "charm",
          codes: {},
          name: "Small Charm",
          stackable: false,
          type: "Small Charm",
          type_code: "scha",
          size: { height: 1, width: 1 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
        location: {
          zone: "Stored",
          storage: "Cube",
          zone_id: 4,
          storage_id: 4,
        },
        properties: ["Adds 11-13 Lightning Damage"],
      }),
    ];

    const calculation = calculateDamage(character);
    const basicAttackProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Basic Attack" &&
        profile.weaponId.startsWith("primary:right:one_handed")
    );

    expect(basicAttackProfile).toBeDefined();
    expect(basicAttackProfile!.totalElementalDamage.fire).toEqual({
      min: 3,
      max: 5,
    });
    expect(basicAttackProfile!.totalElementalDamage.cold).toEqual({
      min: 7,
      max: 9,
    });
    expect(basicAttackProfile!.totalElementalDamage.lightning).toBeUndefined();
  });

  it("counts plus-prefixed off-weapon enhanced damage from equipped items and active charms", () => {
    const character = createCharacter("Rabies", 1);
    character.items = [
      createWeapon({
        properties: ["+500% Enhanced Damage"],
        damage: {
          one_handed: { minimum: 100, maximum: 200 },
          two_handed: {},
          missile: {},
        },
      }),
      createSimpleItem({
        id: "equipped-amulet",
        hash: "equipped-amulet",
        name: "Equipped Amulet",
        location: {
          zone: "Equipped",
          storage: "Unknown",
          zone_id: 1,
          storage_id: 0,
          equipment: "Amulet",
          equipment_id: 2,
        },
        properties: ["+50% Enhanced Damage"],
      }),
      createSimpleItem({
        id: "active-charm-ed",
        hash: "active-charm-ed",
        name: "Active ED Charm",
        base: {
          id: "cm1",
          category: "charm",
          codes: {},
          name: "Small Charm",
          stackable: false,
          type: "Small Charm",
          type_code: "scha",
          size: { height: 1, width: 1 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
        location: {
          zone: "Stored",
          storage: "Inventory",
          zone_id: 2,
          storage_id: 1,
          equipment: "Left Hand Switch",
          equipment_id: 0,
        },
        properties: ["25% Enhanced Damage"],
      }),
      createSimpleItem({
        id: "inactive-ring-ed",
        hash: "inactive-ring-ed",
        name: "Inactive ED Ring",
        properties: ["+900% Enhanced Damage"],
      }),
    ];

    const calculation = calculateDamage(character);
    const basicAttackProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Basic Attack" &&
        profile.weaponId.startsWith("primary:right:one_handed")
    );

    expect(basicAttackProfile).toBeDefined();
    expect(
      basicAttackProfile!.breakdown.physicalBonusPercent.nonWeapon
    ).toBe(75);
    expect(basicAttackProfile!.breakdown.physicalBonusPercent.total).toBe(75);
    expect(basicAttackProfile!.totalPhysicalDamage).toEqual({
      min: 175,
      max: 350,
    });
  });

  it("treats direct missile spells without source damage as spell profiles", () => {
    const character = createCharacter("Charged Bolt", 20);
    character.character.class = { id: 1, name: "Sorceress" };
    character.realSkills = [
      { skill: "Charged Bolt", level: 44, baseLevel: 20 },
      { skill: "Lightning", level: 25, baseLevel: 1 },
      { skill: "Telekinesis", level: 44, baseLevel: 20 },
      { skill: "Lightning Mastery", level: 47, baseLevel: 20 },
    ];
    character.realStats!.lightningSkillDamage = 25;

    const calculation = calculateDamage(character);
    const chargedBoltOption = calculation.skillOptions.find(
      (skill) => skill.name === "Charged Bolt"
    );
    const chargedBoltProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Charged Bolt" && profile.playerAuraId === "none"
    );

    expect(chargedBoltOption).toMatchObject({ damageMode: "spell" });
    expect(chargedBoltProfile).toMatchObject({
      skillDamageMode: "spell",
      damageScope: expect.objectContaining({
        label: "per bolt",
        count: 28,
        countLabel: "bolts",
      }),
    });
    expect(
      chargedBoltProfile!.damageComponents.some(
        (component) => component.source === "weapon"
      )
    ).toBe(false);
    expect(chargedBoltProfile!.damageTotals.combinedDamage.max).toBeGreaterThan(
      900
    );
  });

  it("defaults to the highest combined damage base profile", () => {
    const calculation = calculateDamage(createCharacter("Rabies", 20));
    const defaultProfile = calculation.profiles.find(
      (profile) =>
        profile.weaponId === calculation.defaultSelection?.weaponId &&
        profile.skillId === calculation.defaultSelection?.skillId &&
        profile.playerAuraId === calculation.defaultSelection?.playerAuraId &&
        profile.playerAuraCarrier ===
          calculation.defaultSelection?.playerAuraCarrier &&
        profile.transformationId === "none"
    );
    const maxAverageCombinedDamage = Math.max(
      ...calculation.profiles
        .filter(
          (profile) =>
            profile.playerAuraId === "none" &&
            profile.playerAuraCarrier === "self" &&
            profile.transformationId === "none"
        )
        .map((profile) => profile.damageTotals.averageCombinedDamage)
    );

    expect(defaultProfile).toBeDefined();
    expect(defaultProfile!.skillName).toBe("Rabies");
    expect(calculation.defaultSelection?.transformationId).toMatch(
      /^Werewolf:/
    );
    expect(defaultProfile!.damageTotals.averageCombinedDamage).toBe(
      maxAverageCombinedDamage
    );
  });

  it("applies game-file Rabies synergies through source-data skill aliases", () => {
    const character = createCharacter("Rabies", 41);
    character.realSkills = [
      { skill: "Rabies", level: 41, baseLevel: 20 },
      { skill: "Poison Creeper", level: 29, baseLevel: 20 },
      { skill: "Feral Rage", level: 41, baseLevel: 20 },
      { skill: "Lycanthropy", level: 41, baseLevel: 20 },
    ];
    character.realStats!.poisonSkillDamage = 78;

    const calculation = calculateDamage(character);
    const rabiesProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Rabies" &&
        profile.weaponId.startsWith("primary:right:one_handed")
    );
    const poisonComponent = rabiesProfile!.damageComponents.find(
      (component) =>
        component.damageType === "poison" && component.timing === "over_time"
    );

    expect(rabiesProfile).toBeDefined();
    expect(poisonComponent).toBeDefined();
    expect(poisonComponent!.damage.min).toBeGreaterThan(35000);
    expect(poisonComponent!.damage.max).toBeLessThan(36000);
    expect(rabiesProfile!.totalPoisonDamage!.total).toBeGreaterThan(35000);
  });

  it("models elemental attack aura payloads from Skills.txt fixed-point formulas", () => {
    const calculation = calculateDamage(createCharacter("Rabies", 20));
    const cases = [
      { skill: "Holy Fire", element: "fire", level: 20 },
      { skill: "Holy Freeze", element: "cold", level: 20 },
      { skill: "Holy Shock", element: "lightning", level: 20 },
      { skill: "Sanctuary", element: "magic", level: 12 },
    ];

    cases.forEach(({ skill, element, level }) => {
      const option = calculation.playerAuraOptions.find(
        (aura) => aura.name === skill
      );
      const expected = getExpectedAuraPayloadsFromSkillsTxt(skill, level);

      expect(option).toBeDefined();
      expect(
        option!.selfLevelBonuses.find((bonus) => bonus.level === level)!
          .elementalDamage[element]
      ).toEqual(expected.self);
      expect(
        option!.partyLevelBonuses.find((bonus) => bonus.level === level)!
          .elementalDamage[element]
      ).toEqual(expected.party);
    });
  });

  it("models party physical aura bonuses from Skills.txt aurastatcalc formulas", () => {
    const calculation = calculateDamage(createCharacter("Rabies", 20));
    const might = calculation.playerAuraOptions.find(
      (aura) => aura.name === "Might"
    );
    const selfLevel20 = might!.selfLevelBonuses.find(
      (bonus) => bonus.level === 20
    );
    const partyLevel20 = might!.partyLevelBonuses.find(
      (bonus) => bonus.level === 20
    );
    const baseProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Basic Attack" && profile.playerAuraId === "none"
    );
    const partyProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Basic Attack" &&
        profile.playerAuraId === "Might" &&
        profile.playerAuraCarrier === "party"
    );

    expect(might).toBeDefined();
    expect(selfLevel20!.physicalBonusPercent).toBe(
      getExpectedMightPhysicalBonusFromSkillsTxt(20, "self")
    );
    expect(partyLevel20!.physicalBonusPercent).toBe(
      getExpectedMightPhysicalBonusFromSkillsTxt(20, "party")
    );
    expect(partyProfile!.breakdown.physicalBonusPercent.activeAuras).toBe(
      getExpectedMightPhysicalBonusFromSkillsTxt(1, "party")
    );
    expect(partyProfile!.damageTotals.combinedDamage.min).toBeGreaterThan(
      baseProfile!.damageTotals.combinedDamage.min
    );
  });

  it("applies Battle Command all-skills bonuses to spell damage profiles", () => {
    const character = createCharacter("War Cry", 20);
    character.character.class = { id: 4, name: "Barbarian" };
    character.character.skills = [
      { id: 154, name: "War Cry", level: 20 },
      { id: 155, name: "Battle Command", level: 20 },
    ];
    character.realSkills = [
      { skill: "War Cry", level: 20, baseLevel: 20 },
      { skill: "Battle Command", level: 20, baseLevel: 20 },
    ];

    const calculation = calculateDamage(character);
    const battleCommand = calculation.playerAuraOptions.find(
      (aura) => aura.name === "Battle Command"
    );
    const skillLevelBonus =
      getExpectedBattleCommandSkillLevelBonusFromSkillsTxt(20);
    const physicalBonus =
      getExpectedBattleCommandPhysicalBonusFromSkillsTxt(20);
    const baseProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "War Cry" && profile.playerAuraId === "none"
    );
    const battleCommandProfile = calculation.profiles.find(
      (profile) =>
        profile.weaponId === baseProfile?.weaponId &&
        profile.skillName === "War Cry" &&
        profile.playerAuraId === "Battle Command" &&
        profile.playerAuraCarrier === "self"
    );

    expect(battleCommand).toBeDefined();
    expect(
      battleCommand!.selfLevelBonuses.find((bonus) => bonus.level === 20)
    ).toMatchObject({
      skillLevelBonus,
      physicalBonusPercent: physicalBonus,
    });
    expect(baseProfile).toBeDefined();
    expect(battleCommandProfile).toBeDefined();
    expect(battleCommandProfile!.skillLevel).toBe(
      baseProfile!.skillLevel + skillLevelBonus
    );
    expect(
      battleCommandProfile!.damageTotals.combinedDamage.min
    ).toBeGreaterThan(baseProfile!.damageTotals.combinedDamage.min);
    expect(
      battleCommandProfile!.breakdown.physicalBonusPercent.activeAuras
    ).toBe(0);
    expect(battleCommandProfile!.activeAuras).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Battle Command",
          level: 20,
          source: "player_skill",
          carrier: "self",
        }),
      ])
    );
  });

  it("reports direct physical skill synergies in spell breakdowns", () => {
    const character = createCharacter("War Cry", 20);
    character.character.class = { id: 4, name: "Barbarian" };
    character.character.skills = [
      { id: 154, name: "War Cry", level: 20 },
      { id: 130, name: "Howl", level: 20 },
      { id: 146, name: "Battle Cry", level: 10 },
      { id: 131, name: "Taunt", level: 5 },
      { id: 138, name: "Shout", level: 5 },
      { id: 155, name: "Battle Command", level: 1 },
      { id: 149, name: "Battle Orders", level: 1 },
    ];
    character.realSkills = [
      { skill: "War Cry", level: 20, baseLevel: 20 },
      { skill: "Howl", level: 20, baseLevel: 20 },
      { skill: "Battle Cry", level: 10, baseLevel: 10 },
      { skill: "Taunt", level: 5, baseLevel: 5 },
      { skill: "Shout", level: 5, baseLevel: 5 },
      { skill: "Battle Command", level: 1, baseLevel: 1 },
      { skill: "Battle Orders", level: 1, baseLevel: 1 },
    ];

    const calculation = calculateDamage(character);
    const expectedSynergy = getExpectedWarCryPhysicalSynergyFromSkillsTxt({
      howlBaseLevel: 20,
      battleCryBaseLevel: 10,
      tauntBaseLevel: 5,
      shoutBaseLevel: 5,
      battleCommandBaseLevel: 1,
      battleOrdersBaseLevel: 1,
    });
    const warCryProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "War Cry" && profile.playerAuraId === "none"
    );

    expect(warCryProfile).toBeDefined();
    expect(warCryProfile!.skillDamageMode).toBe("spell");
    expect(
      warCryProfile!.breakdown.physicalBonusPercent.selectedSkillSynergy
    ).toBe(expectedSynergy);
    expect(warCryProfile!.breakdown.physicalBonusPercent.total).toBe(
      expectedSynergy
    );
    expectPhysicalBonusTotalToMatchBuckets(warCryProfile);
    expect(warCryProfile!.totalPhysicalDamage.min).toBeGreaterThan(0);
  });

  it("does not double-report direct physical weapon skill synergies in the physical bonus total", () => {
    const character = createCharacter("Blade Fury", 20);
    character.character.class = { id: 6, name: "Assassin" };
    character.character.skills = [
      { id: 257, name: "Blade Sentinel", level: 20 },
      { id: 266, name: "Blade Fury", level: 20 },
      { id: 277, name: "Blade Shield", level: 20 },
    ];
    character.realSkills = [
      { skill: "Blade Sentinel", level: 20, baseLevel: 20 },
      { skill: "Blade Fury", level: 20, baseLevel: 20 },
      { skill: "Blade Shield", level: 20, baseLevel: 20 },
    ];
    character.items = [
      createWeapon({
        damage: {
          one_handed: { minimum: 100, maximum: 200 },
          two_handed: {},
          missile: {},
        },
      }),
    ];

    const calculation = calculateDamage(character);
    const bladeFuryProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Blade Fury" &&
        profile.weaponId.startsWith("primary:right:one_handed") &&
        profile.playerAuraId === "none"
    );
    const directPhysicalComponent = bladeFuryProfile?.damageComponents.find(
      (component) =>
        component.label === "Skill: Physical" &&
        component.sourceRefs.some((ref) =>
          ref.columns.includes("DmgSymPerCalc")
        )
    );

    expect(bladeFuryProfile).toBeDefined();
    expect(directPhysicalComponent).toBeDefined();
    expect(
      bladeFuryProfile!.breakdown.physicalBonusPercent.selectedSkillSynergy
    ).toBe(0);
    expectPhysicalBonusTotalToMatchBuckets(bladeFuryProfile);
  });

  it("labels stream skills as per-second damage", () => {
    const character = createCharacter("Arctic Blast", 20);

    const calculation = calculateDamage(character);
    const arcticBlastProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Arctic Blast" && profile.playerAuraId === "none"
    );

    expect(arcticBlastProfile).toBeDefined();
    expect(arcticBlastProfile!.damageScope.label).toBe("per second");
    expect(arcticBlastProfile!.damageScope.note).toContain("stream damage");
  });

  it("does not add Fists of Fire meteor physical payload as direct damage", () => {
    const character = createCharacter("Fists of Fire", 20);
    character.character.class = { id: 6, name: "Assassin" };
    character.character.skills = [
      { id: 259, name: "Fists of Fire", level: 20 },
      { id: 254, name: "Tiger Strike", level: 20 },
      { id: 365, name: "Dragon Flight", level: 20 },
    ];
    character.realSkills = [
      { skill: "Fists of Fire", level: 20, baseLevel: 20 },
      { skill: "Tiger Strike", level: 20, baseLevel: 20 },
      { skill: "Dragon Flight", level: 20, baseLevel: 20 },
    ];
    character.items = [
      createWeapon({
        base_code: "ktr",
        base: {
          id: "ktr",
          category: "weapon",
          codes: {},
          name: "Katar",
          stackable: false,
          type: "Katar",
          type_code: "h2h",
          size: { height: 3, width: 1 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
      } as Partial<IItem>),
    ];

    const calculation = calculateDamage(character);
    const fistsOfFireProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Fists of Fire" && profile.playerAuraId === "none"
    );
    const missilePhysicalComponents =
      fistsOfFireProfile?.damageComponents.filter(
        (component) =>
          component.source === "missile" && component.damageType === "physical"
      ) || [];
    const meteorFireComponent = fistsOfFireProfile?.damageComponents.find(
      (component) =>
        component.source === "missile" &&
        component.damageType === "fire" &&
        component.sourceRefs.some((ref) => ref.row === "fofmeteor")
    );

    expect(fistsOfFireProfile).toBeDefined();
    expect(fistsOfFireProfile!.damageScope.label).toBe(
      "per full charge release"
    );
    expect(missilePhysicalComponents).toHaveLength(0);
    expect(meteorFireComponent).toBeDefined();
  });

  it("models Venom as a self-only poison attack buff from Skills.txt", () => {
    const venomLevel = 20;
    const cobraStrikeBaseLevel = 20;
    const poisonSkillDamage = 25;
    const character = createCharacter("Venom", venomLevel);
    character.character.class = { id: 6, name: "Assassin" };
    character.character.skills = [
      { id: 278, name: "Venom", level: venomLevel },
      { id: 271, name: "Cobra Strike", level: cobraStrikeBaseLevel },
    ];
    character.realSkills = [
      { skill: "Venom", level: venomLevel, baseLevel: venomLevel },
      {
        skill: "Cobra Strike",
        level: cobraStrikeBaseLevel,
        baseLevel: cobraStrikeBaseLevel,
      },
    ];
    character.realStats!.poisonSkillDamage = poisonSkillDamage;

    const calculation = calculateDamage(character);
    const venom = calculation.playerAuraOptions.find(
      (aura) => aura.name === "Venom"
    );
    const expectedLevelBonus = getExpectedVenomPoisonPayloadFromSkillsTxt(
      venomLevel,
      0,
      0
    );
    const expectedProfileDamage = getExpectedVenomPoisonPayloadFromSkillsTxt(
      venomLevel,
      cobraStrikeBaseLevel,
      poisonSkillDamage
    );
    const baseProfile = calculation.profiles.find(
      (profile) =>
        profile.skillName === "Basic Attack" && profile.playerAuraId === "none"
    );
    const venomProfile = calculation.profiles.find(
      (profile) =>
        profile.weaponId === baseProfile?.weaponId &&
        profile.skillName === "Basic Attack" &&
        profile.playerAuraId === "Venom" &&
        profile.playerAuraCarrier === "self"
    );
    const venomPartyProfile = calculation.profiles.find(
      (profile) =>
        profile.weaponId === baseProfile?.weaponId &&
        profile.skillName === "Basic Attack" &&
        profile.playerAuraId === "Venom" &&
        profile.playerAuraCarrier === "party"
    );
    const venomComponent = venomProfile?.damageComponents.find(
      (component) =>
        component.source === "aura" &&
        component.damageType === "poison" &&
        component.label === "Venom poison"
    );

    expect(venom).toBeDefined();
    expect(
      venom!.selfLevelBonuses.find((bonus) => bonus.level === venomLevel)
    ).toMatchObject({
      poisonDamage: expectedLevelBonus,
    });
    expect(
      venom!.partyLevelBonuses.find((bonus) => bonus.level === venomLevel)!
        .poisonDamage
    ).toBeUndefined();
    expect(baseProfile).toBeDefined();
    expect(venomProfile).toBeDefined();
    expect(venomComponent).toMatchObject({
      source: "aura",
      damageType: "poison",
      timing: "over_time",
      damage: expectedProfileDamage.damage,
      poisonDamage: {
        total: expectedProfileDamage.total,
        durationSeconds: expectedProfileDamage.durationSeconds,
      },
    });
    expect(venomProfile!.damageTotals.overTimeDamage).toEqual(
      expectedProfileDamage.damage
    );
    expect(venomProfile!.damageTotals.combinedDamage.min).toBe(
      baseProfile!.damageTotals.combinedDamage.min +
        expectedProfileDamage.damage.min
    );
    expect(venomPartyProfile).toBeDefined();
    expect(
      venomPartyProfile!.damageComponents.some(
        (component) =>
          component.source === "aura" && component.damageType === "poison"
      )
    ).toBe(false);
  });

  it("uses item-granted aura levels without borrowing native skill synergies", () => {
    const character = createCharacter("Rabies", 20);
    character.items[0].properties = ["Level 12 Sanctuary Aura When Equipped"];
    character.realSkills = [
      { skill: "Might", level: 13, baseLevel: 1 },
      { skill: "Blessed Aim", level: 32, baseLevel: 20 },
    ];

    const calculation = calculateDamage(character);
    const profile = calculation.profiles.find(
      (candidate) => candidate.playerAuraId === "none"
    );
    const sanctuaryComponent = profile!.damageComponents.find(
      (component) => component.id === "aura-Sanctuary-12-self-magic"
    );

    expect(sanctuaryComponent!.damage).toEqual(
      getExpectedAuraPayloadsFromSkillsTxt("Sanctuary", 12).self
    );
  });

  it("adds source-backed two-weapon sequence profiles for optional dual-wield cycles", () => {
    const character = createCharacter("Whirlwind", 20);
    character.character.class = { id: 4, name: "Barbarian" };
    character.items = [
      createWeapon({
        id: "right-weapon",
        hash: "right-weapon",
        name: "Right Club",
        damage: {
          one_handed: { minimum: 10, maximum: 20 },
          two_handed: {},
          missile: {},
        },
      } as Partial<IItem>),
      createWeapon({
        id: "left-weapon",
        hash: "left-weapon",
        name: "Left Club",
        location: {
          zone: "Equipped",
          storage: "Equipped",
          zone_id: 1,
          storage_id: 0,
          equipment: "Left Hand",
          equipment_id: 5,
        },
        damage: {
          one_handed: { minimum: 30, maximum: 40 },
          two_handed: {},
          missile: {},
        },
      } as Partial<IItem>),
    ];

    const calculation = calculateDamage(character);
    const sequenceOption = calculation.weaponOptions.find(
      (option) => option.handMode === "dual_wield"
    );
    const sequenceProfile = calculation.profiles.find(
      (profile) =>
        profile.weaponId === sequenceOption?.id &&
        profile.skillId === "Whirlwind" &&
        profile.playerAuraId === "none"
    );
    const rightProfile = calculation.profiles.find(
      (profile) =>
        profile.weaponId.includes("right-weapon") &&
        profile.skillId === "Whirlwind" &&
        profile.playerAuraId === "none"
    );
    const leftProfile = calculation.profiles.find(
      (profile) =>
        profile.weaponId.includes("left-weapon") &&
        profile.skillId === "Whirlwind" &&
        profile.playerAuraId === "none"
    );

    expect(sequenceOption?.sequenceHits).toHaveLength(2);
    expect(sequenceProfile?.sequenceHits).toHaveLength(2);
    expect(sequenceProfile?.damageTotals.combinedDamage).toEqual({
      min:
        rightProfile!.damageTotals.combinedDamage.min +
        leftProfile!.damageTotals.combinedDamage.min,
      max:
        rightProfile!.damageTotals.combinedDamage.max +
        leftProfile!.damageTotals.combinedDamage.max,
    });
    expect(sequenceProfile?.notes.join(" ")).toContain("weapsel=2");
  });

  it("restricts required dual-wield skills to paired weapon profiles", () => {
    const character = createCharacter("Frenzy", 20);
    character.character.class = { id: 4, name: "Barbarian" };
    character.items = [
      createWeapon({
        id: "right-weapon",
        hash: "right-weapon",
        name: "Right Club",
        damage: {
          one_handed: { minimum: 10, maximum: 20 },
          two_handed: {},
          missile: {},
        },
      } as Partial<IItem>),
      createWeapon({
        id: "left-weapon",
        hash: "left-weapon",
        name: "Left Club",
        location: {
          zone: "Equipped",
          storage: "Equipped",
          zone_id: 1,
          storage_id: 0,
          equipment: "Left Hand",
          equipment_id: 5,
        },
        damage: {
          one_handed: { minimum: 30, maximum: 40 },
          two_handed: {},
          missile: {},
        },
      } as Partial<IItem>),
    ];

    const calculation = calculateDamage(character);
    const frenzyProfiles = calculation.profiles.filter(
      (profile) =>
        profile.skillId === "Frenzy" && profile.playerAuraId === "none"
    );
    const profileWeaponOptions = frenzyProfiles.map((profile) =>
      calculation.weaponOptions.find((option) => option.id === profile.weaponId)
    );

    expect(frenzyProfiles).toHaveLength(1);
    expect(
      profileWeaponOptions.every((option) => option?.handMode === "dual_wield")
    ).toBe(true);
    expect(frenzyProfiles[0].sequenceHits).toHaveLength(2);
    expect(frenzyProfiles[0].notes.join(" ")).toContain("required two-weapon");
  });

  it("restricts Double Throw to paired thrown weapon profiles", () => {
    const character = createCharacter("Double Throw", 20);
    character.character.class = { id: 4, name: "Barbarian" };
    character.items = [
      createWeapon({
        id: "right-throw",
        hash: "right-throw",
        name: "Right Throwing Axe",
        base_code: "tax",
        base: {
          id: "tax",
          category: "weapon",
          codes: {},
          name: "Throwing Axe",
          stackable: true,
          type: "Throwing Axe",
          type_code: "taxe",
          size: { height: 3, width: 1 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
        damage: {
          one_handed: { minimum: 10, maximum: 20 },
          two_handed: {},
          missile: { minimum: 15, maximum: 25 },
        },
      } as Partial<IItem>),
      createWeapon({
        id: "left-throw",
        hash: "left-throw",
        name: "Left Throwing Knife",
        base_code: "tkf",
        base: {
          id: "tkf",
          category: "weapon",
          codes: {},
          name: "Throwing Knife",
          stackable: true,
          type: "Throwing Knife",
          type_code: "tkni",
          size: { height: 2, width: 1 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
        location: {
          zone: "Equipped",
          storage: "Equipped",
          zone_id: 1,
          storage_id: 0,
          equipment: "Left Hand",
          equipment_id: 5,
        },
        damage: {
          one_handed: { minimum: 30, maximum: 40 },
          two_handed: {},
          missile: { minimum: 35, maximum: 45 },
        },
      } as Partial<IItem>),
    ];

    const calculation = calculateDamage(character);
    const doubleThrowProfiles = calculation.profiles.filter(
      (profile) =>
        profile.skillId === "Double Throw" && profile.playerAuraId === "none"
    );
    const profileWeaponOptions = doubleThrowProfiles.map((profile) =>
      calculation.weaponOptions.find((option) => option.id === profile.weaponId)
    );

    expect(
      calculation.weaponOptions.some((option) => option.handMode === "missile")
    ).toBe(true);
    expect(doubleThrowProfiles).toHaveLength(1);
    expect(
      profileWeaponOptions.every((option) => option?.handMode === "dual_throw")
    ).toBe(true);
    expect(doubleThrowProfiles[0].sequenceHits).toEqual([
      expect.objectContaining({
        handMode: "missile",
        itemName: "Right Throwing Axe",
      }),
      expect.objectContaining({
        handMode: "missile",
        itemName: "Left Throwing Knife",
      }),
    ]);
    expect(doubleThrowProfiles[0].notes.join(" ")).toContain(
      "required two-throw"
    );
  });

  it("uses bow two-handed armory damage as a missile weapon option", () => {
    const character = createCharacter("Magic Arrow", 20);
    character.character.class = { id: 0, name: "Amazon" };
    character.realStats!.dexterity = 100;
    character.items = [
      createWeapon({
        id: "test-bow",
        hash: "test-bow",
        name: "Test Bow",
        base_code: "hbw",
        base: {
          id: "hbw",
          category: "weapon",
          codes: {},
          name: "Hunter's Bow",
          stackable: false,
          type: "Bow",
          type_code: "bow",
          size: { height: 3, width: 2 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
        location: {
          zone: "Equipped",
          storage: "Equipped",
          zone_id: 1,
          storage_id: 0,
          equipment: "Left Hand",
          equipment_id: 5,
        },
        damage: {
          one_handed: {},
          two_handed: { minimum: 30, maximum: 60 },
          missile: {},
        },
      } as Partial<IItem>),
      {
        id: "test-charm",
        hash: "test-charm",
        name: "Sharp Charm",
        category: "charm",
        base_code: "cm1",
        base: {
          id: "cm1",
          category: "charm",
          codes: {},
          name: "Small Charm",
          stackable: false,
          type: "Small Charm",
          type_code: "scha",
          size: { height: 1, width: 1 },
          requirements: { level: 0, strength: 0, dexterity: 0 },
        },
        quality: { id: 4, name: "Magic" },
        location: {
          zone: "Inventory",
          storage: "Inventory",
          zone_id: 2,
          storage_id: 1,
        },
        position: { row: 0, column: 0 },
        properties: ["+12 to Minimum Damage"],
        is_identified: true,
        is_socketed: false,
        is_new: false,
        is_ear: false,
        is_starter: false,
        is_simple: false,
        is_ethereal: false,
        is_personalized: false,
        is_runeword: false,
        socketed_count: 0,
        item_level: 1,
        graphic_id: 0,
        class_specifics: false,
        socket_count: 0,
        modifiers: [],
        corrupted: false,
        desecrated: false,
      } as unknown as IItem,
    ];

    const calculation = calculateDamage(character);
    const primaryWeaponOptions = calculation.weaponOptions.filter(
      (option) => option.weaponSet === "primary"
    );
    const bowOption = primaryWeaponOptions.find(
      (option) => option.itemName === "Test Bow"
    );
    const magicArrowProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Magic Arrow" &&
        profile.weaponId === bowOption?.id &&
        profile.playerAuraId === "none"
    );

    expect(bowOption).toMatchObject({
      handMode: "missile",
      itemName: "Test Bow",
    });
    expect(
      primaryWeaponOptions.some((option) => option.handMode === "unarmed")
    ).toBe(false);
    expect(magicArrowProfile?.breakdown.flatPhysicalDamage).toEqual({
      min: 12,
      max: 12,
    });
    expect(magicArrowProfile?.damageTotals.combinedDamage.max).toBeGreaterThan(
      0
    );
  });

  it("uses equipped boots as the source item for kick skills", () => {
    const character = createCharacter("Dragon Talon", 20);
    character.character.class = { id: 6, name: "Assassin" };
    character.items = [createWeapon(), createBoot()];

    const calculation = calculateDamage(character);
    const kickOptions = calculation.weaponOptions.filter(
      (option) => option.handMode === "kick"
    );
    const dragonTalonProfiles = calculation.profiles.filter(
      (profile) =>
        profile.skillId === "Dragon Talon" && profile.playerAuraId === "none"
    );
    const dragonTalonWeaponOptions = dragonTalonProfiles.map((profile) =>
      calculation.weaponOptions.find((option) => option.id === profile.weaponId)
    );
    const primaryKickProfile = dragonTalonProfiles.find((profile) =>
      profile.weaponId.startsWith("primary:feet:kick")
    );
    const bootComponent = primaryKickProfile?.damageComponents.find(
      (component) => component.source === "weapon"
    );
    const basicAttackProfiles = calculation.profiles.filter(
      (profile) => profile.skillId === "Basic Attack"
    );

    expect(kickOptions).toHaveLength(2);
    expect(kickOptions.every((option) => option.slot === "feet")).toBe(true);
    expect(dragonTalonProfiles).toHaveLength(2);
    expect(
      dragonTalonWeaponOptions.every((option) => option?.handMode === "kick")
    ).toBe(true);
    expect(
      basicAttackProfiles.some((profile) =>
        profile.weaponId.includes(":feet:kick:")
      )
    ).toBe(false);
    expect(bootComponent).toMatchObject({
      label: "Boot source (Dragon Talon)",
      baseDamage: { min: 20, max: 30 },
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({ table: "Armory item data" }),
        expect.objectContaining({
          table: "Skills.txt",
          row: "Dragon Talon",
          columns: ["Kick", "leftskill", "descatt"],
        }),
      ]),
    });
  });

  it("does not offer kick skill profiles without equipped boots", () => {
    const character = createCharacter("Dragon Talon", 20);
    character.character.class = { id: 6, name: "Assassin" };

    const calculation = calculateDamage(character);

    expect(
      calculation.profiles.some((profile) => profile.skillId === "Dragon Talon")
    ).toBe(false);
    expect(
      calculation.weaponOptions.some((option) => option.handMode === "kick")
    ).toBe(false);
  });

  it("marks transformation eligibility from Skills.txt state restrictions", () => {
    const whirlwindCharacter = createCharacter("Whirlwind", 20);
    whirlwindCharacter.character.class = { id: 4, name: "Barbarian" };
    const whirlwindCalculation = calculateDamage(whirlwindCharacter);
    const whirlwindOption = whirlwindCalculation.skillOptions.find(
      (option) => option.id === "Whirlwind"
    );
    const basicAttackOption = whirlwindCalculation.skillOptions.find(
      (option) => option.id === "Basic Attack"
    );

    const furyCharacter = createCharacter("Fury", 20);
    const furyCalculation = calculateDamage(furyCharacter);
    const furyOption = furyCalculation.skillOptions.find(
      (option) => option.id === "Fury"
    );

    expect(basicAttackOption?.canUseTransformation).toBe(true);
    expect(whirlwindOption?.canUseTransformation).toBe(false);
    expect(whirlwindOption?.allowedTransformationIds).toEqual([]);
    expect(furyOption?.canUseTransformation).toBe(true);
    expect(furyOption?.allowedTransformationIds).toEqual(["Werewolf"]);
  });
});

describeWithMonStatsData("summon damage modeling", () => {
  it("offers source-backed summon skills through summon source options", () => {
    const character = createCharacter("Summon Grizzly", 20);
    character.character.class = { id: 5, name: "Druid" };
    character.character.skills = [
      { id: 247, name: "Summon Grizzly", level: 20 },
      { id: 221, name: "Raven", level: 20 },
      { id: 227, name: "Summon Spirit Wolf", level: 20 },
    ];
    character.realSkills = [
      { skill: "Summon Grizzly", level: 20, baseLevel: 20 },
      { skill: "Raven", level: 20, baseLevel: 20 },
      { skill: "Summon Spirit Wolf", level: 20, baseLevel: 20 },
    ];

    const calculation = calculateDamage(character);
    const summonSkill = calculation.skillOptions.find(
      (option) => option.id === "Summon Grizzly"
    );
    const summonWeapon = calculation.weaponOptions.find(
      (option) => option.id === "primary:summon:summon-grizzly"
    );
    const grizzlyProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Summon Grizzly" && profile.playerAuraId === "none"
    );
    const summonComponent = grizzlyProfile?.damageComponents.find(
      (component) => component.source === "summon"
    );

    expect(summonSkill?.damageMode).toBe("summon");
    expect(summonWeapon).toMatchObject({
      handMode: "summon",
      slot: "summon",
      itemName: "Summon Grizzly",
    });
    expect(grizzlyProfile?.weaponId).toBe("primary:summon:summon-grizzly");
    expect(grizzlyProfile?.skillDamageMode).toBe("summon");
    expect(summonComponent).toMatchObject({
      label: "Summon payload: Physical",
      damageType: "physical",
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({
          table: "Skills.txt",
          row: "Summon Grizzly",
        }),
      ]),
    });
    expect(grizzlyProfile?.notes.join(" ")).toContain(
      "per-summon damage profile"
    );
  });

  it("uses MonStats attack damage and summon damagepercent for melee summons", () => {
    const raiseSkeletonLevel = 20;
    const skeletonMasteryLevel = 20;
    const character = createCharacter("Raise Skeleton", raiseSkeletonLevel);
    character.character.class = { id: 2, name: "Necromancer" };
    character.character.skills = [
      { id: 70, name: "Raise Skeleton", level: raiseSkeletonLevel },
      { id: 79, name: "Skeleton Mastery", level: skeletonMasteryLevel },
    ];
    character.realSkills = [
      {
        skill: "Raise Skeleton",
        level: raiseSkeletonLevel,
        baseLevel: raiseSkeletonLevel,
      },
      {
        skill: "Skeleton Mastery",
        level: skeletonMasteryLevel,
        baseLevel: skeletonMasteryLevel,
      },
    ];

    const calculation = calculateDamage(character);
    const damagePercent = getExpectedSkeletonDamagePercentFromGameFiles({
      skillName: "Raise Skeleton",
      skillLevel: raiseSkeletonLevel,
      skeletonMasteryLevel,
    });
    const expectedFlatPhysical = getExpectedSkeletonFlatPhysicalFromGameFiles({
      skillName: "Raise Skeleton",
      skillLevel: raiseSkeletonLevel,
      damagePercent,
      skeletonMasteryLevel,
    });
    const skeletonProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Raise Skeleton" && profile.playerAuraId === "none"
    );
    const monsterComponent = skeletonProfile?.damageComponents.find(
      (component) => component.source === "monster"
    );
    const flatPhysicalComponent = skeletonProfile?.damageComponents.find(
      (component) =>
        component.label === "Summon flat physical" &&
        component.source === "skill"
    );

    expect(skeletonProfile?.skillDamageMode).toBe("summon");
    expect(skeletonProfile?.damageScope.label).toBe("per summon hit");
    expect(flatPhysicalComponent).toMatchObject({
      damageType: "physical",
      baseDamage: expectedFlatPhysical.base,
      damage: expectedFlatPhysical.damage,
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({
          table: "Skills.txt",
          row: "Raise Skeleton",
          columns: ["passivestat2", "passivecalc2"],
        }),
      ]),
    });
    expect(monsterComponent).toMatchObject({
      label: "Summon A1 attack",
      baseDamage: { min: 1, max: 2 },
      damage: {
        min: Math.floor(1 * (1 + damagePercent / 100)),
        max: Math.floor(2 * (1 + damagePercent / 100)),
      },
      sourceRefs: expect.arrayContaining([
        expect.objectContaining({
          table: "MonStats.txt",
          row: "necroskeleton",
        }),
      ]),
    });
    expect(monsterComponent?.damage.min).toBeGreaterThan(
      monsterComponent?.baseDamage?.min ?? 0
    );
    expect(skeletonProfile?.breakdown.physicalBonusPercent.selectedSkill).toBe(
      damagePercent
    );
    expect(skeletonProfile?.damageTotals.combinedDamage.min).toBeGreaterThan(
      100
    );
  });

  it("applies Skeleton Mastery once to skeleton archer direct and flat physical damage", () => {
    const archerLevel = 20;
    const raiseSkeletonBaseLevel = 20;
    const skeletonMasteryLevel = 20;
    const character = createCharacter("Raise Skeleton Archer", archerLevel);
    character.character.class = { id: 2, name: "Necromancer" };
    character.character.skills = [
      { id: 89, name: "Raise Skeleton Archer", level: archerLevel },
      { id: 70, name: "Raise Skeleton", level: raiseSkeletonBaseLevel },
      { id: 79, name: "Skeleton Mastery", level: skeletonMasteryLevel },
    ];
    character.realSkills = [
      {
        skill: "Raise Skeleton Archer",
        level: archerLevel,
        baseLevel: archerLevel,
      },
      {
        skill: "Raise Skeleton",
        level: raiseSkeletonBaseLevel,
        baseLevel: raiseSkeletonBaseLevel,
      },
      {
        skill: "Skeleton Mastery",
        level: skeletonMasteryLevel,
        baseLevel: skeletonMasteryLevel,
      },
    ];

    const calculation = calculateDamage(character);
    const damagePercent = getExpectedSkeletonDamagePercentFromGameFiles({
      skillName: "Raise Skeleton Archer",
      skillLevel: archerLevel,
      raiseSkeletonBaseLevel,
      skeletonMasteryLevel,
    });
    const expectedDirectPhysical =
      getExpectedSkeletonArcherDirectPhysicalFromGameFiles({
        archerLevel,
        damagePercent,
      });
    const expectedFlatPhysical = getExpectedSkeletonFlatPhysicalFromGameFiles({
      skillName: "Raise Skeleton Archer",
      skillLevel: archerLevel,
      damagePercent,
      skeletonMasteryLevel,
    });
    const archerProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Raise Skeleton Archer" &&
        profile.playerAuraId === "none"
    );
    const directComponent = archerProfile?.damageComponents.find(
      (component) =>
        component.label === "Summon payload: Physical" &&
        component.source === "summon"
    );
    const flatPhysicalComponent = archerProfile?.damageComponents.find(
      (component) =>
        component.label === "Summon flat physical" &&
        component.source === "skill"
    );

    expect(directComponent).toMatchObject({
      damageType: "physical",
      damage: expectedDirectPhysical,
    });
    expect(flatPhysicalComponent).toMatchObject({
      damageType: "physical",
      baseDamage: expectedFlatPhysical.base,
      damage: expectedFlatPhysical.damage,
    });
    expect(archerProfile?.damageTotals.combinedDamage).toEqual({
      min: expectedDirectPhysical.min + expectedFlatPhysical.damage.min,
      max: expectedDirectPhysical.max + expectedFlatPhysical.damage.max,
    });
    expect(archerProfile?.breakdown.physicalBonusPercent.selectedSkill).toBe(
      damagePercent
    );
    expect(
      archerProfile?.breakdown.physicalBonusPercent.selectedSkillSynergy
    ).toBe(0);
    expectPhysicalBonusTotalToMatchBuckets(archerProfile);
  });

  it("includes summon-owned aura payloads without pulling class synergy rows", () => {
    const character = createCharacter("FireGolem", 20);
    character.character.class = { id: 2, name: "Necromancer" };
    character.character.skills = [
      { id: 94, name: "FireGolem", level: 20 },
      { id: 75, name: "Clay Golem", level: 20 },
      { id: 85, name: "BloodGolem", level: 20 },
      { id: 90, name: "IronGolem", level: 20 },
      { id: 79, name: "Golem Mastery", level: 20 },
      { id: 62, name: "Hydra", level: 20 },
      { id: 36, name: "Fire Bolt", level: 20 },
      { id: 383, name: "Lesser Hydra", level: 20 },
    ];
    character.realSkills = character.character.skills.map((skill) => ({
      skill: skill.name,
      level: skill.level,
      baseLevel: skill.level,
    }));

    const calculation = calculateDamage(character);
    const fireGolemProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "FireGolem" && profile.playerAuraId === "none"
    );
    const hydraProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Hydra" && profile.playerAuraId === "none"
    );

    expect(
      fireGolemProfile?.damageComponents.some((component) =>
        component.label.includes("Holy Fire Fire Golem")
      )
    ).toBe(true);
    expect(
      hydraProfile?.damageComponents.some((component) =>
        component.label.includes("Fire Bolt")
      )
    ).toBe(false);
    expect(
      hydraProfile?.damageComponents.some((component) =>
        component.label.includes("Lesser Hydra")
      )
    ).toBe(false);
  });

  it("does not count pure summon mastery passthrough rows as extra player mastery", () => {
    const character = createCharacter("Hydra", 20);
    character.character.class = { id: 1, name: "Sorceress" };
    character.character.skills = [
      { id: 36, name: "Fire Bolt", level: 20 },
      { id: 61, name: "Fire Mastery", level: 20 },
      { id: 62, name: "Hydra", level: 20 },
      { id: 383, name: "Lesser Hydra", level: 20 },
    ];
    character.realSkills = character.character.skills.map((skill) => ({
      skill: skill.name,
      level: skill.level,
      baseLevel: skill.level,
    }));

    const calculation = calculateDamage(character);
    const hydraProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Hydra" && profile.playerAuraId === "none"
    );
    const hydraFireComponent = hydraProfile?.damageComponents.find(
      (component) => component.label === "Summon payload: Fire"
    );
    const expectedFireDamage = getExpectedHydraFirePayloadFromSkillsTxt(
      20,
      20,
      20,
      20
    );

    expect(hydraFireComponent?.damage).toEqual(expectedFireDamage);
    expect(hydraProfile?.damageTotals.combinedDamage).toEqual(
      expectedFireDamage
    );
  });

  it("models skeletal mage elemental variants as separate summon options", () => {
    const mageLevel = 20;
    const skeletonMasteryLevel = 20;
    const character = createCharacter("Raise Skeletal Mage", mageLevel);
    character.character.class = { id: 2, name: "Necromancer" };
    character.character.skills = [
      { id: 80, name: "Raise Skeletal Mage", level: mageLevel },
      { id: 79, name: "Skeleton Mastery", level: skeletonMasteryLevel },
    ];
    character.realSkills = character.character.skills.map((skill) => ({
      skill: skill.name,
      level: skill.level,
      baseLevel: skill.level,
    }));

    const calculation = calculateDamage(character);
    const mageOptions = calculation.skillOptions.filter((option) =>
      option.name.startsWith("Raise Skeletal Mage")
    );
    const fireProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Raise Skeletal Mage::fire-mage" &&
        profile.playerAuraId === "none"
    );
    const coldProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Raise Skeletal Mage::cold-mage" &&
        profile.playerAuraId === "none"
    );
    const lightningProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Raise Skeletal Mage::lightning-mage" &&
        profile.playerAuraId === "none"
    );
    const poisonProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Raise Skeletal Mage::poison-mage" &&
        profile.playerAuraId === "none"
    );

    expect(mageOptions.map((option) => option.name).sort()).toEqual([
      "Raise Skeletal Mage (Cold Mage)",
      "Raise Skeletal Mage (Fire Mage)",
      "Raise Skeletal Mage (Lightning Mage)",
      "Raise Skeletal Mage (Poison Mage)",
    ]);
    expect(
      calculation.skillOptions.some(
        (option) => option.id === "Raise Skeletal Mage"
      )
    ).toBe(false);
    expect(fireProfile?.weaponId).toBe("primary:summon:raise-skeletal-mage");
    expect(fireProfile?.sourceSkillName).toBe("Raise Skeletal Mage");
    expect(fireProfile?.damageComponents).toHaveLength(1);
    expect(fireProfile?.damageComponents[0]).toMatchObject({
      label: "Fire Mage payload: Necromage3",
      damageType: "fire",
      damage: getExpectedSkeletalMagePayloadFromGameFiles(
        "necromage3",
        mageLevel,
        skeletonMasteryLevel
      ),
    });
    expect(
      fireProfile?.damageComponents.some((component) =>
        component.label.includes("Necromage2")
      )
    ).toBe(false);
    expect(coldProfile?.damageComponents[0]).toMatchObject({
      label: "Cold Mage payload: Necromage2",
      damageType: "cold",
      damage: getExpectedSkeletalMagePayloadFromGameFiles(
        "necromage2",
        mageLevel,
        skeletonMasteryLevel
      ),
    });
    expect(lightningProfile?.damageComponents[0]).toMatchObject({
      label: "Lightning Mage payload: Necromage4",
      damageType: "lightning",
      damage: getExpectedSkeletalMagePayloadFromGameFiles(
        "necromage4",
        mageLevel,
        skeletonMasteryLevel
      ),
    });
    expect(poisonProfile?.damageComponents[0]).toMatchObject({
      label: "Poison Mage payload: Necromage1",
      damageType: "poison",
      damage: getExpectedSkeletalMagePayloadFromGameFiles(
        "necromage1",
        mageLevel,
        skeletonMasteryLevel
      ),
    });
  });

  it("applies summon-owned poison mastery to Plague Poppy poison payloads", () => {
    const plaguePoppyLevel = 20;
    const rabiesBaseLevel = 20;
    const cycleOfLifeBaseLevel = 20;
    const vinesBaseLevel = 20;
    const character = createCharacter("Plague Poppy", plaguePoppyLevel);
    character.character.class = { id: 4, name: "Druid" };
    character.character.skills = [
      { id: 222, name: "Plague Poppy", level: plaguePoppyLevel },
      { id: 238, name: "Rabies", level: rabiesBaseLevel },
      { id: 231, name: "Cycle of Life", level: cycleOfLifeBaseLevel },
      { id: 241, name: "Vines", level: vinesBaseLevel },
    ];
    character.realSkills = character.character.skills.map((skill) => ({
      skill: skill.name,
      level: skill.level,
      baseLevel: skill.level,
    }));

    const calculation = calculateDamage(character);
    const plaguePoppyProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Plague Poppy" && profile.playerAuraId === "none"
    );
    const poisonComponent = plaguePoppyProfile?.damageComponents.find(
      (component) =>
        component.label === "Summon payload: Poison" &&
        component.damageType === "poison"
    );
    const expectedPoisonDamage =
      getExpectedPlaguePoppyPoisonPayloadFromGameFiles({
        plaguePoppyLevel,
        rabiesBaseLevel,
        cycleOfLifeBaseLevel,
        vinesBaseLevel,
      });

    expect(poisonComponent).toBeDefined();
    expect(poisonComponent?.damage).toEqual(expectedPoisonDamage);
  });

  it("uses primary monster attack columns when no summoned skill links a mode", () => {
    const character = createCharacter("Clay Golem", 20);
    character.character.class = { id: 2, name: "Necromancer" };
    character.character.skills = [
      { id: 75, name: "Clay Golem", level: 20 },
      { id: 79, name: "Golem Mastery", level: 20 },
    ];
    character.realSkills = character.character.skills.map((skill) => ({
      skill: skill.name,
      level: skill.level,
      baseLevel: skill.level,
    }));

    const calculation = calculateDamage(character);
    const clayProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Clay Golem" && profile.playerAuraId === "none"
    );
    const monsterComponent = clayProfile?.damageComponents.find(
      (component) => component.source === "monster"
    );

    expect(monsterComponent).toMatchObject({
      label: "Summon A1 attack",
      baseDamage: { min: 11, max: 15 },
    });
  });

  it("keeps elemental summon damage when realStats omits optional bonus fields", () => {
    const character = createCharacter("Raven", 20);
    character.character.class = { id: 5, name: "Druid" };
    character.realStats = {
      strength: 0,
      dexterity: 0,
    } as CharacterData["realStats"];

    const calculation = calculateDamage(character);
    const ravenProfile = calculation.profiles.find(
      (profile) =>
        profile.skillId === "Raven" && profile.playerAuraId === "none"
    );

    expect(ravenProfile?.damageComponents[0]).toMatchObject({
      label: "Summon payload: Cold",
      damageType: "cold",
    });
    expect(ravenProfile?.damageComponents[0]?.damage.max).toBeGreaterThan(0);
  });

  it("does not offer variable summons without stable file-backed damage payloads", () => {
    const character = createCharacter("Shadow Master", 20);
    character.character.class = { id: 6, name: "Assassin" };
    character.character.skills = [
      { id: 279, name: "Shadow Master", level: 20 },
      { id: 95, name: "Revive", level: 20 },
    ];
    character.realSkills = [
      { skill: "Shadow Master", level: 20, baseLevel: 20 },
      { skill: "Revive", level: 20, baseLevel: 20 },
    ];

    const calculation = calculateDamage(character);

    expect(
      calculation.skillOptions.some((option) => option.id === "Shadow Master")
    ).toBe(false);
    expect(
      calculation.skillOptions.some((option) => option.id === "Revive")
    ).toBe(false);
    expect(
      calculation.weaponOptions.some((option) => option.handMode === "summon")
    ).toBe(false);
  });
});

describeWithArmorData("armory payload kick enrichment", () => {
  beforeAll(async () => {
    ({ enrichArmoryPayload } = await import("./armory-payload"));
  });

  it("adds Armor.txt boot kick damage to equipped boots", () => {
    const payload = {
      items: [
        createBoot({
          base_code: "utb",
          base: {
            id: "utb",
            category: "armor",
            codes: { normal: "tbt", exceptional: "xtb", elite: "utb" },
            name: "Mirrored Boots",
            stackable: false,
            type: "Boots",
            type_code: "boot",
            size: { height: 2, width: 2 },
            requirements: { level: 60, strength: 163, dexterity: 0 },
          },
        } as Partial<IItem>),
      ],
    };

    enrichArmoryPayload(payload);

    expect(payload.items[0].base.damage?.kick).toEqual({
      minimum: 69,
      maximum: 147,
    });
    expect(payload.items[0].damage?.kick).toEqual({
      minimum: 69,
      maximum: 147,
    });
    expect(payload.items[0].base.stat_bonus).toEqual({ strength: 100 });
  });
});
