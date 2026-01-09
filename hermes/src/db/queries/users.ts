import type { SQLiteDatabase } from "expo-sqlite";

export type UserRow = {
  id: number;
  username: string;
  language_pack_id: number;

  xp: number;
  level: number;
  current_stamina: number;
  stamina_updated_at: string;

  perk_points: number;
  equip_slots: number;
  streak_count: number;
  last_login: string;

  created_at: string;
  updated_at: string;
};

export async function getUserById(
  db: SQLiteDatabase,
  userId: number
): Promise<UserRow | null> {
  return db.getFirstAsync<UserRow>(
    `SELECT *
     FROM users
     WHERE id = ?
     LIMIT 1;`,
    [userId]
  );
}

export async function getUserByUsername(
  db: SQLiteDatabase,
  username: string
): Promise<UserRow | null> {
  return db.getFirstAsync<UserRow>(
    `SELECT *
     FROM users
     WHERE username = ?
     LIMIT 1;`,
    [username]
  );
}

export async function listUsers(db: SQLiteDatabase): Promise<UserRow[]> {
  return db.getAllAsync<UserRow>(
    `SELECT *
     FROM users
     ORDER BY id;`
  );
}

export async function updateUserLogin(
  db: SQLiteDatabase,
  userId: number
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(`UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?;`, [
    now,
    now,
    userId,
  ]);
}

export async function setUserXpAndLevel(
  db: SQLiteDatabase,
  params: { userId: number; xp: number; level: number }
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE users
     SET xp = ?, level = ?, updated_at = ?
     WHERE id = ?;`,
    [params.xp, params.level, now, params.userId]
  );
}

export async function getUserXpLevel(
  db: SQLiteDatabase,
  userId: number
): Promise<{ xp: number; level: number } | null> {
  return db.getFirstAsync<{ xp: number; level: number }>(
    `SELECT xp, level FROM users WHERE id = ? LIMIT 1;`,
    [userId]
  );
}

export type LanguageProfileRow = {
  userId: number;
  username: string;

  languagePackId: number;

  learningLangId: number;
  learningName: string;
  learningCode: string;

  nativeLangId: number;
  nativeName: string;
  nativeCode: string;

  level: number;
  xp: number;
  updatedAt: string;
};

export async function listLanguageProfilesForUsername(
  db: SQLiteDatabase,
  username: string
): Promise<LanguageProfileRow[]> {
  return db.getAllAsync<LanguageProfileRow>(
    `
    SELECT
      u.id                AS userId,
      u.username          AS username,
      u.language_pack_id  AS languagePackId,

      lp.target_lang_id   AS learningLangId,
      tl.name             AS learningName,
      tl.code             AS learningCode,

      lp.native_lang_id   AS nativeLangId,
      nl.name             AS nativeName,
      nl.code             AS nativeCode,

      u.level             AS level,
      u.xp                AS xp,
      u.updated_at        AS updatedAt
    FROM users u
    JOIN language_packs lp ON lp.id = u.language_pack_id
    JOIN languages tl     ON tl.id = lp.target_lang_id
    JOIN languages nl     ON nl.id = lp.native_lang_id
    WHERE u.username = ?
    ORDER BY u.updated_at DESC;
    `,
    [username]
  );
}

/**
 * Creates a "language profile" for this username by selecting a supported language_pack row.
 * This is what Add Language should call.
 */
export async function createUserProfileForLanguagePack(
  db: SQLiteDatabase,
  username: string,
  languagePackId: number
): Promise<number> {
  const now = new Date().toISOString();

  const res = await db.runAsync(
    `
    INSERT INTO users (
      username, language_pack_id,
      xp, level, current_stamina, stamina_updated_at,
      perk_points, equip_slots, streak_count, last_login,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      username,
      languagePackId,
      0, // xp
      1, // level
      100, // current_stamina
      now, // stamina_updated_at
      0, // perk_points
      1, // equip_slots
      0, // streak_count
      now, // last_login
      now, // created_at
      now, // updated_at
    ]
  );

  return Number(res.lastInsertRowId);
}
