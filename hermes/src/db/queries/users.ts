import type { SQLiteDatabase } from "expo-sqlite";

export type UserRow = {
  id: number;
  username: string;
  learning_lang_id: number;
  native_lang_id: number;

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

export async function insertUser(
  db: SQLiteDatabase,
  params: { username: string; learningLangId: number; nativeLangId: number }
): Promise<number> {
  const now = new Date().toISOString();
  const res = await db.runAsync(
    `INSERT INTO users (
       username, learning_lang_id, native_lang_id,
       xp, level, current_stamina, stamina_updated_at,
       perk_points, equip_slots, streak_count, last_login,
       created_at, updated_at
     ) VALUES (?, ?, ?, 0, 1, 100, ?, 0, 1, 0, ?, ?, ?);`,
    [params.username, params.learningLangId, params.nativeLangId, now, now, now, now]
  );
  return Number(res.lastInsertRowId);
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

export async function setUserActiveLanguage(
  db: SQLiteDatabase,
  params: { userId: number; learningLangId: number }
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE users
     SET learning_lang_id = ?,
         updated_at = ?
     WHERE id = ?;`,
    [params.learningLangId, now, params.userId]
  );
}
