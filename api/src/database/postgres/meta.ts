import { Pool, PoolConfig } from "pg";
import skillPrereqsRaw from "../../data/skill-prereqs.json";
import type {
  GameMode,
  IAffixModRow,
  IClassifiedSkillRow,
  IItemUsageRow,
  ILevelDistribution,
  IMercTypeUsageRow,
  ISkillRequirement,
  ISkillUsageRow,
} from "../../types/meta";

// ---------------------------------------------------------------------------
// Skill-prereqs helpers (ported from PD2/src/lib/aggregate/skillUsage.ts)
// ---------------------------------------------------------------------------

type ClassSkillMap = Record<string, { prereqs: string[]; receivesBonusesFrom: string[] }>;
type SkillPrereqs = Record<string, ClassSkillMap>;
const SKILL_PREREQS = skillPrereqsRaw as SkillPrereqs;

/**
 * Returns true if `skillName` is at exactly base level 1 for this character AND
 * some OTHER skill on the same character (at base level > 1) lists it as a
 * prerequisite. Ported verbatim from PD2/src/lib/aggregate/skillUsage.ts.
 */
function isPrereqOnly(
  skillName: string,
  baseLevel: number,
  characterSkills: Map<string, number>,
  classMap: ClassSkillMap,
): boolean {
  if (baseLevel !== 1) return false;
  for (const [otherName, level] of characterSkills) {
    if (level <= 1) continue;
    if (otherName === skillName) continue;
    if (classMap[otherName]?.prereqs.includes(skillName)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Affix-mod helpers (ported from PD2/src/lib/aggregate/affixMods.ts + slot.ts)
// ---------------------------------------------------------------------------

/** Raw item shape as stored in Characters.full_response_json->'items'[] */
interface RawItemJson {
  quality?: { name?: string };
  location?: { zone?: string; equipment?: string };
  modifiers?: Array<{ name?: string; label?: string; values?: number[] }>;
}

/**
 * Slot mapping — mirrors SLOT_BY_EQUIPMENT in PD2/src/lib/slot.ts.
 * Only "Equipped" zone items are included (zone gate applied before this call).
 */
const SLOT_BY_EQUIPMENT: Record<string, string> = {
  Helm: "helm",
  Armor: "armor",
  "Right Hand": "weapon",
  "Right Hand Switch": "weapon",
  "Left Hand": "offhand",
  "Left Hand Switch": "offhand",
  Gloves: "gloves",
  Belt: "belt",
  Boots: "boots",
  Amulet: "amulet",
  "Left Ring": "ring",
  "Right Ring": "ring",
};

function inferSlot(
  location: { zone?: string; equipment?: string } | undefined,
): string | null {
  if (!location) return null;
  const equipment = location.equipment ?? "";
  return SLOT_BY_EQUIPMENT[equipment] ?? null;
}

/**
 * Skill-tab modifier key — strips leading magnitude so "+1 to Combat Skills"
 * and "+3 to Combat Skills" collapse to the same bucket.
 * Mirrors skillTabBucketKey in PD2/src/lib/aggregate/affixMods.ts.
 */
const SKILL_TAB_MOD = "item_addskill_tab";
const SKILL_TAB_MAGNITUDE_RE = /^\+?\d+(?:\.\d+)?\s+(?:to\s+)?/i;

function skillTabBucketKey(label: string): string {
  const tabName = label.replace(SKILL_TAB_MAGNITUDE_RE, "").trim();
  return `${SKILL_TAB_MOD}|${tabName}`;
}

// ---------------------------------------------------------------------------

/**
 * Items excluded from Unique/Runeword aggregation because they are
 * universal (nearly every character carries them) and would dominate
 * the frequency table. Mirrors IGNORED_UNIQUES_ARRAY in
 * CharacterDB_Postgres (postgres/index.ts).
 */
const IGNORED_UNIQUES_ARRAY = [
  "Hellfire Torch",
  "Annihilus",
  "Call to Arms",
  "Lidless Wall",
];

export interface ICohortFilter {
  gameMode: GameMode;
  className: string;
  minLevel: number;
  skills: ISkillRequirement[];
  /** Season number — always passed in from the route (config.currentSeason or req.query.season). */
  season: number;
}

export class MetaDB_Postgres {
  private pool: Pool;
  private readonly dbConfig: PoolConfig;

  constructor() {
    this.dbConfig = {
      user: process.env.POSTGRES_USER || "postgres",
      host: process.env.POSTGRES_HOST || "localhost",
      database: process.env.POSTGRES_DB || "pd2",
      password: process.env.POSTGRES_PASSWORD,
      port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
      max: 100,
    };

    this.pool = new Pool(this.dbConfig);
  }

  /**
   * Find the cohort of character_db_ids matching the filter.
   *
   * Mirrors buildFilterCTE / getFilteredCharacters: resolves game_mode_id via
   * inline subquery, joins Classes for className, EXISTS-clause per required
   * skill against CharacterSkills joined to SkillsDefinitions.
   *
   * Returns an array of character_db_id values. Empty array if nothing matches.
   * All downstream aggregation queries (Tasks 7-8) take this list as their
   * starting set.
   */
  public async findCohort(filter: ICohortFilter): Promise<number[]> {
    const params: any[] = [
      filter.gameMode,   // $1 — resolved via subquery in GameModes
      filter.season,     // $2
      filter.minLevel,   // $3
      filter.className,  // $4 — matched via Classes join
    ];
    let paramIndex = 5;

    const skillClauses: string[] = [];
    for (const skill of filter.skills) {
      skillClauses.push(`
        AND EXISTS (
          SELECT 1 FROM CharacterSkills CS
          JOIN SkillsDefinitions SD ON CS.skill_def_id = SD.skill_def_id
          WHERE CS.character_db_id = C.character_db_id
            AND SD.name = $${paramIndex++}
            AND CS.skill_level >= $${paramIndex++}
        )`);
      params.push(skill.name, skill.minLevel);
    }

    const sql = `
      SELECT C.character_db_id
      FROM Characters C
      JOIN Classes CL ON C.class_id = CL.class_id
      WHERE C.game_mode_id = (SELECT game_mode_id FROM GameModes WHERE name = $1)
        AND C.season = $2
        AND C.level >= $3
        AND CL.name = $4
        ${skillClauses.join("")}
    `;

    const result = await this.pool.query<{ character_db_id: number }>(
      sql,
      params
    );
    return result.rows.map((r) => r.character_db_id);
  }

  /**
   * Aggregate equipped-item usage across the given cohort.
   *
   * Counts how many characters wear each named item. Only Unique / Set /
   * Runeword qualities are included — Rare / Magic / Crafted items have
   * unique random names and can't be name-aggregated (those are handled
   * by the affix-mods aggregation in Task 17).
   *
   * Mirrors the existing analyzeItemUsage CASE logic for item-type
   * classification (see CharacterDB_Postgres for reference), including
   * the IGNORED_UNIQUES_ARRAY exclusion for ubiquitous items (Torch,
   * Annihilus, Call to Arms, Lidless Wall).
   *
   * Returns rows sorted by numOccurrences desc.
   */
  public async aggregateItemUsage(
    cohortIds: number[],
  ): Promise<IItemUsageRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        BI.name AS item,
        CASE
          WHEN CI.is_runeword = true AND BI.name <> ALL($3) THEN 'Runeword'
          WHEN Q.name = 'Unique' AND BI.name <> ALL($3) THEN 'Unique'
          WHEN Q.name = 'Set' THEN 'Set'
          ELSE NULL
        END AS "itemType",
        COUNT(DISTINCT CI.character_db_id)::int AS "numOccurrences",
        $2::int AS "totalSample",
        (COUNT(DISTINCT CI.character_db_id)::float / $2 * 100) AS pct
      FROM CharacterItems CI
      JOIN BaseItems BI ON CI.base_item_id = BI.base_item_id
      JOIN Qualities Q ON CI.quality_id = Q.quality_id
      WHERE CI.character_db_id = ANY($1::int[])
        AND CASE
          WHEN CI.is_runeword = true AND BI.name <> ALL($3) THEN 'Runeword'
          WHEN Q.name = 'Unique' AND BI.name <> ALL($3) THEN 'Unique'
          WHEN Q.name = 'Set' THEN 'Set'
          ELSE NULL
        END IS NOT NULL
      GROUP BY BI.name, "itemType"
      ORDER BY "numOccurrences" DESC
    `;

    const result = await this.pool.query<IItemUsageRow>(sql, [
      cohortIds,
      cohortIds.length,
      IGNORED_UNIQUES_ARRAY,
    ]);
    return result.rows;
  }

  /**
   * Aggregate skill usage across the cohort: for each skill, how many
   * cohort members have base level >= 1 in it.
   *
   * Mirrors analyzeSkillUsage's JOIN structure (CharacterSkills JOIN
   * SkillsDefinitions). Returns rows sorted by numOccurrences desc.
   * Skills with zero cohort members do not appear. Uses base skill_level
   * from CharacterSkills (not item-boosted effective level).
   */
  public async aggregateSkillUsage(
    cohortIds: number[],
  ): Promise<ISkillUsageRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        SD.name AS name,
        COUNT(DISTINCT CS.character_db_id)::int AS "numOccurrences",
        $2::int AS "totalSample",
        (COUNT(DISTINCT CS.character_db_id)::float / $2 * 100) AS pct
      FROM CharacterSkills CS
      JOIN SkillsDefinitions SD ON CS.skill_def_id = SD.skill_def_id
      WHERE CS.character_db_id = ANY($1::int[])
        AND CS.skill_level >= 1
      GROUP BY SD.name
      ORDER BY "numOccurrences" DESC
    `;
    const result = await this.pool.query<ISkillUsageRow>(sql, [cohortIds, cohortIds.length]);
    return result.rows;
  }

  /**
   * Aggregate skill usage across the cohort with prereq/build classification.
   *
   * For each character, a 1-point skill is classified as "prereq-only" if
   * another skill at base > 1 on the same character lists it as a prerequisite
   * in skill-prereqs.json. All other skilled-into entries count as "build".
   *
   * Falls back gracefully when the className has no entry in skill-prereqs.json
   * (classMap = undefined): every skill is treated as a build skill.
   *
   * Returns rows sorted by pctBuild desc (same ranking as the PD2 standalone).
   */
  public async aggregateSkillUsageClassified(
    cohortIds: number[],
    className: string,
  ): Promise<IClassifiedSkillRow[]> {
    if (cohortIds.length === 0) return [];

    const classMap: ClassSkillMap | undefined = SKILL_PREREQS[className];

    // Pull all (character_db_id, skill_name, base_level) tuples for the cohort
    const sql = `
      SELECT CS.character_db_id, SD.name, CS.skill_level
      FROM CharacterSkills CS
      JOIN SkillsDefinitions SD ON CS.skill_def_id = SD.skill_def_id
      WHERE CS.character_db_id = ANY($1::int[])
        AND CS.skill_level >= 1
    `;
    const result = await this.pool.query<{
      character_db_id: number;
      name: string;
      skill_level: number;
    }>(sql, [cohortIds]);

    // Group by character: character_db_id -> Map<skillName, baseLevel>
    const byChar = new Map<number, Map<string, number>>();
    for (const row of result.rows) {
      let cs = byChar.get(row.character_db_id);
      if (!cs) {
        cs = new Map();
        byChar.set(row.character_db_id, cs);
      }
      cs.set(row.name, row.skill_level);
    }

    // Aggregate per skill
    type Acc = { numWithAny: number; numAsBuild: number; numAsPrereq: number };
    const stats = new Map<string, Acc>();

    for (const [, charSkills] of byChar) {
      for (const [skillName, baseLevel] of charSkills) {
        let s = stats.get(skillName);
        if (!s) {
          s = { numWithAny: 0, numAsBuild: 0, numAsPrereq: 0 };
          stats.set(skillName, s);
        }
        s.numWithAny++;
        if (classMap && isPrereqOnly(skillName, baseLevel, charSkills, classMap)) {
          s.numAsPrereq++;
        } else {
          s.numAsBuild++;
        }
      }
    }

    const total = cohortIds.length;
    const out: IClassifiedSkillRow[] = [];
    for (const [name, s] of stats) {
      out.push({
        name,
        numOccurrences: s.numWithAny,
        numAsBuild: s.numAsBuild,
        numAsPrereq: s.numAsPrereq,
        totalSample: total,
        pct: (s.numWithAny / total) * 100,
        pctBuild: (s.numAsBuild / total) * 100,
      });
    }
    out.sort((a, b) => b.pctBuild - a.pctBuild);
    return out;
  }

  /**
   * Aggregate mercenary types across the cohort. CharacterMercenaries
   * stores one row per character with the merc type in `description`.
   *
   * Mirrors analyzeMercTypeUsage's GROUP BY CM.description pattern.
   * Returns rows sorted by numOccurrences desc.
   */
  public async aggregateMercType(
    cohortIds: number[],
  ): Promise<IMercTypeUsageRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        CM.description AS "mercType",
        COUNT(DISTINCT CM.character_db_id)::int AS "numOccurrences",
        $2::int AS "totalSample",
        (COUNT(DISTINCT CM.character_db_id)::float / $2 * 100) AS pct
      FROM CharacterMercenaries CM
      WHERE CM.character_db_id = ANY($1::int[])
        AND CM.description IS NOT NULL
      GROUP BY CM.description
      ORDER BY "numOccurrences" DESC
    `;
    const result = await this.pool.query<IMercTypeUsageRow>(sql, [cohortIds, cohortIds.length]);
    return result.rows;
  }

  /**
   * Aggregate equipped items on mercenaries across the cohort.
   *
   * Same CASE-based classification as aggregateItemUsage (Unique / Set /
   * Runeword) and uses the same IGNORED_UNIQUES_ARRAY exclusion. MercenaryItems
   * joins directly via character_db_id (no separate merc_id — one merc per
   * character). Mirrors analyzeMercItemUsage's table/JOIN structure.
   *
   * Returns rows sorted by numOccurrences desc.
   */
  public async aggregateMercItems(
    cohortIds: number[],
  ): Promise<IItemUsageRow[]> {
    if (cohortIds.length === 0) return [];

    const sql = `
      SELECT
        BI.name AS item,
        CASE
          WHEN MI.is_runeword = true AND BI.name <> ALL($3) THEN 'Runeword'
          WHEN Q.name = 'Unique' AND BI.name <> ALL($3) THEN 'Unique'
          WHEN Q.name = 'Set' THEN 'Set'
          ELSE NULL
        END AS "itemType",
        COUNT(DISTINCT MI.character_db_id)::int AS "numOccurrences",
        $2::int AS "totalSample",
        (COUNT(DISTINCT MI.character_db_id)::float / $2 * 100) AS pct
      FROM MercenaryItems MI
      JOIN BaseItems BI ON MI.base_item_id = BI.base_item_id
      JOIN Qualities Q ON MI.quality_id = Q.quality_id
      WHERE MI.character_db_id = ANY($1::int[])
        AND CASE
          WHEN MI.is_runeword = true AND BI.name <> ALL($3) THEN 'Runeword'
          WHEN Q.name = 'Unique' AND BI.name <> ALL($3) THEN 'Unique'
          WHEN Q.name = 'Set' THEN 'Set'
          ELSE NULL
        END IS NOT NULL
      GROUP BY BI.name, "itemType"
      ORDER BY "numOccurrences" DESC
    `;
    const result = await this.pool.query<IItemUsageRow>(sql, [
      cohortIds,
      cohortIds.length,
      IGNORED_UNIQUES_ARRAY,
    ]);
    return result.rows;
  }

  /**
   * Level distribution buckets — counts of characters at each integer level
   * within the cohort. The pd2.tools level-distribution endpoint returns both
   * hardcore and softcore sides; the /meta cohort is already filtered to one
   * gameMode, so only the matching side is populated and the other is empty.
   */
  public async aggregateLevelDistribution(
    cohortIds: number[],
    /** Selects which side of the response shape to populate.
     *  Not used in the SQL — the cohort is already mode-filtered by findCohort. */
    gameMode: GameMode,
  ): Promise<ILevelDistribution> {
    if (cohortIds.length === 0) return { hardcore: [], softcore: [] };

    const sql = `
      SELECT C.level, COUNT(*)::int AS "numOccurrences"
      FROM Characters C
      WHERE C.character_db_id = ANY($1::int[])
      GROUP BY C.level
      ORDER BY C.level
    `;
    const result = await this.pool.query<{ level: number; numOccurrences: number }>(
      sql,
      [cohortIds],
    );
    return gameMode === "hardcore"
      ? { hardcore: result.rows, softcore: [] }
      : { hardcore: [], softcore: result.rows };
  }

  /**
   * Aggregate affix modifiers from Rare/Magic/Crafted equipped items across
   * the cohort.
   *
   * Strategy (Node-side parsing, Approach B):
   *   - SQL: pull full items array from each character's full_response_json.
   *   - Node: iterate items, check quality + zone, bucket modifiers by
   *     (slot, mod.name / skill-tab key), compute count / avg / median / p75.
   *
   * Parsing logic is ported verbatim from PD2/src/lib/aggregate/affixMods.ts
   * so numbers line up with the standalone's parity test corpus.
   */
  public async aggregateAffixMods(
    cohortIds: number[],
  ): Promise<IAffixModRow[]> {
    if (cohortIds.length === 0) return [];

    // Pull the raw items array for every character in the cohort.
    // jsonb_array_elements expands the JSON array into one row per item.
    const sql = `
      SELECT
        jsonb_array_elements(C.full_response_json->'items') AS item_json
      FROM Characters C
      WHERE C.character_db_id = ANY($1::int[])
    `;
    const { rows } = await this.pool.query<{ item_json: RawItemJson }>(
      sql,
      [cohortIds],
    );

    // slot -> modKey -> values[]
    const grouped = new Map<string, Map<string, number[]>>();
    // slot -> number of eligible items (denominator for pct — mirrors standalone)
    const itemCountBySlot = new Map<string, number>();

    for (const row of rows) {
      const item = row.item_json;
      if (!item) continue;

      // Quality gate: only Rare / Magic / Crafted
      const quality = item.quality?.name;
      if (quality !== "Rare" && quality !== "Magic" && quality !== "Crafted") continue;

      // Zone gate: must be equipped (location.zone === "Equipped")
      if (item.location?.zone !== "Equipped") continue;

      // Slot resolution — mirrors slotFromRawItem in PD2/src/lib/slot.ts
      const slot = inferSlot(item.location);
      if (!slot) continue;

      // Track per-slot item count (denominator for pct, same as standalone)
      itemCountBySlot.set(slot, (itemCountBySlot.get(slot) ?? 0) + 1);

      const modifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      for (const mod of modifiers) {
        if (typeof mod.name !== "string") continue;
        const val = Array.isArray(mod.values)
          ? (mod.values[0] ?? 0)
          : Number(mod.values) || 0;

        // For item_addskill_tab: bucket by "item_addskill_tab|Tab Name"
        // so +1/+3 to the same tab land in the same bucket.
        const bucketKey =
          mod.name === SKILL_TAB_MOD
            ? skillTabBucketKey(mod.label ?? "")
            : mod.name;

        let bySlot = grouped.get(slot);
        if (!bySlot) {
          bySlot = new Map();
          grouped.set(slot, bySlot);
        }
        const arr = bySlot.get(bucketKey) ?? [];
        arr.push(val);
        bySlot.set(bucketKey, arr);
      }
    }

    const out: IAffixModRow[] = [];

    for (const [slot, byMod] of grouped) {
      // Per-slot item count as denominator (mirrors standalone's itemCount[slot])
      const slotItemCount = itemCountBySlot.get(slot) ?? 1;

      for (const [modKey, vals] of byMod) {
        // Suppress rare mods (< 3 occurrences) to reduce noise
        if (vals.length < 3) continue;

        const sorted = [...vals].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const avg = sum / sorted.length;
        const mid = Math.floor(sorted.length / 2);
        const medianVal =
          sorted.length % 2 === 1
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
        const p75Idx = Math.ceil(0.75 * sorted.length) - 1;
        const p75Val = sorted[Math.max(0, p75Idx)];

        out.push({
          slot,
          modKey,
          numOccurrences: vals.length,
          totalSample: slotItemCount,
          pct: (vals.length / slotItemCount) * 100,
          avg,
          median: medianVal,
          p75: p75Val,
        });
      }
    }

    // Sort by slot asc, then pct desc (mirrors standalone)
    out.sort((a, b) =>
      a.slot === b.slot ? b.pct - a.pct : a.slot.localeCompare(b.slot),
    );

    return out;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
