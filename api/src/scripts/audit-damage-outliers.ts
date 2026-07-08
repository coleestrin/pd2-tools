import fs from "fs";
import path from "path";

type Severity = "error" | "warn" | "info";

interface GameTable {
  columns: string[];
  rowsByKey: Map<string, string[]>;
}

interface SnapshotComponent {
  label: string;
  source: string;
  damageType: string;
  timing: string;
  damage: {
    min: number;
    max: number;
  };
}

interface SnapshotProfile {
  key: string;
  weaponId: string;
  skillId: string;
  skillName: string;
  sourceSkillName?: string;
  skillLevel: number;
  skillDamageMode: string;
  damageScope: {
    label: string;
    count?: number;
    countLabel?: string;
  };
  damageTotals: {
    combinedDamage: {
      min: number;
      max: number;
    };
    averageCombinedDamage: number;
  };
  damageComponents: SnapshotComponent[];
}

interface SnapshotSample {
  skillName: string;
  gameMode: string;
  season: number;
  characterName: string;
  qualification: {
    targetToBestProfileRatio: number;
  };
  expected: {
    skillOption: {
      id: string;
      name: string;
      damageMode: string;
      sourceSkillName?: string;
      summonVariant?: string;
    };
    profile: SnapshotProfile;
  };
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
  coverage: {
    skillsConsidered: number;
    skillsWithSamples: number;
    totalSamples: number;
  };
  samples: SnapshotSample[];
  skippedSkills: SkippedSkill[];
}

interface Finding {
  code: string;
  severity: Severity;
  skillName?: string;
  profileKey?: string;
  characterName?: string;
  message: string;
  evidence: Record<string, unknown>;
}

const apiRoot = process.cwd();
const repoRoot = path.resolve(apiRoot, "..");
const gameDataPath = path.resolve(
  apiRoot,
  "src",
  "game-data",
  "pd2",
  "season-13"
);
const snapshotPath = path.resolve(
  apiRoot,
  "src",
  "fixtures",
  "damage-regression-snapshot.json"
);
const reportPath = path.resolve(
  repoRoot,
  ".codex-local",
  "damage-outlier-audit.json"
);

function loadGameTable(fileName: string, keyColumn: string): GameTable {
  const filePath = path.join(gameDataPath, fileName);
  const lines = fs.readFileSync(filePath, "utf8").trimEnd().split(/\r?\n/);
  const columns = lines[0].split("\t");
  const keyIndex = columns.indexOf(keyColumn);
  if (keyIndex < 0) {
    throw new Error(`${fileName} is missing key column ${keyColumn}`);
  }

  const rowsByKey = new Map<string, string[]>();
  lines.slice(1).forEach((line) => {
    const row = line.split("\t");
    const key = row[keyIndex];
    if (key && !rowsByKey.has(key)) {
      rowsByKey.set(key, row);
    }
  });

  return { columns, rowsByKey };
}

function getCell(table: GameTable, row: string[] | undefined, column: string) {
  if (!row) {
    return "";
  }

  const index = table.columns.indexOf(column);
  return index >= 0 ? row[index] || "" : "";
}

function loadSnapshot(): DamageRegressionSnapshot {
  return JSON.parse(
    fs.readFileSync(snapshotPath, "utf8")
  ) as DamageRegressionSnapshot;
}

function addFinding(findings: Finding[], finding: Finding) {
  findings.push(finding);
}

function averageDamage(range: { min: number; max: number }) {
  return (range.min + range.max) / 2;
}

function getProfileHandMode(profile: SnapshotProfile): string {
  const parts = profile.weaponId.split(":");
  if (parts[1]?.startsWith("dual_")) {
    return parts[1];
  }

  return parts[2] || "";
}

function getHighConfidenceAllowedHandModes(itype: string): string[] | undefined {
  switch (itype) {
    case "mele":
      return ["one_handed", "two_handed", "dual_wield", "unarmed"];
    case "miss":
      return ["missile"];
    case "jave":
    case "tkni":
    case "taxe":
    case "comb":
      return ["missile", "dual_throw"];
    case "spea":
    case "pole":
    case "staf":
    case "knif":
      return ["one_handed", "two_handed", "dual_wield"];
    case "h2h":
    case "h2h2":
      return ["one_handed", "dual_wield"];
    case "shld":
      return ["shield"];
    default:
      return undefined;
  }
}

