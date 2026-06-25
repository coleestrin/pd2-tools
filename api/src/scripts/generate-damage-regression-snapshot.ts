import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { enrichArmoryPayload } from "../utils/armory-payload";
import { calculateDamage } from "../utils/damage-calculator";
import {
  getBestNoManualAuraProfile,
  getBestProfileForSourceSkill,
  getDamageProfileScore,
  summarizeDamageRegressionProfile,
} from "../utils/damage-regression-snapshot";
import { CharacterData, CharacterResponse, IItem } from "../types";

interface SkillUsageResponse {
  name: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

interface CharacterListResponse {
  total: number;
  characters: CharacterResponse[];
  breakdown: Record<string, number>;
}

interface GameTable {
  columns: string[];
  rowsByKey: Map<string, string[]>;
}

interface SkillLevelSummary {
  name: string;
  baseLevel: number;
  effectiveLevel: number;
}

interface QualifiedSample {
  skillName: string;
  gameMode: string;
  season: number;
  characterName: string;
  accountName?: string;
  characterLevel: number;
  qualification: {
    targetSkill: SkillLevelSummary;
    synergySkills: SkillLevelSummary[];
    synergyBaseLevelTotal: number;
    maxedSynergyCount: number;
    targetProfileAverage: number;
    bestProfileAverage: number;
    targetToBestProfileRatio: number;
    reasons: string[];
  };
  expected: ReturnType<typeof summarizeDamageRegressionProfile>;
  character: CharacterResponse;
}

interface SkippedSkill {
  skillName: string;
  gameMode: string;
  season: number;
  totalCandidates: number;
  evaluatedCandidates: number;
  reasonCounts: Record<string, number>;
}

interface DamageRegressionSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    apiBaseUrl: string;
    season: number;
    gameModes: string[];
  };
  criteria: {
    targetSamplesPerSkill: number;
    minSamplesPerSkill: number;
    candidatePageSize: number;
    minCharacterLevel: number;
    minTargetBaseLevel: number;
    minTargetEffectiveLevel: number;
    minTargetToBestProfileRatio: number;
    minSynergyBaseLevelTotal: number;
    minMaxedSynergyCount: number;
    maxEvaluatedCandidatesPerSkill: number;
  };
  coverage: {
    skillsConsidered: number;
    skillsWithSamples: number;
    totalSamples: number;
  };
  samples: QualifiedSample[];
  skippedSkills: SkippedSkill[];
}

const API_BASE_URL =
  process.env.DAMAGE_REGRESSION_API_BASE_URL || "https://api.pd2.tools/api/v1";
const SEASON = Number(process.env.DAMAGE_REGRESSION_SEASON || "13");
const GAME_MODES = (process.env.DAMAGE_REGRESSION_GAME_MODES || "softcore")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const TARGET_SAMPLES_PER_SKILL = Number(
  process.env.DAMAGE_REGRESSION_TARGET_SAMPLES_PER_SKILL || "3"
);
const MIN_SAMPLES_PER_SKILL = Number(
  process.env.DAMAGE_REGRESSION_MIN_SAMPLES_PER_SKILL || "2"
);
const CANDIDATE_PAGE_SIZE = Number(
  process.env.DAMAGE_REGRESSION_CANDIDATE_PAGE_SIZE || "50"
);
const MAX_EVALUATED_CANDIDATES_PER_SKILL = Number(
  process.env.DAMAGE_REGRESSION_MAX_EVALUATED_CANDIDATES_PER_SKILL || "20"
);
const MIN_CHARACTER_LEVEL = Number(
  process.env.DAMAGE_REGRESSION_MIN_CHARACTER_LEVEL || "80"
);
const MIN_TARGET_BASE_LEVEL = Number(
  process.env.DAMAGE_REGRESSION_MIN_TARGET_BASE_LEVEL || "20"
);
const MIN_TARGET_EFFECTIVE_LEVEL = Number(
  process.env.DAMAGE_REGRESSION_MIN_TARGET_EFFECTIVE_LEVEL || "20"
);
const MIN_TARGET_TO_BEST_PROFILE_RATIO = Number(
  process.env.DAMAGE_REGRESSION_MIN_TARGET_TO_BEST_PROFILE_RATIO || "0.5"
);
const MIN_SYNERGY_BASE_LEVEL_TOTAL = Number(
  process.env.DAMAGE_REGRESSION_MIN_SYNERGY_BASE_LEVEL_TOTAL || "40"
);
const MIN_MAXED_SYNERGY_COUNT = Number(
  process.env.DAMAGE_REGRESSION_MIN_MAXED_SYNERGY_COUNT || "2"
);
const REQUEST_DELAY_MS = Number(
  process.env.DAMAGE_REGRESSION_REQUEST_DELAY_MS || "150"
);
const MAX_SKILLS = Number(process.env.DAMAGE_REGRESSION_MAX_SKILLS || "0");

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "src",
  "fixtures",
  "damage-regression-snapshot.json"
);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function parseGameTable(fileName: string, keyColumn: string): GameTable {
  const filePath = path.resolve(
    process.cwd(),
    "src",
    "game-data",
    "pd2",
    "season-13",
    fileName
  );
  const lines = fs.readFileSync(filePath, "utf8").trimEnd().split(/\r?\n/);
  const columns = lines[0].split("\t");
  const keyIndex = columns.indexOf(keyColumn);
  const rowsByKey = new Map<string, string[]>();

  lines.slice(1).forEach((line) => {
    const cells = line.split("\t");
    rowsByKey.set(cells[keyIndex], cells);
  });

  return { columns, rowsByKey };
}

