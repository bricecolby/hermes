import type { SQLiteDatabase } from "expo-sqlite";
import type { EvaluationResult } from "shared/domain/practice/practiceItem";

function nowISO() {
  return new Date().toISOString();
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
  createdAtIso?: string;
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
    createdAtIso,
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
      createdAtIso ?? nowISO(),
    ]
  );

  return Number(res.lastInsertRowId);
}

export async function insertAttemptConceptResults(params: {
  db: SQLiteDatabase;
  attemptId: number;
  conceptResults: EvaluationResult["conceptResults"];
  createdAtIso?: string;
}) {
  const { db, attemptId, conceptResults } = params;
  const createdAt = params.createdAtIso ?? nowISO();

  if (!conceptResults?.length) return;

  const weight = 1;

  for (const cr of conceptResults) {
    await db.runAsync(
      `INSERT INTO practice_attempt_concepts (
          attempt_id, concept_id, score, is_correct, weight, evidence_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        cr.conceptId,
        cr.score ?? null,
        cr.isCorrect ? 1 : 0,
        weight,
        cr.evidence ? JSON.stringify(cr.evidence) : null,
        createdAt,
      ]
    );
  }
}