function isDamageLikeSkill(skills: GameTable, row: string[]) {
  return Boolean(
    getCell(skills, row, "SrcDam") ||
      getCell(skills, row, "MinDam") ||
      getCell(skills, row, "MaxDam") ||
      getCell(skills, row, "EMin") ||
      getCell(skills, row, "EMax") ||
      getCell(skills, row, "summon") ||
      getCell(skills, row, "pettype") ||
      skills.columns.some(
        (column, index) => /^(?:srv|clt)missile/.test(column) && row[index]
      )
  );
}

function auditSnapshotProfiles(
  snapshot: DamageRegressionSnapshot,
  skills: GameTable,
  findings: Finding[]
) {
  snapshot.samples.forEach((sample) => {
    const profile = sample.expected.profile;
    const skillRow =
      skills.rowsByKey.get(profile.sourceSkillName || profile.skillName) ||
      skills.rowsByKey.get(sample.skillName);
    const componentAverageTotal = profile.damageComponents.reduce(
      (total, component) => total + averageDamage(component.damage),
      0
    );
    const totalAverage = profile.damageTotals.averageCombinedDamage;
    if (
      !Number.isFinite(totalAverage) ||
      totalAverage < 0 ||
      profile.damageTotals.combinedDamage.max <
        profile.damageTotals.combinedDamage.min
    ) {
      addFinding(findings, {
        code: "TOTAL-INVARIANT",
        severity: "error",
        skillName: sample.skillName,
        profileKey: profile.key,
        characterName: sample.characterName,
        message: "Damage total is non-finite, negative, or has max < min.",
        evidence: { damageTotals: profile.damageTotals },
      });
    }

    if (Math.abs(componentAverageTotal - totalAverage) > 0.01) {
      addFinding(findings, {
        code: "TOTAL-COMPONENT-MISMATCH",
        severity: "error",
        skillName: sample.skillName,
        profileKey: profile.key,
        characterName: sample.characterName,
        message: "Profile average does not match summed component averages.",
        evidence: {
          componentAverageTotal,
          totalAverage,
          components: profile.damageComponents.map((component) => ({
            label: component.label,
            source: component.source,
            damageType: component.damageType,
            timing: component.timing,
            damage: component.damage,
          })),
        },
      });
    }

    if (
      sample.expected.skillOption.damageMode === "weapon" &&
      skillRow &&
      getCell(skills, skillRow, "itypea1")
    ) {
      const itype = getCell(skills, skillRow, "itypea1");
      const allowedHandModes = getHighConfidenceAllowedHandModes(itype);
      const handMode = getProfileHandMode(profile);
      if (
        allowedHandModes &&
        handMode &&
        !allowedHandModes.includes(handMode)
      ) {
        addFinding(findings, {
          code: "WPN-COMPAT",
          severity: "error",
          skillName: sample.skillName,
          profileKey: profile.key,
          characterName: sample.characterName,
          message: "Weapon profile hand mode conflicts with Skills.txt itypea1.",
          evidence: {
            itypea1: itype,
            allowedHandModes,
            profileHandMode: handMode,
            weaponId: profile.weaponId,
          },
        });
      }
    }

    if (
      sample.expected.skillOption.damageMode === "weapon" &&
      skillRow &&
      !getCell(skills, skillRow, "SrcDam") &&
      profile.damageComponents.some((component) => component.source === "weapon")
    ) {
      addFinding(findings, {
        code: "SRC-DAM-FALLBACK",
        severity: "warn",
        skillName: sample.skillName,
        profileKey: profile.key,
        characterName: sample.characterName,
        message: "Weapon component exists for a skill row with blank SrcDam.",
        evidence: {
          weaponId: profile.weaponId,
          components: profile.damageComponents
            .filter((component) => component.source === "weapon")
            .map((component) => ({
              label: component.label,
              damage: component.damage,
            })),
        },
      });
    }

    if (
      profile.damageScope.label === "per target hit" &&
      profile.damageComponents.length > 1 &&
      profile.damageComponents.some((component) => component.source === "missile")
    ) {
      addFinding(findings, {
        code: "SCOPE-MULTI-PAYLOAD",
        severity: "warn",
        skillName: sample.skillName,
        profileKey: profile.key,
        characterName: sample.characterName,
        message:
          "Generic per-target scope is used for a multi-component missile profile.",
        evidence: {
          scope: profile.damageScope,
          components: profile.damageComponents.map((component) => ({
            label: component.label,
            source: component.source,
            damageType: component.damageType,
          })),
        },
      });
    }
  });
}