function getGameRow(table: GameTable, key: string): string[] | undefined {
  const direct = table.rowsByKey.get(key);
  if (direct) {
    return direct;
  }

  const normalizedKey = normalizeName(key);
  return Array.from(table.rowsByKey.entries()).find(
    ([rowKey]) => normalizeName(rowKey) === normalizedKey
  )?.[1];
}

function getGameCell(
  table: GameTable,
  row: string[],
  columnName: string
): string {
  const index = table.columns.indexOf(columnName);
  return index >= 0 ? row[index] || "" : "";
}

function getGameNumber(
  table: GameTable,
  row: string[],
  columnName: string
): number {
  const value = Number(getGameCell(table, row, columnName));
  return Number.isFinite(value) ? value : 0;
}

function isLikelyModeledDamageSkill(
  skillsTable: GameTable,
  skillName: string
): boolean {
  const row = getGameRow(skillsTable, skillName);
  if (!row) {
    return false;
  }

  if (getGameNumber(skillsTable, row, "SrcDam") > 0) {
    return true;
  }

  if (
    (getGameCell(skillsTable, row, "MinDam") &&
      getGameCell(skillsTable, row, "MaxDam")) ||
    (getGameCell(skillsTable, row, "EMin") &&
      getGameCell(skillsTable, row, "EMax"))
  ) {
    return true;
  }

  if (
    getGameCell(skillsTable, row, "summon") ||
    getGameCell(skillsTable, row, "pettype")
  ) {
    return true;
  }

  return skillsTable.columns.some(
    (columnName, index) =>
      /^(?:srv|clt)missile/.test(columnName) && Boolean(row[index])
  );
}

function getReferencedSynergySkills(
  skillsTable: GameTable,
  skillName: string
): string[] {
  const row = getGameRow(skillsTable, skillName);
  if (!row) {
    return [];
  }

  const references = new Set<string>();
  const rowText = row.join("\t");
  const skillReferencePattern = /skill\('([^']+)'\.blvl\)/g;
  let match: RegExpExecArray | null;
  while ((match = skillReferencePattern.exec(rowText))) {
    if (normalizeName(match[1]) !== normalizeName(skillName)) {
      references.add(match[1]);
    }
  }

  return Array.from(references).sort();
}

