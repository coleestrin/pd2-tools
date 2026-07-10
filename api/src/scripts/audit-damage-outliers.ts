import fs from "fs";
import path from "path";
import { getModeledDamageMechanicCoverage } from "../utils/damage-calculator";

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
  includedInTotal?: boolean;
  sourceRefs: Array<{ table: string; row?: string; columns: string[] }>;
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
    note: string;
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

const MODELED_BLANK_SRC_DAMAGE_SOURCE_SKILLS = new Map<
  string,
  { sourceModel: string; evidenceColumns: string[] }
>([
  [
    "charged strike",
    {
      sourceModel:
        "Spear/javelin left-skill attack with server lightning bolts; weapon source is modeled from attack-signal fields even though SrcDam is blank.",
      evidenceColumns: [
        "leftskill",
        "itypea1",
        "srvstfunc",
        "srvdofunc",
        "srvmissilea",
      ],
    },
  ],
  [
    "dragon tail",
    {
      sourceModel:
        "Kick=1 marks this as a boot-sourced kick attack; boot source damage is modeled from the kick flag instead of SrcDam.",
      evidenceColumns: ["Kick", "leftskill", "srvstfunc", "srvdofunc"],
    },
  ],
  [
    "fire claws",
    {
      sourceModel:
        "Shape-shift left-skill attack with attack description and server fire payload; weapon source is modeled from attack-signal fields even though SrcDam is blank.",
      evidenceColumns: [
        "leftskill",
        "descatt",
        "srvstfunc",
        "srvdofunc",
        "srvmissilea",
      ],
    },
  ],
  [
    "lightning strike",
    {
      sourceModel:
        "Spear/javelin left-skill attack with server chain-lightning missiles; weapon source is modeled from attack-signal fields even though SrcDam is blank.",
      evidenceColumns: [
        "leftskill",
        "itypea1",
        "srvstfunc",
        "srvdofunc",
        "srvmissilea",
      ],
    },
  ],
]);

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

