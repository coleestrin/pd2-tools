import { Pool, PoolConfig } from "pg";
import type { GameMode, IItemUsageRow, ISkillRequirement } from "../../types/meta";

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

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