function auditCoverage(
  snapshot: DamageRegressionSnapshot,
  findings: Finding[]
) {
  snapshot.skippedSkills.forEach((skipped) => {
    const skippedCount = Object.values(skipped.reasonCounts).reduce(
      (total, count) => total + count,
      0
    );
    if (skipped.totalCandidates >= 500 && skippedCount > 0) {
      addFinding(findings, {
        code: "SNAPSHOT-COVERAGE",
        severity: "info",
        skillName: skipped.skillName,
        message: "Popular skill was considered but did not enter the fixture.",
        evidence: {
          skillName: skipped.skillName,
          gameMode: skipped.gameMode,
          season: skipped.season,
          totalCandidates: skipped.totalCandidates,
          evaluatedCandidates: skipped.evaluatedCandidates,
          reasonCounts: skipped.reasonCounts,
        },
      });
    }
  });

  const variantsBySource = new Map<string, Set<string>>();
  snapshot.samples.forEach((sample) => {
    const sourceName =
      sample.expected.skillOption.sourceSkillName || sample.skillName;
    const variant =
      sample.expected.skillOption.summonVariant ||
      sample.expected.skillOption.id;
    if (!variantsBySource.has(sourceName)) {
      variantsBySource.set(sourceName, new Set<string>());
    }

    variantsBySource.get(sourceName)!.add(variant);
  });

  const mageVariants = variantsBySource.get("Raise Skeletal Mage");
  if (mageVariants && mageVariants.size < 4) {
    addFinding(findings, {
      code: "SNAPSHOT-VARIANT-COVERAGE",
      severity: "warn",
      skillName: "Raise Skeletal Mage",
      message: "Raise Skeletal Mage fixture samples do not cover every variant.",
      evidence: {
        sampledVariants: Array.from(mageVariants).sort(),
        expectedVariantCount: 4,
      },
    });
  }
}

function findUnsupportedFormulaTokens(expression: string): string[] {
  const tokens = new Set<string>();

  if (/\bulvl\b/.test(expression)) {
    tokens.add("ulvl");
  }

  if (/\bedln\b/.test(expression)) {
    tokens.add("edln");
  }

  return Array.from(tokens).sort();
}

function getFormulaStatContext(
  skills: GameTable,
  row: string[],
  column: string
): string | undefined {
  const auraMatch = column.match(/^aurastatcalc(\d+)$/);
  if (auraMatch) {
    return getCell(skills, row, `aurastat${auraMatch[1]}`) || undefined;
  }

  const passiveMatch = column.match(/^passivecalc(\d+)$/);
  if (passiveMatch) {
    return getCell(skills, row, `passivestat${passiveMatch[1]}`) || undefined;
  }

  return undefined;
}

function getFormulaFindingSeverity(tokens: string[]): Severity {
  if (tokens.includes("ulvl")) {
    return "warn";
  }

  return "info";
}

function auditFormulaCoverage(skills: GameTable, findings: Finding[]) {
  const formulaColumns = skills.columns.filter((column) =>
    /(?:calc|Calc|Sym|aurarangecalc|auralencalc)/.test(column)
  );

  skills.rowsByKey.forEach((row, skillName) => {
    if (
      getCell(skills, row, "InGame") !== "1" ||
      !getCell(skills, row, "charclass") ||
      !isDamageLikeSkill(skills, row)
    ) {
      return;
    }

    formulaColumns.forEach((column) => {
      const expression = getCell(skills, row, column);
      if (!expression) {
        return;
      }

      const tokens = findUnsupportedFormulaTokens(expression);
      if (tokens.length === 0) {
        return;
      }

      const stat = getFormulaStatContext(skills, row, column);
      addFinding(findings, {
        code: "FORMULA-UNSUPPORTED-TOKEN",
        severity: getFormulaFindingSeverity(tokens),
        skillName,
        message: "Damage-like skill formula contains tokens needing evaluator support or explicit exclusion.",
        evidence: {
          column,
          stat,
          expression,
          tokens,
        },
      });
    });
  });
}

