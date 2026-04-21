import { Pool, PoolConfig, PoolClient } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

export interface FullCharacterResponse {
  character: {
    name: string;
    level: number;
    life: number;
    mana: number;
    experience: number;
    class: { id: number; name: string };
    skills: Array<{ id: number; name: string; level: number }>;
    season?: number;
  } | null;
  items: Array<{
    name: string;
    quality: { name: string };
    runeword?: boolean;
  }> | null;
  mercenary?: unknown;
  nullReason?: string;
  realSkills: unknown[];
  lastUpdated: number;
  accountName?: string;
  [key: string]: unknown;
}

export interface SkillRequirement {
  name: string;
  minLevel: number;
}

export interface CharacterFilter {
  requiredClasses?: string[];
  requiredItems?: string[];
  requiredSkills?: SkillRequirement[];
  requiredMercTypes?: string[];
  requiredMercItems?: string[];
  levelRange?: {
    min?: number;
    max?: number;
  };
  season?: number;
}

type ItemType = "Unique" | "Set" | "Runeword";

export interface ItemUsageStats {
  item: string;
  itemType: ItemType;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

export interface SkillUsageStats {
  name: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

export interface MercTypeStats {
  mercType: string;
  numOccurrences: number;
  totalSample: number;
  pct: number;
}

const IGNORED_UNIQUES_ARRAY = [
  "Hellfire Torch",
  "Annihilus",
  "Gheed's Fortune",
  "Call to Arms",
  "Lidless Wall",
];

export default class CharacterDB_Postgres {
  private pool: Pool;
  private readonly dbConfig: PoolConfig;
  public readonly ready: Promise<void>;

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
    this.ready = this.initSchema().catch((error) => {
      // Ignore "already exists" errors (happens with parallel test workers)
      if (error.code === "42P07" || error.code === "23505") {
        // 42P07 = duplicate table/relation, 23505 = duplicate key (for types)
        return;
      }
      console.error("Failed to initialize database schema:", error);
      process.exit(1);
    });
  }

