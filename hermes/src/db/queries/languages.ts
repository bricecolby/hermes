import type { SQLiteDatabase } from "expo-sqlite";

export type LanguageRow = {
    id: number;
    name: string;
    code: string;
    created_at: string | null;
    updated_at: string | null;
}

export async function listLanguages(db: SQLiteDatabase): Promise<LanguageRow[]> {
    return db.getAllAsync<LanguageRow>(
        `SELECT *
         FROM languages
         ORDER BY id;`
    );
}

export async function getLanguageById(db: SQLiteDatabase, id: number): Promise<LanguageRow | null> {
    return db.getFirstAsync<LanguageRow>(
        `SELECT *
         FROM languages
         WHERE id = ?
         LIMIT 1;`,
        [id]
    );
}

export async function insertLanguage(db: SQLiteDatabase, name: string, code: string): Promise<number> {
    const now = new Date().toISOString();
    const res = await db.runAsync(
        `INSERT INTO languages (name, code, created_at, updated_at)
         VALUES (?, ?, ?, ?);`,
         [name, code, now, now]
    );
    return Number(res.lastInsertRowId);
}

export async function deleteLanguage(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync(`DELETE FROM languages WHERE id= ?;`, [id]);
}

export type LanguagePackRow = {
  packId: number;

  targetLangId: number;
  targetName: string;
  targetCode: string;

  nativeLangId: number;
  nativeName: string;
  nativeCode: string;

  createdAt: string | null;
  updatedAt: string | null;
};

export async function listLanguagePacks(db: SQLiteDatabase): Promise<LanguagePackRow[]> {
  return db.getAllAsync<LanguagePackRow>(
    `
    SELECT
      lp.id             AS packId,

      lp.target_lang_id AS targetLangId,
      t.name            AS targetName,
      t.code            AS targetCode,

      lp.native_lang_id AS nativeLangId,
      n.name            AS nativeName,
      n.code            AS nativeCode,

      lp.created_at     AS createdAt,
      lp.updated_at     AS updatedAt
    FROM language_packs lp
    JOIN languages t ON t.id = lp.target_lang_id
    JOIN languages n ON n.id = lp.native_lang_id
    ORDER BY n.name, t.name;
    `
  );
}

export async function listLanguagePacksNotOwnedByUsername(
  db: SQLiteDatabase,
  username: string
): Promise<LanguagePackRow[]> {
  // Works whether you keep the old users schema or switch to language_pack_id later.
  // If you switch users schema, update the WHERE NOT EXISTS accordingly (see note below).
  return db.getAllAsync<LanguagePackRow>(
    `
    SELECT
      lp.id             AS packId,
      lp.target_lang_id AS targetLangId,
      t.name            AS targetName,
      t.code            AS targetCode,
      lp.native_lang_id AS nativeLangId,
      n.name            AS nativeName,
      n.code            AS nativeCode,
      lp.created_at     AS createdAt,
      lp.updated_at     AS updatedAt
    FROM language_packs lp
    JOIN languages t ON t.id = lp.target_lang_id
    JOIN languages n ON n.id = lp.native_lang_id
    WHERE lp.id NOT IN (
      SELECT 1
      FROM users u
      WHERE u.username = ? AND u.language_pack_id = lp.id
    )
    ORDER BY n.name, t.name;
    `,
    [username]
  );
}

export async function insertLanguagePack(
  db: SQLiteDatabase,
  targetLangId: number,
  nativeLangId: number
): Promise<number> {
  const now = new Date().toISOString();
  const res = await db.runAsync(
    `
    INSERT INTO language_packs (target_lang_id, native_lang_id, created_at, updated_at)
    VALUES (?, ?, ?, ?);
    `,
    [targetLangId, nativeLangId, now, now]
  );
  return Number(res.lastInsertRowId);
}