function getModeledBlankSrcDamageSource(
  skillName: string
): { sourceModel: string; evidenceColumns: string[] } | undefined {
  return MODELED_BLANK_SRC_DAMAGE_SOURCE_SKILLS.get(skillName.toLowerCase());
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
      (total, component) =>
        component.includedInTotal === false
          ? total
          : total + averageDamage(component.damage),
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

    const nonPoisonAttackDotComponents = profile.damageComponents.filter(
      (component) =>
        sample.expected.skillOption.damageMode === "weapon" &&
        component.source === "skill" &&
        component.damageType !== "poison" &&
        component.timing === "over_time"
    );
    if (nonPoisonAttackDotComponents.length > 0) {
      addFinding(findings, {
        code: "TIMING-ATTACK-PAYLOAD",
        severity: "error",
        skillName: sample.skillName,
        profileKey: profile.key,
        characterName: sample.characterName,
        message: "A direct non-poison attack payload is classified as damage over time.",
        evidence: {
          components: nonPoisonAttackDotComponents,
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
      getCell(skills, skillRow, "range") === "h2h" &&
      getProfileHandMode(profile) === "missile"
    ) {
      addFinding(findings, {
        code: "WPN-RANGE",
        severity: "error",
        skillName: sample.skillName,
        profileKey: profile.key,
        characterName: sample.characterName,
        message: "A melee-range skill is using a missile weapon profile.",
        evidence: {
          range: getCell(skills, skillRow, "range"),
          profileHandMode: getProfileHandMode(profile),
          weaponId: profile.weaponId,
        },
      });
    }

    if (
      sample.expected.skillOption.damageMode === "weapon" &&
      skillRow &&
      !getCell(skills, skillRow, "SrcDam") &&
      profile.damageComponents.some((component) => component.source === "weapon")
    ) {
      const modeledSource = getModeledBlankSrcDamageSource(
        profile.sourceSkillName || profile.skillName
      );
      if (!modeledSource) {
        addFinding(findings, {
          code: "SRC-DAM-FALLBACK",
          severity: "warn",
          skillName: sample.skillName,
          profileKey: profile.key,
          characterName: sample.characterName,
          message: "Weapon component exists for a skill row with blank SrcDam and no explicit source model.",
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
    }

    if (
      new Set([
        "per target hit",
        "per projectile hit",
        "per projectile",
        "per throw hit",
        "per modeled hit",
        "per weapon hit",
      ]).has(profile.damageScope.label) &&
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

function auditModeledMechanicCoverage(findings: Finding[]) {
  getModeledDamageMechanicCoverage().forEach((mechanic) => {
    const countCalcs = mechanic.countCalcs.filter((calc) =>
      /(?:#|number|maximum|max\.?)\s+(?:of\s+)?(?:missiles?|bolts?|hits?|targets?|kicks?|bounces?|summons?|projectiles?|charges?)/i.test(
        calc.description
      )
    );
    const scopeExplainsCount =
      mechanic.damageScope.count !== undefined ||
      /(?:not multiplied|excluded|one modeled|per (?:missile|bolt|hit|kick|projectile|throw|impact|pulse))/i.test(
        mechanic.damageScope.note
      );
    if (countCalcs.length > 0 && !scopeExplainsCount) {
      addFinding(findings, {
        code: "SCOPE-COUNT-CALC",
        severity: "warn",
        skillName: mechanic.skillName,
        message: "A modeled count-bearing skill formula is not explained by its damage scope.",
        evidence: { countCalcs, scope: mechanic.damageScope },
      });
    }

    if (
      mechanic.periodic &&
      !/(?:period|pulse|repeat|duration|frequency|per second|stream)/i.test(
        mechanic.damageScope.note
      )
    ) {
      addFinding(findings, {
        code: "SCOPE-PERIODIC",
        severity: "warn",
        skillName: mechanic.skillName,
        message: "A modeled periodic skill does not explain repeat timing in its damage scope.",
        evidence: { scope: mechanic.damageScope },
      });
    }

    if (
      mechanic.targetCorpse &&
      !/(?:corpse|target).*(?:excluded|not represent|not modeled|dependent)/i.test(
        mechanic.damageScope.note
      )
    ) {
      addFinding(findings, {
        code: "SCOPE-TARGET-CORPSE",
        severity: "error",
        skillName: mechanic.skillName,
        message: "A modeled corpse-dependent skill does not state how target life is handled.",
        evidence: { scope: mechanic.damageScope },
      });
    }
  });
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

function isSummonLevelFormula(
  skills: GameTable,
  row: string[],
  column: string,
  tokens: string[]
): boolean {
  return (
    tokens.includes("ulvl") &&
    column === "calc2" &&
    (Boolean(getCell(skills, row, "summon")) ||
      Boolean(getCell(skills, row, "pettype"))) &&
    ["114", "115", "119"].includes(getCell(skills, row, "srvdofunc"))
  );
}

function getFormulaFindingSeverity(
  skills: GameTable,
  row: string[],
  column: string,
  tokens: string[]
): Severity {
  if (tokens.includes("ulvl") && !isSummonLevelFormula(skills, row, column, tokens)) {
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
      const severity = getFormulaFindingSeverity(skills, row, column, tokens);
      if (severity === "info") {
        return;
      }
      addFinding(findings, {
        code: "FORMULA-UNSUPPORTED-TOKEN",
        severity,
        skillName,
        message: "Damage-like skill formula contains tokens needing evaluator support or explicit exclusion.",
        evidence: {
          column,
          stat,
          expression,
          tokens,
          formulaContext: isSummonLevelFormula(skills, row, column, tokens)
            ? "summon-level"
            : undefined,
        },
      });
    });
  });
}

function auditPropertyCoverage(properties: GameTable, findings: Finding[]) {
  const directlyExpandedDamageStats = new Set([
    "firemindam",
    "firemaxdam",
    "coldmindam",
    "coldmaxdam",
    "lightmindam",
    "lightmaxdam",
    "magicmindam",
    "magicmaxdam",
  ]);
  const supportedExpansionFuncs = new Set(["1", "3", "15", "16", "17"]);

  properties.rowsByKey.forEach((row, code) => {
    const slots: Array<{ index: number; func: string; stat: string }> = [];
    for (let index = 1; index <= 7; index += 1) {
      const stat = getCell(properties, row, `stat${index}`);
      const func = getCell(properties, row, `func${index}`);
      if (directlyExpandedDamageStats.has(stat.toLowerCase())) {
        slots.push({ index, func, stat });
      }
    }

    const unsupportedSlots = slots.filter(
      (slot) => slot.func && !supportedExpansionFuncs.has(slot.func)
    );
    if (unsupportedSlots.length > 0) {
      addFinding(findings, {
        code: "ITEM-PROPERTY-FUNC",
        severity: "warn",
        message: "A directly modeled elemental-damage property uses an unsupported expansion function.",
        evidence: {
          code,
          unsupportedSlots,
        },
      });
    }
  });
}

function auditMissileGraph(
  snapshot: DamageRegressionSnapshot,
  missiles: GameTable,
  findings: Finding[]
) {
  const serverChildColumns = [
    "SubMissile1",
    "SubMissile2",
    "SubMissile3",
    "HitSubMissile1",
    "HitSubMissile2",
    "HitSubMissile3",
    "HitSubMissile4",
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

  const serverChildren = new Set<string>();
  const clientChildren = new Set<string>();
  missiles.rowsByKey.forEach((row) => {
    serverChildColumns.forEach((column) => {
      const child = getCell(missiles, row, column);
      if (child) serverChildren.add(child);
    });
    clientChildColumns.forEach((column) => {
      const child = getCell(missiles, row, column);
      if (child) clientChildren.add(child);
    });
  });

  const clientOnlyChildren = new Set(
    Array.from(clientChildren).filter((child) => !serverChildren.has(child))
  );
  snapshot.samples.forEach((sample) => {
    const clientOnlyRefs = sample.expected.profile.damageComponents.flatMap(
      (component) =>
        (component.sourceRefs || []).filter(
          (sourceRef) =>
            sourceRef.table === "Missiles.txt" &&
            sourceRef.row &&
            clientOnlyChildren.has(sourceRef.row)
        )
    );
    if (clientOnlyRefs.length > 0) {
      addFinding(findings, {
        code: "MISSILE-CLIENT-CHILD",
        severity: "error",
        skillName: sample.skillName,
        profileKey: sample.expected.profile.key,
        characterName: sample.characterName,
        message: "Rendered damage includes a missile reachable only through client child fields.",
        evidence: { sourceRefs: clientOnlyRefs },
      });
    }
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
  auditModeledMechanicCoverage(findings);
  auditFormulaCoverage(skills, findings);
  auditPropertyCoverage(properties, findings);
  auditMissileGraph(snapshot, missiles, findings);

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
  if (report.summary.bySeverity.error > 0 || report.summary.bySeverity.warn > 0) {
    process.exitCode = 1;
  }
}

void main();
