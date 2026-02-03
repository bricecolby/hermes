import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import { schemaStatements } from "../../shared/schema";
import { seedDb, SEED_VERSION } from "./seed";

const DB_NAME = "hermes.db";
const SCHEMA_VERSION = 8;

let db: SQLiteDatabase | null = null;

// Ensures we don't run init/seed multiple times concurrently during startup/navigation/remounts.
let ensurePromise: Promise<SQLiteDatabase> | null = null;

export function invalidateDbHandle() {
  db = null;
  ensurePromise = null;
}

export async function getDb(): Promise<SQLiteDatabase> {
  if (!db) db = await openDatabaseAsync(DB_NAME);
  return db;
}

export async function pingDb(d: SQLiteDatabase) {
  await d.getFirstAsync(`SELECT 1 as ok;`);
}

async function ensureMetaTable(d: SQLiteDatabase) {
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

async function getMetaInt(d: SQLiteDatabase, key: string): Promise<number> {
  const rows = await d.getAllAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ? LIMIT 1;`,
    [key]
  );
  return rows.length ? Number(rows[0].value) : 0;
}

async function setMetaInt(d: SQLiteDatabase, key: string, value: number) {
  await d.runAsync(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?);`,
    [key, String(value)]
  );
}

async function getSchemaVersion(d: SQLiteDatabase): Promise<number> {
  return getMetaInt(d, "schema_version");
}
async function setSchemaVersion(d: SQLiteDatabase, version: number) {
  await setMetaInt(d, "schema_version", version);
}

async function getSeedVersion(d: SQLiteDatabase): Promise<number> {
  return getMetaInt(d, "seed_version");
}
async function setSeedVersion(d: SQLiteDatabase, version: number) {
  await setMetaInt(d, "seed_version", version);
}

/**
 * Drops all non-meta tables.
 * Must be called OUTSIDE a transaction so PRAGMA foreign_keys can be toggled.
 */
async function resetDb(d: SQLiteDatabase) {
  await d.execAsync(`PRAGMA foreign_keys = OFF;`);

  const tables = await d.getAllAsync<{ name: string }>(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name != 'app_meta';
  `);

  for (const t of tables) {
    await d.execAsync(`DROP TABLE IF EXISTS "${t.name}";`);
  }

  await d.execAsync(`PRAGMA foreign_keys = ON;`);
}

/**
 * Initialize schema + seed.
 *
 * Rules:
 * - If schema_version changed: DROP ALL tables, recreate schema, run full seed, set schema_version + seed_version.
 * - Else if seed_version changed: run seed patch (idempotent), set seed_version.
 */
export async function initDb(d: SQLiteDatabase) {
  await d.execAsync(`PRAGMA foreign_keys = ON;`);
  await ensureMetaTable(d);

  const currentSchema = await getSchemaVersion(d);

  if (currentSchema !== SCHEMA_VERSION) {
    // reset OUTSIDE transaction so PRAGMA foreign_keys=OFF applies
    await resetDb(d);

    // then build + seed atomically
    await d.withTransactionAsync(async () => {
      for (const stmt of schemaStatements) {
        await d.execAsync(stmt);
      }

      // Fresh DB: run full seed
      await seedDb(d, { fromSeedVersion: 0 });

      await setSchemaVersion(d, SCHEMA_VERSION);
      await setSeedVersion(d, SEED_VERSION);
    });

    return;
  }

  const currentSeed = await getSeedVersion(d);

  if (currentSeed < SEED_VERSION) {
    await d.withTransactionAsync(async () => {
      await seedDb(d, { fromSeedVersion: currentSeed });
      await setSeedVersion(d, SEED_VERSION);
    });
  }
}

function isNativePrepareNPE(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "");
  return (
    msg.includes("NativeDatabase.prepareAsync") ||
    msg.includes("NullPointerException") ||
    msg.includes("Access to closed resource") ||
    msg.includes("NativeStatement.finalizeAsync")
  );
}

async function ensureDbReadyInner(): Promise<SQLiteDatabase> {
  const d = await getDb();

  // If the handle is bad/closed, ping tends to surface it early.
  await pingDb(d);

  await initDb(d);

  return d;
}

/**
 * Public entrypoint: get an open DB that has schema + seed applied.
 * - Serializes concurrent calls into one in-flight promise.
 * - If we hit the Android prepareAsync/NPE-ish failure mode, we reopen once.
 */
export async function ensureDbReady(): Promise<SQLiteDatabase> {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      return await ensureDbReadyInner();
    } catch (e) {
      // Only retry on the known flaky native failure mode(s)
      if (!isNativePrepareNPE(e)) {
        throw e;
      }

      console.warn("DB ensure failed; reopening DB once.", (e as any)?.message ?? e);

      invalidateDbHandle();

      // Retry once with a fresh handle
      return await ensureDbReadyInner();
    } finally {
      // If the promise rejected, clear so callers can try again after fixing issues.
      // If it resolved, we keep it cached to avoid re-init storms.
      // (So only clear on reject.)
    }
  })();

  try {
    return await ensurePromise;
  } catch (e) {
    ensurePromise = null;
    throw e;
  }
}