  private async initSchema(): Promise<void> {
    await this.pool.query(`
            CREATE TABLE IF NOT EXISTS GameModes (
                game_mode_id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS Classes (
                class_id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS SkillsDefinitions (
                skill_def_id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS Qualities (
                quality_id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS BaseItems (
                base_item_id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS Characters (
                character_db_id SERIAL PRIMARY KEY,
                game_mode_id INTEGER NOT NULL,
                api_character_name TEXT NOT NULL,
                level INTEGER,
                life INTEGER,
                mana INTEGER,
                class_id INTEGER,
                season INTEGER NOT NULL,
                last_updated BIGINT,
                null_reason TEXT,
                full_response_json JSONB NOT NULL,
                FOREIGN KEY (game_mode_id) REFERENCES GameModes(game_mode_id),
                FOREIGN KEY (class_id) REFERENCES Classes(class_id),
                UNIQUE (game_mode_id, api_character_name, season)
            );

            -- Add account_name column if it doesn't exist
            ALTER TABLE Characters ADD COLUMN IF NOT EXISTS account_name TEXT;

            CREATE TABLE IF NOT EXISTS CharacterSkills (
                character_db_id INTEGER NOT NULL,
                skill_def_id INTEGER NOT NULL,
                skill_level INTEGER NOT NULL,
                FOREIGN KEY (character_db_id) REFERENCES Characters(character_db_id) ON DELETE CASCADE,
                FOREIGN KEY (skill_def_id) REFERENCES SkillsDefinitions(skill_def_id),
                PRIMARY KEY (character_db_id, skill_def_id)
            );

            CREATE TABLE IF NOT EXISTS CharacterItems (
                item_instance_id SERIAL PRIMARY KEY,
                character_db_id INTEGER NOT NULL,
                base_item_id INTEGER NOT NULL,
                quality_id INTEGER NOT NULL,
                is_runeword BOOLEAN,
                FOREIGN KEY (character_db_id) REFERENCES Characters(character_db_id) ON DELETE CASCADE,
                FOREIGN KEY (base_item_id) REFERENCES BaseItems(base_item_id),
                FOREIGN KEY (quality_id) REFERENCES Qualities(quality_id)
            );

            CREATE TABLE IF NOT EXISTS OnlinePlayersHistory (
                history_id SERIAL PRIMARY KEY,
                num_online_players INTEGER NOT NULL,
                timestamp BIGINT NOT NULL
            );

            -- Existing indexes
            CREATE INDEX IF NOT EXISTS idx_chars_game_mode_name ON Characters(game_mode_id, api_character_name);
            CREATE INDEX IF NOT EXISTS idx_chars_class_id ON Characters(class_id);
            CREATE INDEX IF NOT EXISTS idx_chars_level ON Characters(level);
            CREATE INDEX IF NOT EXISTS idx_chars_season ON Characters(season);
            CREATE INDEX IF NOT EXISTS idx_chars_account_name ON Characters(account_name);
            CREATE INDEX IF NOT EXISTS idx_char_skills_skill_def_id ON CharacterSkills(skill_def_id);
            CREATE INDEX IF NOT EXISTS idx_char_items_base_item_id ON CharacterItems(base_item_id);
            CREATE INDEX IF NOT EXISTS idx_char_items_quality_id ON CharacterItems(quality_id);
            CREATE INDEX IF NOT EXISTS idx_chars_api_character_name_lower ON Characters (LOWER(api_character_name));
            CREATE INDEX IF NOT EXISTS idx_chars_game_mode_level ON Characters(game_mode_id, level);
            CREATE INDEX IF NOT EXISTS idx_chars_game_mode_season ON Characters(game_mode_id, season);

            -- New composite indexes for filtering performance
            CREATE INDEX IF NOT EXISTS idx_chars_game_mode_season_class ON Characters(game_mode_id, season, class_id);
            CREATE INDEX IF NOT EXISTS idx_chars_game_mode_season_level ON Characters(game_mode_id, season, level);
            CREATE INDEX IF NOT EXISTS idx_char_items_char_base ON CharacterItems(character_db_id, base_item_id);
            CREATE INDEX IF NOT EXISTS idx_char_skills_char_skill ON CharacterSkills(character_db_id, skill_def_id);
            CREATE INDEX IF NOT EXISTS idx_char_skills_char_skill_level ON CharacterSkills(character_db_id, skill_def_id, skill_level);

            -- Mercenary tables
            CREATE TABLE IF NOT EXISTS CharacterMercenaries (
                character_db_id INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                FOREIGN KEY (character_db_id) REFERENCES Characters(character_db_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS MercenaryItems (
                merc_item_id SERIAL PRIMARY KEY,
                character_db_id INTEGER NOT NULL,
                base_item_id INTEGER NOT NULL,
                quality_id INTEGER NOT NULL,
                is_runeword BOOLEAN,
                FOREIGN KEY (character_db_id) REFERENCES Characters(character_db_id) ON DELETE CASCADE,
                FOREIGN KEY (base_item_id) REFERENCES BaseItems(base_item_id),
                FOREIGN KEY (quality_id) REFERENCES Qualities(quality_id)
            );

            -- Mercenary indexes
            CREATE INDEX IF NOT EXISTS idx_char_merc_covering ON CharacterMercenaries(character_db_id, description);
            CREATE INDEX IF NOT EXISTS idx_merc_items_char ON MercenaryItems(character_db_id);
            CREATE INDEX IF NOT EXISTS idx_merc_items_base ON MercenaryItems(base_item_id);
            CREATE INDEX IF NOT EXISTS idx_merc_items_char_base ON MercenaryItems(character_db_id, base_item_id);

            -- Character Snapshots table for historical tracking
            CREATE TABLE IF NOT EXISTS CharacterSnapshots (
                snapshot_id SERIAL PRIMARY KEY,
                character_db_id INTEGER NOT NULL,
                game_mode_id INTEGER NOT NULL,
                api_character_name TEXT NOT NULL,
                season INTEGER NOT NULL,
                level INTEGER,
                snapshot_timestamp BIGINT NOT NULL,
                full_response_json JSONB NOT NULL
            );

            -- Snapshot indexes
            CREATE INDEX IF NOT EXISTS idx_snapshots_char_time ON CharacterSnapshots(character_db_id, snapshot_timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_snapshots_lookup ON CharacterSnapshots(game_mode_id, api_character_name, season, snapshot_timestamp DESC);

            -- Leaderboard tables
            CREATE TABLE IF NOT EXISTS AccountLevel99Leaderboard (
                id SERIAL PRIMARY KEY,
                account_name VARCHAR(100) NOT NULL,
                count INTEGER NOT NULL,
                game_mode VARCHAR(20) NOT NULL,
                season INTEGER NOT NULL,
                last_updated BIGINT NOT NULL,
                UNIQUE (account_name, game_mode, season)
            );

            CREATE TABLE IF NOT EXISTS MirroredItemLeaderboard (
                id SERIAL PRIMARY KEY,
                item_name VARCHAR(100) NOT NULL,
                item_base_name VARCHAR(100),
                count INTEGER NOT NULL,
                properties_signature TEXT NOT NULL,
                example_item_json JSONB NOT NULL,
                example_character_name VARCHAR(100) NOT NULL,
                game_mode VARCHAR(20) NOT NULL,
                season INTEGER NOT NULL,
                last_updated BIGINT NOT NULL,
                UNIQUE (season, game_mode, properties_signature)
            );

            -- Leaderboard indexes
            CREATE INDEX IF NOT EXISTS idx_account_lb_count ON AccountLevel99Leaderboard(game_mode, season, count DESC);
            CREATE INDEX IF NOT EXISTS idx_mirrored_lb_count ON MirroredItemLeaderboard(game_mode, season, count DESC);
        `);
  }

  public async logOnlinePlayers(playerCount: number): Promise<void> {
    const query = `
            INSERT INTO OnlinePlayersHistory (num_online_players, timestamp)
            VALUES ($1, $2)
        `;
    await this.pool.query(query, [playerCount, Date.now()]);
  }

  public async getOnlinePlayersHistory(): Promise<
    Array<{
      history_id: number;
      num_online_players: number;
      timestamp: number;
    }>
  > {
    const query = `
            SELECT history_id, num_online_players, timestamp
            FROM OnlinePlayersHistory
            ORDER BY timestamp ASC
        `;
    const { rows } = await this.pool.query(query);
    return rows.map((r) => ({
      ...r,
      timestamp: parseInt(r.timestamp, 10),
    }));
  }

  private async getOrInsertLookupId(
    tableName: string,
    nameColumn: string,
    value: string
  ): Promise<number | null> {
    if (value === null || value === undefined) return null;

    const idColumnMap: Record<string, string> = {
      GameModes: "game_mode_id",
      Classes: "class_id",
      SkillsDefinitions: "skill_def_id",
      Qualities: "quality_id",
      BaseItems: "base_item_id",
    };

    const idColumnName = idColumnMap[tableName];
    if (!idColumnName) {
      throw new Error(
        `ID column name not defined for table: ${tableName} in getOrInsertLookupId`
      );
    }

    const query = `
            WITH ins AS (
                INSERT INTO ${tableName} (${nameColumn})
                VALUES ($1)
                ON CONFLICT (${nameColumn}) DO NOTHING
                RETURNING ${idColumnName}
            )
            SELECT ${idColumnName} FROM ins
            UNION ALL
            SELECT ${idColumnName} FROM ${tableName} WHERE ${nameColumn} = $1 AND NOT EXISTS (SELECT 1 FROM ins)
        `;

    const { rows } = await this.pool.query(query, [value]);
    return rows[0] ? rows[0][idColumnName] : null;
  }