function getSkillLevel(
  character: CharacterResponse,
  skillName: string
): SkillLevelSummary {
  const normalizedSkillName = normalizeName(skillName);
  const realSkill = (character.realSkills || [])
    .filter(
      (skill): skill is { skill: string; level: number; baseLevel?: number } =>
        typeof skill === "object" &&
        skill !== null &&
        "skill" in skill &&
        "level" in skill
    )
    .find((skill) => normalizeName(String(skill.skill)) === normalizedSkillName);
  const baseSkill = (character.character?.skills || []).find(
    (skill) => normalizeName(skill.name) === normalizedSkillName
  );
  const baseLevel = realSkill?.baseLevel ?? baseSkill?.level ?? 0;
  const effectiveLevel = realSkill?.level ?? baseSkill?.level ?? 0;

  return {
    name: skillName,
    baseLevel,
    effectiveLevel,
  };
}

function getItemProperties(item: IItem): (string | null)[] {
  if (Array.isArray(item.properties)) {
    return item.properties.filter((property) => property !== undefined);
  }

  if (Array.isArray(item.modifiers)) {
    return item.modifiers
      .map((modifier) => modifier.label)
      .filter((label): label is string => Boolean(label));
  }

  return [];
}

function compactItem(item: IItem): IItem {
  const base = item.base || {
    id: item.base_code || String(item.id),
    category: item.category || "",
    codes: {},
    name: item.name,
    type: "",
    type_code: "",
  };
  const compact: Partial<IItem> = {
    id: item.id,
    hash: item.hash || String(item.id),
    name: item.name,
    category: item.category || base.category,
    base_code: item.base_code || base.id,
    base: {
      id: base.id,
      category: base.category,
      codes: base.codes || {},
      name: base.name,
      type: base.type,
      type_code: base.type_code,
      damage: base.damage,
      stat_bonus: base.stat_bonus,
    } as IItem["base"],
    location: {
      zone: item.location?.zone || "",
      storage: item.location?.storage || "",
      equipment: item.location?.equipment,
    } as IItem["location"],
    properties: getItemProperties(item),
    damage: item.damage,
  };

  return compact as IItem;
}

function compactCharacter(character: CharacterResponse): CharacterResponse {
  return {
    accountName: character.accountName,
    lastUpdated: character.lastUpdated,
    nullReason: character.nullReason,
    character: character.character
      ? {
          name: character.character.name,
          status: character.character.status,
          class: character.character.class,
          attributes: character.character.attributes,
          level: character.character.level,
          skills: character.character.skills,
          season: character.character.season,
        } as CharacterResponse["character"]
      : null,
    items: Array.isArray(character.items)
      ? character.items.map(compactItem)
      : null,
    mercenary: character.mercenary
      ? {
          id: character.mercenary.id,
          name_id: character.mercenary.name_id,
          type: character.mercenary.type,
          experience: character.mercenary.experience,
          name: character.mercenary.name,
          description: character.mercenary.description,
          items: Array.isArray(character.mercenary.items)
            ? character.mercenary.items.map(compactItem)
            : [],
        }
      : character.mercenary,
    realSkills: character.realSkills?.map((skill) => ({
      skill: skill.skill,
      level: skill.level,
      baseLevel: skill.baseLevel,
    })),
    realStats: character.realStats
      ? {
          ...character.realStats,
        }
      : undefined,
  };
}

async function fetchJson<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  await delay(REQUEST_DELAY_MS);
  return (await response.json()) as T;
}

async function getSkillUsage(gameMode: string): Promise<SkillUsageResponse[]> {
  return fetchJson<SkillUsageResponse[]>("/characters/stats/skill-usage", {
    gameMode,
    season: SEASON,
    minLevel: MIN_CHARACTER_LEVEL,
  });
}

async function getCandidateCharacters(
  skillName: string,
  gameMode: string
): Promise<CharacterListResponse> {
  return fetchJson<CharacterListResponse>("/characters", {
    gameMode,
    season: SEASON,
    minLevel: MIN_CHARACTER_LEVEL,
    page: 1,
    pageSize: CANDIDATE_PAGE_SIZE,
    skills: JSON.stringify([
      { name: skillName, minLevel: MIN_TARGET_BASE_LEVEL },
    ]),
  });
}

function addSkip(reasonCounts: Record<string, number>, reason: string): void {
  reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
}

