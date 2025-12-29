// src/db/index.ts
import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import { schemaStatements } from "../../shared/schema";

const DB_NAME = "hermes.db";
const SCHEMA_VERSION = 1;

let db: SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLiteDatabase> {
  if (!db) {
    db = await openDatabaseAsync(DB_NAME);
  }
  return db;
}

export async function initDb() {
  const db = await getDb();

  // Enable foreign keys
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    const rows = await db.getAllAsync<{ value: string }>(
      `SELECT value FROM app_meta WHERE key = 'schema_version' LIMIT 1;`
    );

    const currentVersion = rows.length ? Number(rows[0].value) : 0;
    if (currentVersion >= SCHEMA_VERSION) return;

    for (const stmt of schemaStatements) {
      await db.execAsync(stmt);
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?);`,
      [String(SCHEMA_VERSION)]
    );
  });

  console.log("✅ DB initialized (schema version)", SCHEMA_VERSION);
}
