import { Pool, PoolConfig } from "pg";
import type {
  GameMode,
  IItemUsageRow,
  ILevelDistribution,
  IMercTypeUsageRow,
  ISkillRequirement,
  ISkillUsageRow,
} from "../../types/meta";

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

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
