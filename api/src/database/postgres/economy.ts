import { Pool, PoolConfig } from "pg";
import { format } from "date-fns";
import * as dotenv from "dotenv";

dotenv.config();

export interface ListingPayload {
  bumpedTs: number;
  itemName: string;
  username: string;
  priceStr: string;
  numericalPrice: number | null;
  quantity: number;
}

export interface ListingRecord {
  id?: number;
  bumpedTs: number;
  itemName: string;
  username: string;
  priceStr: string;
  numericalPrice: number | null;
  quantity: number;
  dataDate: string;
  ingestionDate: string;
  season: number;
}

export interface AddListingsResult {
  success: boolean;
  insertedCount: number;
  skippedCount: number;
  errors: Array<{ listingData?: Partial<ListingPayload>; error: string }>;
}

export class EconomyDB {
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
      console.error("Failed to initialize economy schema:", error);
      throw error;
    });
  }

  private async initSchema(): Promise<void> {
    const createListingsTableQuery = `
            CREATE TABLE IF NOT EXISTS listings (
                id SERIAL PRIMARY KEY,
                bumped_ts BIGINT NOT NULL,
                item_name TEXT NOT NULL,
                username TEXT NOT NULL,
                price_str TEXT,
                numerical_price REAL,
                quantity INTEGER NOT NULL,
                data_date TEXT NOT NULL,
                ingestion_date TEXT NOT NULL,
                season INTEGER NOT NULL
            );
        `;

    const createSnapshotsTableQuery = `
            CREATE TABLE IF NOT EXISTS price_snapshots (
                id SERIAL PRIMARY KEY,
                item_name TEXT NOT NULL,
                ingestion_date TEXT NOT NULL,
                calculated_price REAL NOT NULL,
                num_listings INTEGER NOT NULL,
                season INTEGER NOT NULL,
                UNIQUE(item_name, ingestion_date, season)
            );
        `;

    const indexQueries = `
            CREATE INDEX IF NOT EXISTS idx_listings_item_date ON listings (item_name, data_date);
            CREATE INDEX IF NOT EXISTS idx_listings_item_ingestion_date ON listings (item_name, ingestion_date);
            CREATE INDEX IF NOT EXISTS idx_listings_item_user_ts_date ON listings (item_name, username, bumped_ts, data_date);
            CREATE INDEX IF NOT EXISTS idx_listings_ingestion_date_bumped_ts ON listings (ingestion_date, bumped_ts);
            CREATE INDEX IF NOT EXISTS idx_listings_season ON listings (season);
            CREATE INDEX IF NOT EXISTS idx_listings_item_season ON listings (item_name, season);
            CREATE INDEX IF NOT EXISTS idx_snapshots_item_date ON price_snapshots (item_name, ingestion_date);
            CREATE INDEX IF NOT EXISTS idx_snapshots_item_season ON price_snapshots (item_name, season);
        `;

    await this.pool.query(createListingsTableQuery);
    await this.pool.query(createSnapshotsTableQuery);
    await this.pool.query(indexQueries);
  }

  public async addListings(
    listingsData: ListingPayload[],
    season: number
  ): Promise<AddListingsResult> {
    if (!Array.isArray(listingsData)) {
      console.error(
        "EconomyDB.addListings: Input 'listingsData' must be an array."
      );
      return {
        success: false,
        insertedCount: 0,
        skippedCount: 0,
        errors: [{ error: "Input listingsData must be an array." }],
      };
    }
    if (listingsData.length === 0) {
      return {
        success: true,
        insertedCount: 0,
        skippedCount: 0,
        errors: [],
      };
    }

    let insertedCount = 0;
    let skippedCount = 0;
    const localErrors: Array<{
      listingData: Partial<ListingPayload>;
      error: string;
    }> = [];
    const currentIngestionDate = format(new Date(), "yyyy-MM-dd");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      for (const listingInput of listingsData) {
        const numericalPrice =
          typeof listingInput.numericalPrice === "number" &&
          !isNaN(listingInput.numericalPrice)
            ? listingInput.numericalPrice
            : null;

        if (
          typeof listingInput.bumpedTs !== "number" ||
          isNaN(listingInput.bumpedTs)
        ) {
          localErrors.push({
            listingData: listingInput,
            error: `Invalid bumpedTs: ${listingInput.bumpedTs}. Expected a number.`,
          });
          continue;
        }
        const derivedDataDate = format(
          new Date(listingInput.bumpedTs),
          "yyyy-MM-dd"
        );

        if (
          typeof listingInput.itemName !== "string" ||
          listingInput.itemName.trim() === ""
        ) {
          localErrors.push({
            listingData: listingInput,
            error: "Item name cannot be empty.",
          });
          continue;
        }
        if (
          typeof listingInput.username !== "string" ||
          listingInput.username.trim() === ""
        ) {
          localErrors.push({
            listingData: listingInput,
            error: "Username cannot be empty.",
          });
          continue;
        }

        try {
          // Check if listing already exists
          const checkQuery = `
                        SELECT 1 FROM listings
                        WHERE item_name = $1
                          AND username = $2
                          AND bumped_ts = $3
                          AND data_date = $4
                          AND season = $5
                        LIMIT 1
                    `;
          const exists = await client.query(checkQuery, [
            listingInput.itemName,
            listingInput.username,
            listingInput.bumpedTs,
            derivedDataDate,
            season,
          ]);

          if (exists.rows.length > 0) {
            skippedCount++;
            continue;
          }

          // Insert the listing
          const insertQuery = `
                        INSERT INTO listings (
                            bumped_ts, item_name, username, price_str, numerical_price,
                            quantity, data_date, ingestion_date, season
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `;
          const result = await client.query(insertQuery, [
            listingInput.bumpedTs,
            listingInput.itemName,
            listingInput.username,
            listingInput.priceStr,
            numericalPrice,
            listingInput.quantity,
            derivedDataDate,
            currentIngestionDate,
            season,
          ]);

          if (result.rowCount && result.rowCount > 0) {
            insertedCount++;
          }
        } catch (error: unknown) {
          localErrors.push({
            listingData: listingInput,
            error: `DB insert/check error: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }

      await client.query("COMMIT");
      return {
        success: true,
        insertedCount,
        skippedCount,
        errors: localErrors,
      };
    } catch (transactionError: unknown) {
      await client.query("ROLLBACK");
      console.error(
        "EconomyDB.addListings: Transaction failed catastrophically.",
        transactionError
      );
      return {
        success: false,
        insertedCount: 0,
        skippedCount: 0,
        errors: [
          ...localErrors,
          {
            error: `Transaction failed: ${transactionError instanceof Error ? transactionError.message : String(transactionError)}`,
          },
        ],
      };
    } finally {
      client.release();
    }
  }

  public async getListingsByDataDate(
    itemName: string,
    dataDate: string,
    season?: number
  ): Promise<ListingRecord[]> {
    if (!itemName || typeof itemName !== "string" || itemName.trim() === "") {
      return [];
    }

    let query: string;
    let params: unknown[];

    if (season !== undefined) {
      query = `
                SELECT id, bumped_ts, item_name, username, price_str, numerical_price,
                       quantity, data_date, ingestion_date, season
                FROM listings
                WHERE item_name = $1 AND data_date = $2 AND season = $3
                ORDER BY bumped_ts DESC
            `;
      params = [itemName, dataDate, season];
    } else {
      query = `
                SELECT id, bumped_ts, item_name, username, price_str, numerical_price,
                       quantity, data_date, ingestion_date, season
                FROM listings
                WHERE item_name = $1 AND data_date = $2
                ORDER BY bumped_ts DESC
            `;
      params = [itemName, dataDate];
    }

    const { rows } = await this.pool.query(query, params);
    return rows.map((row) => ({
      id: row.id,
      bumpedTs: parseInt(row.bumped_ts, 10),
      itemName: row.item_name,
      username: row.username,
      priceStr: row.price_str,
      numericalPrice: row.numerical_price,
      quantity: row.quantity,
      dataDate: row.data_date,
      ingestionDate: row.ingestion_date,
      season: row.season,
    }));
  }

  public async getListingsByIngestionDate(
    itemName: string,
    ingestionDate: string,
    season?: number
  ): Promise<ListingRecord[]> {
    if (!itemName || typeof itemName !== "string" || itemName.trim() === "") {
      return [];
    }

    let query: string;
    let params: unknown[];

    if (season !== undefined) {
      query = `
                SELECT id, bumped_ts, item_name, username, price_str, numerical_price,
                       quantity, data_date, ingestion_date, season
                FROM listings
                WHERE item_name = $1 AND ingestion_date = $2 AND season = $3
                ORDER BY bumped_ts DESC
            `;
      params = [itemName, ingestionDate, season];
    } else {
      query = `
                SELECT id, bumped_ts, item_name, username, price_str, numerical_price,
                       quantity, data_date, ingestion_date, season
                FROM listings
                WHERE item_name = $1 AND ingestion_date = $2
                ORDER BY bumped_ts DESC
            `;
      params = [itemName, ingestionDate];
    }

    const { rows } = await this.pool.query(query, params);
    return rows.map((row) => ({
      id: row.id,
      bumpedTs: parseInt(row.bumped_ts, 10),
      itemName: row.item_name,
      username: row.username,
      priceStr: row.price_str,
      numericalPrice: row.numerical_price,
      quantity: row.quantity,
      dataDate: row.data_date,
      ingestionDate: row.ingestion_date,
      season: row.season,
    }));
  }

  public async getAllListingsForItem(
    itemName: string,
    season?: number,
    limit: number = 1000
  ): Promise<ListingRecord[]> {
    if (!itemName || typeof itemName !== "string" || itemName.trim() === "") {
      return [];
    }

    let query: string;
    let params: unknown[];

    if (season !== undefined) {
      query = `
                SELECT id, bumped_ts, item_name, username, price_str, numerical_price,
                       quantity, data_date, ingestion_date, season
                FROM listings
                WHERE item_name = $1 AND season = $2
                ORDER BY bumped_ts DESC
                LIMIT $3
            `;
      params = [itemName, season, limit];
    } else {
      query = `
                SELECT id, bumped_ts, item_name, username, price_str, numerical_price,
                       quantity, data_date, ingestion_date, season
                FROM listings
                WHERE item_name = $1
                ORDER BY bumped_ts DESC
                LIMIT $2
            `;
      params = [itemName, limit];
    }

    const { rows } = await this.pool.query(query, params);
    return rows.map((row) => ({
      id: row.id,
      bumpedTs: parseInt(row.bumped_ts, 10),
      itemName: row.item_name,
      username: row.username,
      priceStr: row.price_str,
      numericalPrice: row.numerical_price,
      quantity: row.quantity,
      dataDate: row.data_date,
      ingestionDate: row.ingestion_date,
      season: row.season,
    }));
  }

  public async getUniqueItemNames(season?: number): Promise<string[]> {
    let query: string;
    let params: unknown[] = [];

    if (season !== undefined) {
      query = `
                SELECT DISTINCT item_name
                FROM listings
                WHERE season = $1
                ORDER BY item_name
            `;
      params = [season];
    } else {
      query = `
                SELECT DISTINCT item_name
                FROM listings
                ORDER BY item_name
            `;
    }

    const { rows } = await this.pool.query(query, params);
    return rows.map((row) => row.item_name);
  }

  public async getTotalListingsCount(season?: number): Promise<number> {
    let query: string;
    let params: unknown[] = [];

    if (season !== undefined) {
      query = `SELECT COUNT(*) as count FROM listings WHERE season = $1`;
      params = [season];
    } else {
      query = `SELECT COUNT(*) as count FROM listings`;
    }

    const { rows } = await this.pool.query(query, params);
    return parseInt(rows[0].count, 10);
  }

  public async getItemsSummary(season?: number, daysOfHistory: number = 7): Promise<any[]> {
    let query: string;
    let params: unknown[] = [];

    // Read pre-calculated price snapshots (no calculations!)
    if (season !== undefined) {
      query = `
        WITH recent_snapshots AS (
          SELECT
            item_name,
            ingestion_date as date,
            calculated_price as price,
            num_listings
          FROM price_snapshots
          WHERE season = $1
            AND ingestion_date >= (CURRENT_DATE - INTERVAL '${daysOfHistory} days')::text
        ),
        items_with_recent_data AS (
          SELECT DISTINCT item_name
          FROM recent_snapshots
        ),
        fallback_snapshots AS (
          SELECT DISTINCT ON (item_name)
            item_name,
            ingestion_date as date,
            calculated_price as price,
            num_listings
          FROM price_snapshots
          WHERE season = $1
            AND item_name NOT IN (SELECT item_name FROM items_with_recent_data)
          ORDER BY item_name, ingestion_date DESC
        ),
        combined_snapshots AS (
          SELECT * FROM recent_snapshots
          UNION ALL
          SELECT * FROM fallback_snapshots
        )
        SELECT
          item_name,
          json_agg(
            json_build_object(
              'price', price,
              'numListings', num_listings,
              'date', date
            ) ORDER BY date ASC
          ) as price_data
        FROM combined_snapshots
        GROUP BY item_name
        ORDER BY item_name
      `;
      params = [season];
    } else {
      query = `
        WITH recent_snapshots AS (
          SELECT
            item_name,
            ingestion_date as date,
            calculated_price as price,
            num_listings
          FROM price_snapshots
          WHERE ingestion_date >= (CURRENT_DATE - INTERVAL '${daysOfHistory} days')::text
        ),
        items_with_recent_data AS (
          SELECT DISTINCT item_name
          FROM recent_snapshots
        ),
        fallback_snapshots AS (
          SELECT DISTINCT ON (item_name)
            item_name,
            ingestion_date as date,
            calculated_price as price,
            num_listings
          FROM price_snapshots
          WHERE item_name NOT IN (SELECT item_name FROM items_with_recent_data)
          ORDER BY item_name, ingestion_date DESC
        ),
        combined_snapshots AS (
          SELECT * FROM recent_snapshots
          UNION ALL
          SELECT * FROM fallback_snapshots
        )
        SELECT
          item_name,
          json_agg(
            json_build_object(
              'price', price,
              'numListings', num_listings,
              'date', date
            ) ORDER BY date ASC
          ) as price_data
        FROM combined_snapshots
        GROUP BY item_name
        ORDER BY item_name
      `;
    }

    const { rows } = await this.pool.query(query, params);
    return rows.map((row) => ({
      item_name: row.item_name,
      price_data: row.price_data || [],
    }));
  }

  public async getItemDetail(itemName: string, season?: number, limit: number = 100): Promise<any> {
    let query: string;
    let params: unknown[];

    // Get raw listings for the table
    if (season !== undefined) {
      query = `
        SELECT id, bumped_ts, item_name, username, price_str, numerical_price,
               quantity, data_date, ingestion_date, season
        FROM listings
        WHERE item_name = $1 AND season = $2
        ORDER BY bumped_ts DESC
        LIMIT $3
      `;
      params = [itemName, season, limit];
    } else {
      query = `
        SELECT id, bumped_ts, item_name, username, price_str, numerical_price,
               quantity, data_date, ingestion_date, season
        FROM listings
        WHERE item_name = $1
        ORDER BY bumped_ts DESC
        LIMIT $2
      `;
      params = [itemName, limit];
    }

    const { rows: allListings } = await this.pool.query(query, params);

    // Get pre-calculated price snapshots for the chart
    let chartQuery: string;
    let chartParams: unknown[];

    if (season !== undefined) {
      chartQuery = `
        SELECT
          ingestion_date as "trueDate",
          calculated_price as price,
          num_listings as "numListings"
        FROM price_snapshots
        WHERE item_name = $1 AND season = $2
        ORDER BY ingestion_date ASC
      `;
      chartParams = [itemName, season];
    } else {
      chartQuery = `
        SELECT
          ingestion_date as "trueDate",
          calculated_price as price,
          num_listings as "numListings"
        FROM price_snapshots
        WHERE item_name = $1
        ORDER BY ingestion_date ASC
      `;
      chartParams = [itemName];
    }

    const { rows: dataByIngestionDate } = await this.pool.query(chartQuery, chartParams);

    return {
      allListings: allListings.map((row) => ({
        id: row.id,
        bumpedTs: parseInt(row.bumped_ts, 10),
        itemName: row.item_name,
        username: row.username,
        priceStr: row.price_str,
        numericalPrice: row.numerical_price,
        quantity: row.quantity,
        dataDate: row.data_date,
        ingestionDate: row.ingestion_date,
        season: row.season,
      })),
      dataByIngestionDate: dataByIngestionDate.map((row) => ({
        trueDate: row.trueDate,
        price: parseFloat(row.price),
        numListings: parseInt(row.numListings, 10),
      })),
    };
  }

  public async savePriceSnapshot(
    itemName: string,
    calculatedPrice: number,
    numListings: number,
    season: number
  ): Promise<void> {
    const ingestionDate = format(new Date(), "yyyy-MM-dd");

    const query = `
      INSERT INTO price_snapshots (item_name, ingestion_date, calculated_price, num_listings, season)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (item_name, ingestion_date, season)
      DO UPDATE SET
        calculated_price = EXCLUDED.calculated_price,
        num_listings = EXCLUDED.num_listings
    `;

    await this.pool.query(query, [
      itemName,
      ingestionDate,
      calculatedPrice,
      numListings,
      season,
    ]);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

