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