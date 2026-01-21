// src/db/queries/sessions.ts
import * as SQLite from "expo-sqlite";

export type PracticeSessionInsert = {
  languageId: number;
  userId: number;
  startedAtIso: string;

  modality?: string | null; 
  source?: string | null;   
  notes?: string | null;
};

export type PracticeSessionReportRow = {
  id: number;
  started_at: string;
  completed_at: string;
  modality: string | null;
  source: string | null;

  attempts: number;
  correct: number;
};

export type PracticeReportSummary = {
  sessions: number;
  attempts: number;
  correct: number;
};

export async function startPracticeSession(
  db: SQLite.SQLiteDatabase,
  input: PracticeSessionInsert
): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO practice_sessions
      (language_id, user_id, started_at, completed_at, modality, source, notes)
     VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    [
      input.languageId,
      input.userId,
      input.startedAtIso,
      input.modality ?? null,
      input.source ?? null,
      input.notes ?? null,
    ]
  );

  // expo-sqlite runAsync returns lastInsertRowId
  // @ts-ignore
  return res.lastInsertRowId as number;
}

export async function completePracticeSession(
  db: SQLite.SQLiteDatabase,
  params: { sessionId: number; completedAtIso: string }
) {
  await db.runAsync(
    `UPDATE practice_sessions
     SET completed_at = ?
     WHERE id = ?`,
    [params.completedAtIso, params.sessionId]
  );
}

export async function getPracticeReportSummary(
  db: SQLite.SQLiteDatabase,
  params: {
    userId: number;
    startIso: string;
    endIso: string;
    languageId?: number | null;
  }
): Promise<PracticeReportSummary> {
  const where: string[] = [
    "ps.user_id = ?",
    "ps.completed_at IS NOT NULL",
    "ps.completed_at >= ?",
    "ps.completed_at <= ?",
  ];
  const args: any[] = [params.userId, params.startIso, params.endIso];

  if (params.languageId != null) {
    where.push("ps.language_id = ?");
    args.push(params.languageId);
  }


  const row = await db.getFirstAsync<{
    sessions: number;
    attempts: number;
    correct: number;
  }>(
    `
    SELECT
      COUNT(DISTINCT ps.id) AS sessions,
      COUNT(DISTINCT pa.id) AS attempts,
      COALESCE(SUM(CASE WHEN pac.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct
    FROM practice_sessions ps
    LEFT JOIN practice_attempts pa ON pa.session_id = ps.id
    LEFT JOIN practice_attempt_concepts pac ON pac.attempt_id = pa.id
    WHERE ${where.join(" AND ")}
    `,
    args
  );

  return {
    sessions: Number(row?.sessions ?? 0),
    attempts: Number(row?.attempts ?? 0),
    correct: Number(row?.correct ?? 0),
  };
}

export async function listPracticeSessionsInRange(
  db: SQLite.SQLiteDatabase,
  params: {
    userId: number;
    startIso: string;
    endIso: string;
    languageId?: number | null;
  }
): Promise<PracticeSessionReportRow[]> {
  const where: string[] = [
    "ps.user_id = ?",
    "ps.completed_at IS NOT NULL",
    "ps.completed_at >= ?",
    "ps.completed_at <= ?",
  ];
  const args: any[] = [params.userId, params.startIso, params.endIso];

  if (params.languageId != null) {
    where.push("ps.language_id = ?");
    args.push(params.languageId);
  }

  return await db.getAllAsync<PracticeSessionReportRow>(
    `
    SELECT
      ps.id,
      ps.started_at,
      ps.completed_at,
      ps.modality,
      ps.source,
      COUNT(DISTINCT pa.id) AS attempts,
      COALESCE(SUM(CASE WHEN pac.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct
    FROM practice_sessions ps
    LEFT JOIN practice_attempts pa ON pa.session_id = ps.id
    LEFT JOIN practice_attempt_concepts pac ON pac.attempt_id = pa.id
    WHERE ${where.join(" AND ")}
    GROUP BY ps.id
    ORDER BY ps.completed_at DESC
    `,
    args
  );
}