function qualifyCharacter(
  character: CharacterResponse,
  skillName: string,
  gameMode: string,
  skillsTable: GameTable
): { sample?: QualifiedSample; reason?: string } {
  const compactedCharacter = compactCharacter(character);
  if (!compactedCharacter.character || !Array.isArray(compactedCharacter.items)) {
    return { reason: "missing-character-or-items" };
  }

  const characterData = compactedCharacter as CharacterData;
  enrichArmoryPayload(characterData);
  const calculation = calculateDamage(characterData);
  const target = getBestProfileForSourceSkill(calculation, skillName);
  if (!target) {
    return { reason: "not-modeled-damage-skill" };
  }

  const bestProfile = getBestNoManualAuraProfile(calculation);
  if (!bestProfile) {
    return { reason: "missing-best-profile" };
  }

  const targetSkill = getSkillLevel(compactedCharacter, skillName);
  if (targetSkill.baseLevel < MIN_TARGET_BASE_LEVEL) {
    return { reason: "target-base-level-too-low" };
  }
  if (targetSkill.effectiveLevel < MIN_TARGET_EFFECTIVE_LEVEL) {
    return { reason: "target-effective-level-too-low" };
  }

  const synergySkills = getReferencedSynergySkills(skillsTable, skillName).map(
    (synergyName) => getSkillLevel(compactedCharacter, synergyName)
  );
  const synergyBaseLevelTotal = synergySkills.reduce(
    (total, skill) => total + skill.baseLevel,
    0
  );
  const maxedSynergyCount = synergySkills.filter(
    (skill) => skill.baseLevel >= MIN_TARGET_BASE_LEVEL
  ).length;
  const requiredSynergyBaseLevelTotal =
    synergySkills.length > 0
      ? Math.min(
          MIN_SYNERGY_BASE_LEVEL_TOTAL,
          synergySkills.length * MIN_TARGET_BASE_LEVEL
        )
      : 0;
  const requiredMaxedSynergyCount =
    synergySkills.length > 0
      ? Math.min(MIN_MAXED_SYNERGY_COUNT, synergySkills.length)
      : 0;

  if (synergyBaseLevelTotal < requiredSynergyBaseLevelTotal) {
    return { reason: "synergy-base-total-too-low" };
  }
  if (maxedSynergyCount < requiredMaxedSynergyCount) {
    return { reason: "not-enough-maxed-synergies" };
  }

  const targetProfileAverage = getDamageProfileScore(target.profile);
  const bestProfileAverage = getDamageProfileScore(bestProfile);
  const targetToBestProfileRatio =
    bestProfileAverage > 0 ? targetProfileAverage / bestProfileAverage : 0;
  if (targetToBestProfileRatio < MIN_TARGET_TO_BEST_PROFILE_RATIO) {
    return { reason: "target-profile-not-main-damage" };
  }

  return {
    sample: {
      skillName,
      gameMode,
      season: SEASON,
      characterName: compactedCharacter.character.name,
      accountName: compactedCharacter.accountName,
      characterLevel: compactedCharacter.character.level,
      qualification: {
        targetSkill,
        synergySkills,
        synergyBaseLevelTotal,
        maxedSynergyCount,
        targetProfileAverage,
        bestProfileAverage,
        targetToBestProfileRatio: Number(
          targetToBestProfileRatio.toFixed(4)
        ),
        reasons: [
          `target base level ${targetSkill.baseLevel}`,
          `target effective level ${targetSkill.effectiveLevel}`,
          `synergy base total ${synergyBaseLevelTotal}`,
          `target profile ratio ${targetToBestProfileRatio.toFixed(4)}`,
        ],
      },
      expected: summarizeDamageRegressionProfile(
        target.skillOption,
        target.profile
      ),
      character: compactedCharacter,
    },
  };
}

