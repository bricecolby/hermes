import type { SQLiteDatabase } from "expo-sqlite";
import type { EvaluationResult } from "shared/domain/practice/practiceItem";

function nowISO() {
  return new Date().toISOString();
}

export async function createPracticeSession(params: {
  db: SQLiteDatabase;
  languageId: number;
  userId: number;
  modality?: string | null;
  source?: string | null;
  notes?: string | null;
}) {
  const { db, languageId, userId, modality = null, source = null, notes = null } = params;

  const res = await db.runAsync(
    `INSERT INTO practice_sessions (language_id, user_id, started_at, modality, source, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [languageId, userId, nowISO(), modality, source, notes]
  );

  return Number(res.lastInsertRowId);
}

export async function markPracticeSessionComplete(params: {
  db: SQLiteDatabase;
  sessionId: number;
}) {
  const { db, sessionId } = params;
  await db.runAsync(
    `UPDATE practice_sessions SET completed_at = ? WHERE id = ?`,
    [nowISO(), sessionId]
  );
}

export async function insertPracticeAttempt(params: {
  db: SQLiteDatabase;
  sessionId: number;
  userId: number;
  modality?: string | null;

  type: string;
  promptText?: string | null;

  questionJson: unknown;
  userResponseJson?: unknown;
  evaluationJson?: unknown;
}) {
  const {
    db,
    sessionId,
    userId,
    modality = null,
    type,
    promptText = null,
    questionJson,
    userResponseJson = null,
    evaluationJson = null,
  } = params;

  const res = await db.runAsync(
    `INSERT INTO practice_attempts (
        session_id, user_id, modality, type, prompt_text,
        question_json, user_response_json, evaluation_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      userId,
      modality,
      type,
      promptText,
      JSON.stringify(questionJson),
      userResponseJson ? JSON.stringify(userResponseJson) : null,
      evaluationJson ? JSON.stringify(evaluationJson) : null,
      nowISO(),
    ]
  );

  return Number(res.lastInsertRowId);
}

export async function insertAttemptConceptResults(params: {
  db: SQLiteDatabase;
  attemptId: number;
  conceptResults: EvaluationResult["conceptResults"];
  createdAt?: string;
}) {
  const { db, attemptId, conceptResults } = params;
  const createdAt = params.createdAt ?? nowISO();

  // Weighting MVP: normalize across concept results
  const weight = conceptResults.length ? 1 / conceptResults.length : 1;

  for (const cr of conceptResults) {
    await db.runAsync(
      `INSERT INTO practice_attempt_concepts (
          attempt_id, concept_id, score, is_correct, weight, evidence_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        cr.conceptId,
        cr.score,
        cr.isCorrect ? 1 : 0,
        weight,
        JSON.stringify(cr.evidence ?? null),
        createdAt,
      ]
    );
  }
}
