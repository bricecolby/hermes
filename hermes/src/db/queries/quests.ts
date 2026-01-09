import type { SQLiteDatabase } from "expo-sqlite";

export type QuestStatus = "pending" | "completed" | "failed" | "skipped";

export type QuestRow = {
    id: number;
    user_id: number;
    quest_type: string;
    title: string;
    description: string | null;
    status: QuestStatus;
    due_at: string | null;
    completed_at: string | null;
    xp_reward: number;
    metadata_json: string | null;
    created_at: string;
    updated_at: string;
};

export async function listQuestsByUser(
    db: SQLiteDatabase,
    params: { userId: number; status?: QuestStatus }
): Promise<QuestRow[]> {
    if (params.status) {
        return db.getAllAsync<QuestRow>(
            `SELECT id, user_id, quest_type, title, description, status,
                due_at, completed_at, xp_reward, metadata_json, created_at
            FROM quests
            WHERE user_id = ? AND status = ?
            ORDER BY
                CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
                due_at ASC,
                created_at DESC;`,
            [params.userId, params.status]
        );
    } 

    return db.getAllAsync<QuestRow>(
        `SELECT id, user_id, quest_type, title, description, status,
            due_at, completed_at, xp_reward, metadata_json, created_at
        FROM quests
        WHERE user_id = ?
        ORDER BY
            CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
            due_at ASC,
            created_at DESC;`,
        [params.userId]
    );
}

export async function getQuestById(
    db: SQLiteDatabase,
    questId: number
): Promise<QuestRow | null> {
    return db.getFirstAsync<QuestRow>(
        `SELECT id, user_id, quest_type, title, description, status,
            due_at, completed_at, xp_reward, metadata_json, created_at
        FROM quests
        WHERE id = ?
        LIMIT 1;`,
        [questId]
    );
}

export async function insertQuest(
  db: SQLiteDatabase,
  params: {
    userId: number;
    questType: string;
    title: string;
    description?: string | null;
    status?: QuestStatus;
    dueAt?: string | null;
    xpReward?: number;
    metadata?: unknown | null;
  }
): Promise<number> {
  const now = new Date().toISOString();
  const res = await db.runAsync(
    `INSERT INTO quests (
       user_id, quest_type, title, description, status,
       due_at, completed_at, xp_reward, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      params.userId,
      params.questType,
      params.title,
      params.description ?? null,
      params.status ?? "pending",
      params.dueAt ?? null,
      null,
      params.xpReward ?? 0,
      params.metadata ? JSON.stringify(params.metadata) : null,
      now,
    ]
  );
  return Number(res.lastInsertRowId);
}

export async function updateQuestStatus(
  db: SQLiteDatabase,
  params: { questId: number; status: QuestStatus }
): Promise<void> {
  const completedAt = params.status === "completed" ? new Date().toISOString() : null;

  await db.runAsync(
    `UPDATE quests
     SET status = ?,
         completed_at = ?
     WHERE id = ?;`,
    [params.status, completedAt, params.questId]
  );
}

export async function deleteQuest(db: SQLiteDatabase, questId: number): Promise<void> {
  await db.runAsync(`DELETE FROM quests WHERE id = ?;`, [questId]);
}
