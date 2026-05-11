import { Pool, PoolConfig } from "pg";
import type { GameMode, ISkillRequirement } from "../../types/meta";

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
    const params: unknown[] = [
      filter.gameMode.toLowerCase(), // $1 — resolved via subquery in GameModes
      filter.season,                 // $2
      filter.minLevel,               // $3
      filter.className,              // $4 — matched via Classes join
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

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
