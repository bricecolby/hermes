import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import { schemaStatements } from "../../shared/schema";
import { seedDb } from "./seed";

const DB_NAME = "hermes.db";
const SCHEMA_VERSION = 5;

const SEED_VERSION = 2;

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

async function getMetaInt(db: SQLiteDatabase, key: string): Promise<number> {
  const rows = await db.getAllAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ? LIMIT 1;`,
    [key]
  );
  return rows.length ? Number(rows[0].value) : 0;
}

async function setMetaInt(db: SQLiteDatabase, key: string, value: number) {
  await db.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`,
    [key, String(value)]
  );
}

async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  return getMetaInt(db, "schema_version");
}

async function setSchemaVersion(db: SQLiteDatabase, version: number) {
  await setMetaInt(db, "schema_version", version);
}

async function getSeedVersion(db: SQLiteDatabase): Promise<number> {
  return getMetaInt(db, "seed_version");
}

async function setSeedVersion(db: SQLiteDatabase, version: number) {
  await setMetaInt(db, "seed_version", version);
}

/**
 * Drops all non-meta tables.
 * Must be called OUTSIDE a transaction so PRAGMA foreign_keys can be toggled.
 */
async function resetDb(db: SQLiteDatabase) {
  await db.execAsync(`PRAGMA foreign_keys = OFF;`);

  const tables = await db.getAllAsync<{ name: string }>(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name != 'app_meta';
  `);

  console.log("🧨 Tables to drop:", tables.map((t) => t.name));

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

/**
 * Initialize schema + seed.
 *
 * Rules:
 * - If schema_version changed: DROP ALL tables, recreate schema, run full seed, set schema_version + seed_version.
 * - Else if seed_version changed: run seed patch (idempotent), set seed_version.
 */
export async function initDb(db: SQLiteDatabase) {
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await ensureMetaTable(db);

  const currentSchema = await getSchemaVersion(db);

  // --- Schema reset path ---
  if (currentSchema !== SCHEMA_VERSION) {
    console.log(`🧨 Resetting DB (schema v${currentSchema} -> v${SCHEMA_VERSION})`);

    // reset OUTSIDE transaction so PRAGMA foreign_keys=OFF actually applies
    await resetDb(db);

    // then build + seed atomically
    await db.withTransactionAsync(async () => {
      for (let i = 0; i < schemaStatements.length; i++) {
        await db.execAsync(schemaStatements[i]);
      }

      // Fresh DB: run full seed
      await seedDb(db, { fromSeedVersion: 0 });

      await setSchemaVersion(db, SCHEMA_VERSION);
      await setSeedVersion(db, SEED_VERSION);
    });

    console.log("✅ DB initialized (schema + seed versions)", SCHEMA_VERSION, SEED_VERSION);
    return;
  }

  // --- Seed patch path ---
  const currentSeed = await getSeedVersion(db);

  if (currentSeed < SEED_VERSION) {
    console.log(`🌱 Applying seed patches (seed v${currentSeed} -> v${SEED_VERSION})`);

    await db.withTransactionAsync(async () => {
      // IMPORTANT: seedDb should be written to be idempotent / patch-safe
      await seedDb(db, { fromSeedVersion: currentSeed });
      await setSeedVersion(db, SEED_VERSION);
    });

    console.log("✅ Seed patches applied (seed version)", SEED_VERSION);
    return;
  }

  console.log("✅ DB initialized (schema + seed versions)", SCHEMA_VERSION, currentSeed);
}
