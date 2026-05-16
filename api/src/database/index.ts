import CharacterDB_Postgres from "./postgres/index";
import { EconomyDB } from "./postgres/economy";
import { MetaDB_Postgres } from "./postgres/meta";

// Export database instances
export const characterDB = new CharacterDB_Postgres();
export const economyDB = new EconomyDB();
export const metaDB = new MetaDB_Postgres();

// Export types
export * from "./postgres/index";
export * from "./postgres/economy";
export * from "./postgres/meta";

// Graceful shutdown
export async function closeAllDatabases(): Promise<void> {
  await Promise.all([characterDB.close(), economyDB.close(), metaDB.close()]);
}