function auditPropertyCoverage(properties: GameTable, findings: Finding[]) {
  const damageStatPattern =
    /(mindam|maxdam|fire|cold|light|ltng|magic|poison|pois|damage|skill)/i;
  const supportedExpansionFuncs = new Set(["1", "3", "15", "16", "17"]);

  properties.rowsByKey.forEach((row, code) => {
    const slots: Array<{ index: number; func: string; stat: string }> = [];
    for (let index = 1; index <= 7; index += 1) {
      const stat = getCell(properties, row, `stat${index}`);
      const func = getCell(properties, row, `func${index}`);
      if (stat && damageStatPattern.test(`${code}:${stat}`)) {
        slots.push({ index, func, stat });
      }
    }

    const unsupportedSlots = slots.filter(
      (slot) => slot.func && !supportedExpansionFuncs.has(slot.func)
    );
    if (unsupportedSlots.length > 0) {
      addFinding(findings, {
        code: "ITEM-PROPERTY-FUNC",
        severity: "info",
        message: "Damage-related property uses expansion funcs outside the current simple stat expansion path.",
        evidence: {
          code,
          unsupportedSlots,
        },
      });
    }
  });
}

function auditMissileGraph(
  skills: GameTable,
  missiles: GameTable,
  findings: Finding[]
) {
  const skillMissileColumns = [
    "srvmissile",
    "srvmissilea",
    "srvmissileb",
    "srvmissilec",
    "cltmissile",
    "cltmissilea",
    "cltmissileb",
    "cltmissilec",
    "cltmissiled",
  ];
  const clientChildColumns = [
    "CltSubMissile1",
    "CltSubMissile2",
    "CltSubMissile3",
    "CltHitSubMissile1",
    "CltHitSubMissile2",
    "CltHitSubMissile3",
    "CltHitSubMissile4",
  ];

  skills.rowsByKey.forEach((row, skillName) => {
    if (
      getCell(skills, row, "InGame") !== "1" ||
      !getCell(skills, row, "charclass")
    ) {
      return;
    }

    const directMissiles = skillMissileColumns
      .map((column) => ({
        column,
        missile: getCell(skills, row, column),
      }))
      .filter((entry) => entry.missile);
    directMissiles.forEach((entry) => {
      const missileRow = missiles.rowsByKey.get(entry.missile);
      if (!missileRow) {
        return;
      }

      clientChildColumns.forEach((childColumn) => {
        const childMissile = getCell(missiles, missileRow, childColumn);
        const childRow = missiles.rowsByKey.get(childMissile);
        if (
          childRow &&
          (getCell(missiles, childRow, "MinDamage") ||
            getCell(missiles, childRow, "MaxDamage") ||
            getCell(missiles, childRow, "EMin") ||
            getCell(missiles, childRow, "Emax"))
        ) {
          addFinding(findings, {
            code: "MISSILE-CLIENT-CHILD-RISK",
            severity: "info",
            skillName,
            message: "Game table contains a damage-bearing client child missile; damage traversal should keep excluding this path.",
            evidence: {
              rootColumn: entry.column,
              rootMissile: entry.missile,
              childColumn,
              childMissile,
            },
          });
        }
      });
    });
  });
}

function summarize(findings: Finding[]) {
  const byCode: Record<string, number> = {};
  const bySeverity: Record<Severity, number> = {
    error: 0,
    warn: 0,
    info: 0,
  };

  findings.forEach((finding) => {
    byCode[finding.code] = (byCode[finding.code] || 0) + 1;
    bySeverity[finding.severity] += 1;
  });

  return { bySeverity, byCode };
}

function main() {
  const snapshot = loadSnapshot();
  const skills = loadGameTable("Skills.txt", "skill");
  const missiles = loadGameTable("Missiles.txt", "Missile");
  const properties = loadGameTable("Properties.txt", "code");
  const findings: Finding[] = [];

  auditSnapshotProfiles(snapshot, skills, findings);
  auditCoverage(snapshot, findings);
  auditFormulaCoverage(skills, findings);
  auditPropertyCoverage(properties, findings);
  auditMissileGraph(skills, missiles, findings);

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      snapshotPath,
      gameDataPath,
      snapshotCoverage: snapshot.coverage,
    },
    summary: summarize(findings),
    findings,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Wrote ${findings.length} findings to ${reportPath}`);
}

void main();
