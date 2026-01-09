import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import { schemaStatements } from "../../shared/schema";
import { seedDb } from "./seed";

const DB_NAME = "hermes.db";
const SCHEMA_VERSION = 3;

let db: SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLiteDatabase> {
  if (!db) db = await openDatabaseAsync(DB_NAME);
  return db;
}

async function ensureMetaTable(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const rows = await db.getAllAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'schema_version' LIMIT 1;`
  );
  return rows.length ? Number(rows[0].value) : 0;
}

async function setSchemaVersion(db: SQLiteDatabase, version: number) {
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?);`,
    [String(version)]
  );
}

async function resetDb(db: SQLiteDatabase) {
  await db.execAsync(`PRAGMA foreign_keys = OFF;`);

  const tables = await db.getAllAsync<{ name: string }>(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name != 'app_meta';
  `);

  console.log("🧨 Tables to drop:", tables.map(t => t.name));

  for (const t of tables) {
    try {
      console.log("🧨 Dropping:", t.name);
      await db.execAsync(`DROP TABLE IF EXISTS "${t.name}";`);
    } catch (e) {
      console.error("❌ Failed dropping:", t.name);
      throw e;
    }
  }

  await db.execAsync(`PRAGMA foreign_keys = ON;`);
}


export async function initDb() {
  const db = await getDb();

  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await ensureMetaTable(db);

  const currentVersion = await getSchemaVersion(db);

  if (currentVersion !== SCHEMA_VERSION) {
    console.log(`🧨 Resetting DB (v${currentVersion} -> v${SCHEMA_VERSION})`);

    // ✅ reset OUTSIDE transaction so PRAGMA foreign_keys=OFF actually applies
    await resetDb(db);

    // ✅ then build + seed atomically
    await db.withTransactionAsync(async () => {
      for (let i = 0; i < schemaStatements.length; i++) {
        await db.execAsync(schemaStatements[i]);
      }
      await seedDb(db);
      await setSchemaVersion(db, SCHEMA_VERSION);
    });
  }

  console.log("✅ DB initialized (schema version)", SCHEMA_VERSION);
}