  public async clearGameModeData(
    gameModeName: string,
    season?: number
  ): Promise<void> {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName
    );
    if (gameModeId === null) return;

    if (season !== undefined) {
      await this.pool.query(
        "DELETE FROM CharacterSnapshots WHERE game_mode_id = $1 AND season = $2",
        [gameModeId, season]
      );
      await this.pool.query(
        "DELETE FROM Characters WHERE game_mode_id = $1 AND season = $2",
        [gameModeId, season]
      );
    } else {
      await this.pool.query(
        "DELETE FROM CharacterSnapshots WHERE game_mode_id = $1",
        [gameModeId]
      );
      await this.pool.query("DELETE FROM Characters WHERE game_mode_id = $1", [
        gameModeId,
      ]);
    }
  }

  public async getLevelDistributions(season?: number): Promise<{
    softcore: Array<{ level: number; count: number }>;
    hardcore: Array<{ level: number; count: number }>;
  }> {
    const softcoreId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      "softcore"
    );
    const hardcoreId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      "hardcore"
    );

    if (softcoreId === null || hardcoreId === null) {
      return { softcore: [], hardcore: [] };
    }

    const seasonFilter = season !== undefined ? `AND c.season = $3` : "";
    const params =
      season !== undefined
        ? [softcoreId, hardcoreId, season]
        : [softcoreId, hardcoreId];

    const query = `
            WITH level_series AS (
                SELECT generate_series(80, 99) AS level
            ),
            softcore_counts AS (
                SELECT c.level, COUNT(*)::int AS count
                FROM Characters c
                WHERE c.game_mode_id = $1
                AND c.level BETWEEN 80 AND 99
                ${seasonFilter}
                GROUP BY c.level
            ),
            hardcore_counts AS (
                SELECT c.level, COUNT(*)::int AS count
                FROM Characters c
                WHERE c.game_mode_id = $2
                AND c.level BETWEEN 80 AND 99
                ${seasonFilter}
                GROUP BY c.level
            )
            SELECT
                ls.level,
                COALESCE(sc.count, 0) AS softcore_count,
                COALESCE(hc.count, 0) AS hardcore_count
            FROM level_series ls
            LEFT JOIN softcore_counts sc ON ls.level = sc.level
            LEFT JOIN hardcore_counts hc ON ls.level = hc.level
            ORDER BY ls.level
        `;

    const { rows } = await this.pool.query(query, params);

    const softcore = [];
    const hardcore = [];

    for (const row of rows) {
      softcore.push({ level: row.level, count: row.softcore_count });
      hardcore.push({ level: row.level, count: row.hardcore_count });
    }

    return { softcore, hardcore };
  }

  public async ingestCharacter(
    charData: FullCharacterResponse,
    gameModeName: string,
    season: number,
    accountName?: string
  ): Promise<void> {
    if (!charData.character || !charData.character.name) return;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const gameModeId = await this.getOrInsertLookupId(
        "GameModes",
        "name",
        gameModeName.toLowerCase()
      );
      const classId = charData.character.class
        ? await this.getOrInsertLookupId(
            "Classes",
            "name",
            charData.character.class.name
          )
        : null;

      // Snapshot logic: capture state before deletion
      const existingCharResult = await client.query(
        `SELECT character_db_id, full_response_json, season, account_name
         FROM Characters
         WHERE game_mode_id = $1 AND api_character_name = $2 AND season = $3`,
        [gameModeId, charData.character.name, season]
      );

      if (existingCharResult.rows.length > 0) {
        const existingChar = existingCharResult.rows[0];
        const existingData = existingChar.full_response_json;

        // Get last snapshot timestamp
        const lastSnapshotResult = await client.query(
          `SELECT snapshot_timestamp FROM CharacterSnapshots
           WHERE character_db_id = $1
           ORDER BY snapshot_timestamp DESC
           LIMIT 1`,
          [existingChar.character_db_id]
        );
        const lastSnapshotTimestamp = lastSnapshotResult.rows[0]
          ? parseInt(lastSnapshotResult.rows[0].snapshot_timestamp, 10)
          : null;

        // Check if we should create a snapshot
        if (
          this.shouldCreateSnapshot(
            existingData,
            charData,
            lastSnapshotTimestamp
          )
        ) {
          await this.createSnapshot(
            client,
            existingChar.character_db_id,
            gameModeId!,
            charData.character.name,
            season,
            existingData
          );
        }
      }

      await client.query(
        "DELETE FROM Characters WHERE game_mode_id = $1 AND api_character_name = $2 AND season = $3",
        [gameModeId, charData.character.name, season]
      );

      // Add account_name to the response object if provided
      if (accountName) {
        charData.accountName = accountName;
      }

      const charResult = await client.query(
        `INSERT INTO Characters (
                    game_mode_id, api_character_name, level, life, mana, class_id,
                    season, last_updated, null_reason, full_response_json, account_name
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING character_db_id`,
        [
          gameModeId,
          charData.character.name,
          charData.character.level,
          charData.character.life,
          charData.character.mana,
          classId,
          season,
          charData.lastUpdated || Date.now(),
          charData.nullReason,
          charData,
          accountName || null,
        ]
      );
      const characterDbId = charResult.rows[0]?.character_db_id;

      if (!characterDbId) throw new Error("Failed to insert character");

      if (charData.character.skills?.length) {
        for (const skill of charData.character.skills) {
          const skillDefId = await this.getOrInsertLookupId(
            "SkillsDefinitions",
            "name",
            skill.name
          );
          if (skillDefId !== null) {
            await client.query(
              "INSERT INTO CharacterSkills (character_db_id, skill_def_id, skill_level) VALUES ($1, $2, $3)",
              [characterDbId, skillDefId, skill.level]
            );
          }
        }
      }

      if (charData.items?.length) {
        for (const item of charData.items) {
          if (!item.name || !item.quality?.name) continue;
          const baseItemId = await this.getOrInsertLookupId(
            "BaseItems",
            "name",
            item.name
          );
          const qualityId = await this.getOrInsertLookupId(
            "Qualities",
            "name",
            item.quality.name
          );
          if (baseItemId !== null && qualityId !== null) {
            await client.query(
              "INSERT INTO CharacterItems (character_db_id, base_item_id, quality_id, is_runeword) VALUES ($1, $2, $3, $4)",
              [characterDbId, baseItemId, qualityId, !!item.runeword]
            );
          }
        }
      }

      // Insert mercenary data
      if (charData.mercenary && typeof charData.mercenary === "object") {
        try {
          const mercData = charData.mercenary as {
            description?: string;
            items?: Array<{
              name?: string;
              quality?: { name?: string };
              runeword?: boolean;
            }>;
          };

          // Validate and insert mercenary type
          if (
            mercData.description &&
            typeof mercData.description === "string"
          ) {
            await client.query(
              `INSERT INTO CharacterMercenaries (character_db_id, description)
               VALUES ($1, $2)
               ON CONFLICT (character_db_id) DO UPDATE SET description = $2`,
              [characterDbId, mercData.description]
            );
          } else {
            console.warn(
              `Character ${characterDbId}: Invalid mercenary description`
            );
          }

          // Delete old merc items before inserting new ones
          await client.query(
            "DELETE FROM MercenaryItems WHERE character_db_id = $1",
            [characterDbId]
          );

          // Insert merc items
          if (Array.isArray(mercData.items) && mercData.items.length > 0) {
            let skippedItems = 0;

            for (const item of mercData.items) {
              if (!item.name || !item.quality?.name) {
                skippedItems++;
                continue;
              }

              const baseItemId = await this.getOrInsertLookupId(
                "BaseItems",
                "name",
                item.name
              );
              const qualityId = await this.getOrInsertLookupId(
                "Qualities",
                "name",
                item.quality.name
              );

              if (baseItemId !== null && qualityId !== null) {
                await client.query(
                  `INSERT INTO MercenaryItems (character_db_id, base_item_id, quality_id, is_runeword)
                   VALUES ($1, $2, $3, $4)`,
                  [characterDbId, baseItemId, qualityId, !!item.runeword]
                );
              }
            }

            if (skippedItems > 0) {
              console.warn(
                `Character ${characterDbId}: Skipped ${skippedItems} invalid merc items`
              );
            }
          }
        } catch (error) {
          console.error(
            `Failed to insert mercenary data for character ${characterDbId}:`,
            error
          );
          // Don't throw - allow character insertion to succeed even if merc data fails
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(
        `Failed to ingest character ${charData.character?.name}:`,
        error
      );
    } finally {
      client.release();
    }
  }

  /**
   * Checks if a snapshot should be created based on change detection
   */
  private shouldCreateSnapshot(
    existing: FullCharacterResponse | null,
    incoming: FullCharacterResponse,
    lastSnapshotTimestamp: number | null
  ): boolean {
    // No existing character means first ingestion - create snapshot
    if (!existing || !existing.character) return true;

    const SNAPSHOT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms
    const now = Date.now();

    // Check if character has gained experience (leveling up)
    const hasChanged =
      existing.character.experience !== incoming.character?.experience;

    // If changed, always create snapshot (frequent snapshots while leveling)
    if (hasChanged) {
      return true;
    }

    // If no change, check time-based snapshot (for level 99 characters)
    // Use lastSnapshotTimestamp if exists, otherwise fall back to lastUpdated
    const lastUpdateTime = lastSnapshotTimestamp || existing.lastUpdated || 0;

    if (now - lastUpdateTime >= SNAPSHOT_INTERVAL) {
      return true; // Daily snapshot even without exp change
    }

    // No change and within 24h window
    return false;
  }

  /**
   * Creates a snapshot of the current character state
   */
  private async createSnapshot(
    client: PoolClient,
    characterDbId: number,
    gameModeId: number,
    characterName: string,
    season: number,
    charData: FullCharacterResponse
  ): Promise<void> {
    await client.query(
      `INSERT INTO CharacterSnapshots (
        character_db_id, game_mode_id, api_character_name, season, level, snapshot_timestamp, full_response_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        characterDbId,
        gameModeId,
        characterName,
        season,
        charData.character?.level || null,
        charData.lastUpdated || Date.now(),
        charData,
      ]
    );
  }

  /**
   * Gets all snapshots for a character, ordered by timestamp descending
   */
  public async getCharacterSnapshots(
    gameModeName: string,
    characterName: string,
    season: number
  ): Promise<
    Array<{
      snapshot_id: number;
      snapshot_timestamp: number;
      level: number;
      experience: number;
      full_response_json: FullCharacterResponse;
    }>
  > {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName.toLowerCase()
    );

    const { rows } = await this.pool.query(
      `SELECT
        snapshot_id,
        snapshot_timestamp,
        level,
        (full_response_json->'character'->>'experience')::bigint as experience,
        full_response_json
       FROM CharacterSnapshots
       WHERE game_mode_id = $1 AND LOWER(api_character_name) = LOWER($2) AND season = $3
       ORDER BY snapshot_timestamp DESC`,
      [gameModeId, characterName, season]
    );

    return rows.map((row) => ({
      ...row,
      snapshot_timestamp: parseInt(row.snapshot_timestamp, 10),
      experience: parseInt(row.experience, 10),
    }));
  }

  /**
   * Gets a specific snapshot by ID
   */
  public async getCharacterSnapshot(
    snapshotId: number
  ): Promise<FullCharacterResponse | null> {
    const { rows } = await this.pool.query(
      `SELECT full_response_json FROM CharacterSnapshots WHERE snapshot_id = $1`,
      [snapshotId]
    );

    return rows[0]?.full_response_json || null;
  }

  private buildFilterCTE(
    filter: CharacterFilter,
    gameModeId: number
  ): { filterCTE: string; params: unknown[] } {
    const baseQuery = "SELECT C.character_db_id FROM Characters C";
    const joins: string[] = [];
    const whereClauses: string[] = ["C.game_mode_id = $1"];
    const params: unknown[] = [gameModeId];
    let paramIndex = 2;

    // Season filter
    if (filter.season !== undefined) {
      whereClauses.push(`C.season = $${paramIndex++}`);
      params.push(filter.season);
    }

    // Level range filter
    if (filter.levelRange) {
      if (filter.levelRange.min !== undefined) {
        whereClauses.push(`C.level >= $${paramIndex++}`);
        params.push(filter.levelRange.min);
      }
      if (filter.levelRange.max !== undefined) {
        whereClauses.push(`C.level <= $${paramIndex++}`);
        params.push(filter.levelRange.max);
      }
    }

    // Class filter
    if (filter.requiredClasses?.length) {
      joins.push(`JOIN Classes CL ON C.class_id = CL.class_id`);
      const placeholders = filter.requiredClasses.map(() => `$${paramIndex++}`);
      whereClauses.push(`CL.name IN (${placeholders.join(", ")})`);
      params.push(...filter.requiredClasses);
    }

    // Item filter
    if (filter.requiredItems?.length) {
      for (const itemName of filter.requiredItems) {
        whereClauses.push(`EXISTS (
          SELECT 1 FROM CharacterItems CI
          JOIN BaseItems BI ON CI.base_item_id = BI.base_item_id
          WHERE CI.character_db_id = C.character_db_id
          AND BI.name = $${paramIndex++}
        )`);
        params.push(itemName);
      }
    }

    // Skill filter
    if (filter.requiredSkills?.length) {
      for (const skill of filter.requiredSkills) {
        whereClauses.push(`EXISTS (
          SELECT 1 FROM CharacterSkills CS
          JOIN SkillsDefinitions SD ON CS.skill_def_id = SD.skill_def_id
          WHERE CS.character_db_id = C.character_db_id
          AND SD.name = $${paramIndex++}
          AND CS.skill_level >= $${paramIndex++}
        )`);
        params.push(skill.name, skill.minLevel);
      }
    }

    // Merc type filter - OR logic (character can only have one merc)
    if (filter.requiredMercTypes?.length) {
      const placeholders = filter.requiredMercTypes
        .map(() => `$${paramIndex++}`)
        .join(", ");
      whereClauses.push(`EXISTS (
        SELECT 1 FROM CharacterMercenaries CM
        WHERE CM.character_db_id = C.character_db_id
        AND CM.description IN (${placeholders})
      )`);
      params.push(...filter.requiredMercTypes);
    }

    // Merc item filter - AND logic (each item must be present)
    if (filter.requiredMercItems?.length) {
      for (const mercItem of filter.requiredMercItems) {
        whereClauses.push(`EXISTS (
          SELECT 1 FROM MercenaryItems MI
          JOIN BaseItems BI ON MI.base_item_id = BI.base_item_id
          WHERE MI.character_db_id = C.character_db_id
          AND BI.name = $${paramIndex++}
        )`);
        params.push(mercItem);
      }
    }

    const uniqueJoins = Array.from(new Set(joins)).join("\n");

    return {
      filterCTE: `
                ${baseQuery}
                ${uniqueJoins}
                ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
            `,
      params,
    };
  }

  public async getFilteredCharacters(
    gameModeName: string,
    filter: CharacterFilter,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{
    total: number;
    characters: FullCharacterResponse[];
    breakdown: Record<string, number>;
  }> {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName.toLowerCase()
    );
    if (gameModeId === null) return { total: 0, characters: [], breakdown: {} };

    const { filterCTE, params } = this.buildFilterCTE(filter, gameModeId);

    // Execute CTE
    const queryParams = [...params, pageSize, (page - 1) * pageSize];
    const combinedQuery = `
            WITH FilteredCharIDs AS MATERIALIZED (${filterCTE}),
            TotalCount AS (
                SELECT COUNT(*) as total FROM FilteredCharIDs
            ),
            PaginatedData AS (
                SELECT C.full_response_json
                FROM Characters C
                WHERE C.character_db_id IN (SELECT character_db_id FROM FilteredCharIDs)
                ORDER BY C.level DESC, C.character_db_id DESC
                LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
            ),
            ClassBreakdown AS (
                SELECT CL.name as className, COUNT(*) as count
                FROM Characters C
                JOIN Classes CL ON C.class_id = CL.class_id
                WHERE C.character_db_id IN (SELECT character_db_id FROM FilteredCharIDs)
                GROUP BY CL.name
            )
            SELECT
                (SELECT total FROM TotalCount) as total,
                (SELECT json_agg(full_response_json) FROM PaginatedData) as characters,
                (SELECT json_object_agg(className, count) FROM ClassBreakdown) as breakdown
        `;

    const result = await this.pool.query(combinedQuery, queryParams);

    if (!result.rows[0]) {
      return { total: 0, characters: [], breakdown: { total: 0 } };
    }

    const { total, characters, breakdown: breakdownObj } = result.rows[0];
    const totalCount = parseInt(total || "0", 10);

    if (totalCount === 0) {
      return { total: 0, characters: [], breakdown: { total: 0 } };
    }

    // Initialize breakdown with all classes
    const breakdown: Record<string, number> = {
      Amazon: 0,
      Sorceress: 0,
      Assassin: 0,
      Barbarian: 0,
      Druid: 0,
      Necromancer: 0,
      Paladin: 0,
      total: totalCount,
    };

    // Merge database breakdown results
    if (breakdownObj) {
      Object.entries(breakdownObj).forEach(([className, count]) => {
        if (Object.prototype.hasOwnProperty.call(breakdown, className)) {
          breakdown[className] = parseInt(String(count), 10);
        }
      });
    }

    return {
      total: totalCount,
      characters: characters || [],
      breakdown,
    };
  }

  public async getRecentCharacters(
    gameModeName: string,
    season: number,
    limit: number = 10
  ): Promise<FullCharacterResponse[]> {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName.toLowerCase()
    );
    if (gameModeId === null) return [];

    const { rows } = await this.pool.query(
      `SELECT full_response_json
       FROM Characters
       WHERE game_mode_id = $1
         AND season = $2
         AND last_updated IS NOT NULL
       ORDER BY last_updated DESC, character_db_id DESC
       LIMIT $3`,
      [gameModeId, season, limit]
    );

    return rows.map((row) => row.full_response_json as FullCharacterResponse);
  }

  public async getCharacterByName(
    gameModeName: string,
    characterName: string,
    season?: number
  ): Promise<FullCharacterResponse | null> {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName.toLowerCase()
    );
    if (gameModeId === null) return null;

    let query: string;
    let params: unknown[];

    if (season !== undefined) {
      query =
        "SELECT full_response_json, season, account_name FROM Characters WHERE game_mode_id = $1 AND LOWER(api_character_name) = LOWER($2) AND season = $3";
      params = [gameModeId, characterName, season];
    } else {
      query =
        "SELECT full_response_json, season, account_name FROM Characters WHERE game_mode_id = $1 AND LOWER(api_character_name) = LOWER($2) ORDER BY season DESC LIMIT 1";
      params = [gameModeId, characterName];
    }

    const { rows } = await this.pool.query(query, params);
    if (!rows[0]) return null;

    const character = rows[0].full_response_json;
    // Add season and account_name from database columns to the response
    if (character && character.character) {
      character.character.season = rows[0].season;
    }
    if (rows[0].account_name) {
      character.accountName = rows[0].account_name;
    }
    return character;
  }

  public async getCharactersByAccount(
    accountName: string,
    season?: number
  ): Promise<FullCharacterResponse[]> {
    let query: string;
    let params: unknown[];

    if (season !== undefined) {
      query =
        "SELECT full_response_json, season FROM Characters WHERE account_name = $1 AND season = $2 ORDER BY level DESC";
      params = [accountName, season];
    } else {
      query =
        "SELECT full_response_json, season FROM Characters WHERE account_name = $1 ORDER BY season DESC, level DESC";
      params = [accountName];
    }

    const { rows } = await this.pool.query(query, params);
    return rows.map((row) => {
      const character = row.full_response_json;
      // Add season from database column to the response
      if (character && character.character) {
        character.character.season = row.season;
      }
      return character;
    });
  }

  public async analyzeItemUsage(
    gameModeName: string,
    filter: CharacterFilter
  ): Promise<ItemUsageStats[]> {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName.toLowerCase()
    );
    if (gameModeId === null) return [];

    const { filterCTE, params } = this.buildFilterCTE(filter, gameModeId);

    const query = `
            WITH FilteredCharIDs AS MATERIALIZED (${filterCTE})
            SELECT
                BI.name AS item,
                CASE
                    WHEN CI.is_runeword = true AND BI.name <> ALL($${params.length + 1}) THEN 'Runeword'
                    WHEN Q.name = 'Unique' AND BI.name <> ALL($${params.length + 2}) THEN 'Unique'
                    WHEN Q.name = 'Set' THEN 'Set'
                    ELSE NULL
                END AS itemType,
                COUNT(DISTINCT CI.character_db_id) AS numOccurrences,
                (SELECT COUNT(*) FROM FilteredCharIDs) AS totalSample
            FROM CharacterItems CI
            JOIN BaseItems BI ON CI.base_item_id = BI.base_item_id
            JOIN Qualities Q ON CI.quality_id = Q.quality_id
            WHERE CI.character_db_id IN (SELECT character_db_id FROM FilteredCharIDs)
            AND CASE
                WHEN CI.is_runeword = true AND BI.name <> ALL($${params.length + 1}) THEN 'Runeword'
                WHEN Q.name = 'Unique' AND BI.name <> ALL($${params.length + 2}) THEN 'Unique'
                WHEN Q.name = 'Set' THEN 'Set'
                ELSE NULL
            END IS NOT NULL
            GROUP BY BI.name, itemType
            ORDER BY numOccurrences DESC
        `;

    const queryParams = [
      ...params,
      IGNORED_UNIQUES_ARRAY,
      IGNORED_UNIQUES_ARRAY,
    ];
    const { rows } = await this.pool.query(query, queryParams);

    return rows.map((row) => ({
      item: row.item,
      itemType: row.itemtype,
      numOccurrences: parseInt(row.numoccurrences, 10),
      totalSample: parseInt(row.totalsample, 10),
      pct:
        row.totalsample > 0
          ? (parseInt(row.numoccurrences, 10) / row.totalsample) * 100
          : 0,
    }));
  }

  public async analyzeSkillUsage(
    gameModeName: string,
    filter: CharacterFilter
  ): Promise<SkillUsageStats[]> {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName.toLowerCase()
    );
    if (gameModeId === null) return [];

    const { filterCTE, params } = this.buildFilterCTE(filter, gameModeId);

    const query = `
            WITH FilteredCharIDs AS MATERIALIZED (${filterCTE})
            SELECT
                SD.name,
                COUNT(DISTINCT CS.character_db_id) AS numOccurrences,
                (SELECT COUNT(*) FROM FilteredCharIDs) AS totalSample
            FROM CharacterSkills CS
            JOIN SkillsDefinitions SD ON CS.skill_def_id = SD.skill_def_id
            WHERE CS.character_db_id IN (SELECT character_db_id FROM FilteredCharIDs)
            AND CS.skill_level >= 20
            GROUP BY SD.name
            ORDER BY numOccurrences DESC
        `;

    const { rows } = await this.pool.query(query, params);

    return rows.map((row) => ({
      name: row.name,
      numOccurrences: parseInt(row.numoccurrences, 10),
      totalSample: parseInt(row.totalsample, 10),
      pct:
        row.totalsample > 0
          ? (parseInt(row.numoccurrences, 10) / row.totalsample) * 100
          : 0,
    }));
  }

  public async analyzeMercTypeUsage(
    gameModeName: string,
    filter: CharacterFilter
  ): Promise<MercTypeStats[]> {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName.toLowerCase()
    );
    if (gameModeId === null) return [];

    const { filterCTE, params } = this.buildFilterCTE(filter, gameModeId);

    // Query uses composite index (character_db_id, description) for index-only scan
    const query = `
            WITH FilteredCharIDs AS MATERIALIZED (${filterCTE})
            SELECT
                CM.description AS mercType,
                COUNT(DISTINCT CM.character_db_id) AS numOccurrences,
                (SELECT COUNT(*) FROM FilteredCharIDs) AS totalSample
            FROM CharacterMercenaries CM
            WHERE CM.character_db_id IN (SELECT character_db_id FROM FilteredCharIDs)
            GROUP BY CM.description
            ORDER BY numOccurrences DESC
        `;

    const { rows } = await this.pool.query(query, params);

    return rows.map((row) => ({
      mercType: row.merctype,
      numOccurrences: parseInt(row.numoccurrences, 10),
      totalSample: parseInt(row.totalsample, 10),
      pct:
        row.totalsample > 0
          ? (parseInt(row.numoccurrences, 10) / row.totalsample) * 100
          : 0,
    }));
  }

  public async analyzeMercItemUsage(
    gameModeName: string,
    filter: CharacterFilter
  ): Promise<ItemUsageStats[]> {
    const gameModeId = await this.getOrInsertLookupId(
      "GameModes",
      "name",
      gameModeName.toLowerCase()
    );
    if (gameModeId === null) return [];

    const { filterCTE, params } = this.buildFilterCTE(filter, gameModeId);

    const query = `
            WITH FilteredCharIDs AS MATERIALIZED (${filterCTE})
            SELECT
                BI.name AS item,
                CASE
                    WHEN MI.is_runeword = true THEN 'Runeword'
                    WHEN Q.name = 'Unique' THEN 'Unique'
                    WHEN Q.name = 'Set' THEN 'Set'
                    ELSE NULL
                END AS itemType,
                COUNT(DISTINCT MI.character_db_id) AS numOccurrences,
                (SELECT COUNT(*) FROM FilteredCharIDs) AS totalSample
            FROM MercenaryItems MI
            JOIN BaseItems BI ON MI.base_item_id = BI.base_item_id
            JOIN Qualities Q ON MI.quality_id = Q.quality_id
            WHERE MI.character_db_id IN (SELECT character_db_id FROM FilteredCharIDs)
            AND CASE
                WHEN MI.is_runeword = true THEN 'Runeword'
                WHEN Q.name = 'Unique' THEN 'Unique'
                WHEN Q.name = 'Set' THEN 'Set'
                ELSE NULL
            END IS NOT NULL
            GROUP BY BI.name, itemType
            ORDER BY numOccurrences DESC
        `;

    const { rows } = await this.pool.query(query, params);

    return rows.map((row) => ({
      item: row.item,
      itemType: row.itemtype as ItemType,
      numOccurrences: parseInt(row.numoccurrences, 10),
      totalSample: parseInt(row.totalsample, 10),
      pct:
        row.totalsample > 0
          ? (parseInt(row.numoccurrences, 10) / row.totalsample) * 100
          : 0,
    }));
  }

  public async getCharacterCounts(): Promise<{
    hardcore: number;
    softcore: number;
  }> {
    const query = `
            SELECT
                gm.name as game_mode,
                COUNT(*) as count
            FROM Characters c
            JOIN GameModes gm ON c.game_mode_id = gm.game_mode_id
            WHERE gm.name IN ('hardcore', 'softcore')
            GROUP BY gm.name
        `;
    const { rows } = await this.pool.query(query);

    const counts = { hardcore: 0, softcore: 0 };
    rows.forEach((row) => {
      const gameMode = row.game_mode as "hardcore" | "softcore";
      counts[gameMode] = parseInt(row.count, 10);
    });

    return counts;
  }

  public async getOnlinePlayersLast(): Promise<{
    history_id: number;
    num_online_players: number;
    timestamp: number;
  } | null> {
    const query = `
            SELECT history_id, num_online_players, timestamp
            FROM OnlinePlayersHistory
            ORDER BY timestamp DESC
            LIMIT 1
        `;
    const { rows } = await this.pool.query(query);

    if (rows.length === 0) {
      return null;
    }

    return {
      history_id: rows[0].history_id,
      num_online_players: rows[0].num_online_players,
      timestamp: parseInt(rows[0].timestamp, 10),
    };
  }

  // Leaderboard methods
  public async getSeasonGameModeCombinations(
    minLevel?: number
  ): Promise<Array<{ season: number; game_mode_id: number }>> {
    const query = minLevel
      ? `SELECT DISTINCT season, game_mode_id FROM Characters WHERE level >= $1`
      : `SELECT DISTINCT season, game_mode_id FROM Characters`;
    const params = minLevel ? [minLevel] : [];
    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  public async getGameModeName(gameModeId: number): Promise<string> {
    const { rows } = await this.pool.query<{ name: string }>(
      `SELECT name FROM GameModes WHERE game_mode_id = $1`,
      [gameModeId]
    );
    return rows[0]?.name.toLowerCase() || "softcore";
  }

  public async getGameModeId(gameModeName: string): Promise<number> {
    const { rows } = await this.pool.query<{ game_mode_id: number }>(
      `SELECT game_mode_id FROM GameModes WHERE name = $1`,
      [gameModeName]
    );
    if (!rows[0]) {
      throw new Error(`GameMode not found: ${gameModeName}`);
    }
    return rows[0].game_mode_id;
  }

  public async getCharactersForLeaderboard(
    season: number,
    gameModeId: number,
    minLevel: number,
    limit?: number,
    offset?: number
  ): Promise<Array<{ api_character_name: string; full_response_json: any }>> {
    let query = `SELECT api_character_name, full_response_json
       FROM Characters
       WHERE season = $1 AND game_mode_id = $2 AND level >= $3`;

    const params: any[] = [season, gameModeId, minLevel];

    if (limit !== undefined) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    if (offset !== undefined) {
      params.push(offset);
      query += ` OFFSET $${params.length}`;
    }

    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  public async getCharacterCountForLeaderboard(
    season: number,
    gameModeId: number,
    minLevel: number
  ): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) as count
       FROM Characters
       WHERE season = $1 AND game_mode_id = $2 AND level >= $3`,
      [season, gameModeId, minLevel]
    );
    return Number(rows[0].count);
  }

  public async deleteLevel99LeaderboardEntries(
    season: number,
    gameMode: string
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM AccountLevel99Leaderboard WHERE season = $1 AND game_mode = $2`,
      [season, gameMode]
    );
  }

  public async getLevel99AccountCounts(
    season: number,
    gameModeId: number,
    limit: number
  ): Promise<Array<{ account_name: string; count: number }>> {
    const { rows } = await this.pool.query(
      `SELECT account_name, COUNT(*) as count
       FROM Characters
       WHERE season = $1 AND game_mode_id = $2 AND level = 99 AND account_name IS NOT NULL
       GROUP BY account_name
       ORDER BY count DESC
       LIMIT $3`,
      [season, gameModeId, limit]
    );
    return rows.map((row) => ({
      account_name: row.account_name,
      count: Number(row.count),
    }));
  }

  public async insertLevel99LeaderboardEntries(
    entries: Array<{
      accountName: string;
      count: number;
      gameMode: string;
      season: number;
    }>,
    lastUpdated: number
  ): Promise<void> {
    if (entries.length === 0) return;

    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const entry of entries) {
      values.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${
          paramIndex + 3
        }, $${paramIndex + 4})`
      );

      params.push(
        entry.accountName,
        entry.count,
        entry.gameMode,
        entry.season,
        lastUpdated
      );

      paramIndex += 5;
    }

    await this.pool.query(
      `INSERT INTO AccountLevel99Leaderboard (
        account_name, count, game_mode, season, last_updated
      )
      VALUES ${values.join(", ")}
      ON CONFLICT (account_name, game_mode, season)
      DO UPDATE SET count = EXCLUDED.count, last_updated = EXCLUDED.last_updated`,
      params
    );
  }

  public async getLevel99Leaderboard(
    gameMode: string,
    season: number
  ): Promise<any[]> {
    const { rows } = await this.pool.query(
      `SELECT *
       FROM AccountLevel99Leaderboard
       WHERE game_mode = $1 AND season = $2
       ORDER BY count DESC
       LIMIT 10`,
      [gameMode, season]
    );
    return rows;
  }

  public async deleteMirroredLeaderboardEntries(
    season: number,
    gameMode: string
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM MirroredItemLeaderboard WHERE season = $1 AND game_mode = $2`,
      [season, gameMode]
    );
  }

  public async insertMirroredLeaderboardEntries(
    entries: Array<{
      itemName: string;
      itemBaseName: string;
      count: number;
      propertiesSignature: string;
      exampleItemJson: any;
      exampleCharacterName: string;
      gameMode: string;
      season: number;
    }>,
    lastUpdated: number
  ): Promise<void> {
    if (entries.length === 0) return;

    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const entry of entries) {
      values.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${
          paramIndex + 3
        }, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${
          paramIndex + 7
        }, $${paramIndex + 8})`
      );

      params.push(
        entry.itemName,
        entry.itemBaseName,
        entry.count,
        entry.propertiesSignature,
        entry.exampleItemJson,
        entry.exampleCharacterName,
        entry.gameMode,
        entry.season,
        lastUpdated
      );

      paramIndex += 9;
    }

    await this.pool.query(
      `INSERT INTO MirroredItemLeaderboard (
        item_name, item_base_name, count, properties_signature,
        example_item_json, example_character_name, game_mode, season, last_updated
      )
      VALUES ${values.join(", ")}
      ON CONFLICT (season, game_mode, properties_signature)
      DO UPDATE SET count = EXCLUDED.count, last_updated = EXCLUDED.last_updated`,
      params
    );
  }

  public async getMirroredLeaderboard(
    gameMode: string,
    season: number
  ): Promise<any[]> {
    const { rows } = await this.pool.query(
      `SELECT *
       FROM MirroredItemLeaderboard
       WHERE game_mode = $1 AND season = $2
       ORDER BY count DESC
       LIMIT 10`,
      [gameMode, season]
    );
    return rows;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