async function main(): Promise<void> {
  const skillsTable = parseGameTable("Skills.txt", "skill");
  const samples: QualifiedSample[] = [];
  const skippedSkills: SkippedSkill[] = [];
  let skillsConsidered = 0;

  for (const gameMode of GAME_MODES) {
    const usage = await getSkillUsage(gameMode);
    const skillNames = usage
      .filter((skill) => skill.numOccurrences >= MIN_SAMPLES_PER_SKILL)
      .filter((skill) => isLikelyModeledDamageSkill(skillsTable, skill.name))
      .map((skill) => skill.name)
      .slice(0, MAX_SKILLS > 0 ? MAX_SKILLS : undefined);

    for (const skillName of skillNames) {
      skillsConsidered += 1;
      const candidates = await getCandidateCharacters(skillName, gameMode);
      const reasonCounts: Record<string, number> = {};
      const qualified: QualifiedSample[] = [];
      let evaluatedCandidates = 0;

      for (const character of candidates.characters) {
        if (
          qualified.length >= TARGET_SAMPLES_PER_SKILL ||
          evaluatedCandidates >= MAX_EVALUATED_CANDIDATES_PER_SKILL
        ) {
          break;
        }

        evaluatedCandidates += 1;
        try {
          const result = qualifyCharacter(
            character,
            skillName,
            gameMode,
            skillsTable
          );
          if (result.sample) {
            qualified.push(result.sample);
          } else if (result.reason) {
            addSkip(reasonCounts, result.reason);
          }
        } catch (error) {
          addSkip(
            reasonCounts,
            error instanceof Error ? error.message : String(error)
          );
        }

        if (
          evaluatedCandidates >= 3 &&
          reasonCounts["not-modeled-damage-skill"] === evaluatedCandidates
        ) {
          break;
        }
      }

      qualified.sort((left, right) => {
        const leftScore = [
          left.qualification.targetSkill.baseLevel,
          left.qualification.synergyBaseLevelTotal,
          left.qualification.targetToBestProfileRatio,
          left.qualification.targetProfileAverage,
          left.characterLevel,
        ];
        const rightScore = [
          right.qualification.targetSkill.baseLevel,
          right.qualification.synergyBaseLevelTotal,
          right.qualification.targetToBestProfileRatio,
          right.qualification.targetProfileAverage,
          right.characterLevel,
        ];

        for (let index = 0; index < leftScore.length; index += 1) {
          if (leftScore[index] !== rightScore[index]) {
            return rightScore[index] - leftScore[index];
          }
        }

        return left.characterName.localeCompare(right.characterName);
      });

      if (qualified.length >= MIN_SAMPLES_PER_SKILL) {
        samples.push(...qualified.slice(0, TARGET_SAMPLES_PER_SKILL));
      } else {
        skippedSkills.push({
          skillName,
          gameMode,
          season: SEASON,
          totalCandidates: candidates.total,
          evaluatedCandidates,
          reasonCounts,
        });
      }

      console.log(
        `${gameMode} ${skillName}: ${qualified.length} qualified from ${evaluatedCandidates}/${candidates.total} candidates`
      );
    }
  }

  const snapshot: DamageRegressionSnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      apiBaseUrl: API_BASE_URL,
      season: SEASON,
      gameModes: GAME_MODES,
    },
    criteria: {
      targetSamplesPerSkill: TARGET_SAMPLES_PER_SKILL,
      minSamplesPerSkill: MIN_SAMPLES_PER_SKILL,
      candidatePageSize: CANDIDATE_PAGE_SIZE,
      minCharacterLevel: MIN_CHARACTER_LEVEL,
      minTargetBaseLevel: MIN_TARGET_BASE_LEVEL,
      minTargetEffectiveLevel: MIN_TARGET_EFFECTIVE_LEVEL,
      minTargetToBestProfileRatio: MIN_TARGET_TO_BEST_PROFILE_RATIO,
      minSynergyBaseLevelTotal: MIN_SYNERGY_BASE_LEVEL_TOTAL,
      minMaxedSynergyCount: MIN_MAXED_SYNERGY_COUNT,
      maxEvaluatedCandidatesPerSkill: MAX_EVALUATED_CANDIDATES_PER_SKILL,
    },
    coverage: {
      skillsConsidered,
      skillsWithSamples: new Set(
        samples.map((sample) => `${sample.gameMode}:${sample.skillName}`)
      ).size,
      totalSamples: samples.length,
    },
    samples,
    skippedSkills,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);

  console.log(
    `Wrote ${samples.length} damage regression samples for ${snapshot.coverage.skillsWithSamples}/${skillsConsidered} skill-mode pairs to ${OUTPUT_PATH}`
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
