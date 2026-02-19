import { openDatabaseAsync, SQLiteDatabase } from "expo-sqlite";
import { schemaStatements } from "../../shared/schema";
import { seedDb, SEED_VERSION } from "./seed";

const DB_NAME = "hermes.db";
const SCHEMA_VERSION = 10;

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

async function tableExists(d: SQLiteDatabase, table: string): Promise<boolean> {
  const rows = await d.getAllAsync<{ name: string }>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table' AND name = ?
     LIMIT 1;`,
    [table]
  );
  return rows.length > 0;
}

async function columnExists(d: SQLiteDatabase, table: string, column: string): Promise<boolean> {
  const rows = await d.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return rows.some((r) => r.name === column);
}

async function execIfMissingColumn(
  d: SQLiteDatabase,
  table: string,
  column: string,
  sql: string
): Promise<void> {
  if (!(await columnExists(d, table, column))) {
    await d.execAsync(sql);
  }
}

async function inferLegacySchemaVersion(d: SQLiteDatabase): Promise<number> {
  const hasVocabExternal = await columnExists(d, "vocab_items", "external_id");
  const hasGrammarPointExternal = await columnExists(d, "grammar_points", "external_id");
  const hasGrammarSectionExternal = await columnExists(d, "grammar_sections", "external_id");
  if (hasVocabExternal && hasGrammarPointExternal && hasGrammarSectionExternal) {
    return SCHEMA_VERSION;
  }
  return 9;
}

async function migrateToV10(d: SQLiteDatabase): Promise<void> {
  await execIfMissingColumn(
    d,
    "vocab_items",
    "external_id",
    `ALTER TABLE vocab_items ADD COLUMN external_id TEXT;`
  );
  await execIfMissingColumn(
    d,
    "grammar_points",
    "external_id",
    `ALTER TABLE grammar_points ADD COLUMN external_id TEXT;`
  );
  await execIfMissingColumn(
    d,
    "grammar_sections",
    "external_id",
    `ALTER TABLE grammar_sections ADD COLUMN external_id TEXT;`
  );

  await d.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_items_lang_external
      ON vocab_items (language_id, external_id);
  `);
  await d.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_grammar_points_lang_external
      ON grammar_points (language_id, external_id);
  `);
  await d.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_grammar_sections_lang_external
      ON grammar_sections (language_id, external_id);
  `);
}

async function runSchemaMigrations(d: SQLiteDatabase, fromVersion: number): Promise<void> {
  if (fromVersion < 10) {
    await migrateToV10(d);
  }
}

/**
 * Initialize schema + seed.
 *
 * Rules:
 * - Fresh DB: create schema, run full seed.
 * - Existing DB: apply non-destructive schema migrations.
 * - If seed_version changed: run seed patch (idempotent), set seed_version.
 */
export async function initDb(d: SQLiteDatabase) {
  await d.execAsync(`PRAGMA foreign_keys = ON;`);
  await ensureMetaTable(d);

  let currentSchema = await getSchemaVersion(d);
  const hasLanguagesTable = await tableExists(d, "languages");

  // Fresh DB
  if (!hasLanguagesTable) {
    await d.withTransactionAsync(async () => {
      for (const stmt of schemaStatements) {
        await d.execAsync(stmt);
      }
      await seedDb(d, { fromSeedVersion: 0 });
      await setSchemaVersion(d, SCHEMA_VERSION);
      await setSeedVersion(d, SEED_VERSION);
    });
    return;
  }

  // Legacy DB with missing app_meta schema version; infer to avoid destructive reset.
  if (currentSchema === 0) {
    currentSchema = await inferLegacySchemaVersion(d);
    await setSchemaVersion(d, currentSchema);
  }

  if (currentSchema < SCHEMA_VERSION) {
    await d.withTransactionAsync(async () => {
      await runSchemaMigrations(d, currentSchema);
      await setSchemaVersion(d, SCHEMA_VERSION);
    });
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
