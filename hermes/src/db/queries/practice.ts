import type { SQLiteDatabase } from "expo-sqlite";
import type { EvaluationResult } from "shared/domain/practice/practiceItem";
import { applyAttemptToMasteryForConcepts } from "./mastery";

function nowISO() {
  return new Date().toISOString();
}

export async function insertPracticeAttempt(params: {
  db: SQLiteDatabase;
  sessionId: number;
  userId: number;

  modality?: string | null;
  skill?: string | null;
  itemType: string;

  promptText?: string | null;

  questionJson: unknown;
  userResponseJson?: unknown;
  evaluationJson?: unknown;

  responseMs?: number | null;
  createdAtIso?: string;
}) {
  const {
    db,
    sessionId,
    userId,
    modality = null,
    skill = null,
    itemType,
    promptText = null,
    questionJson,
    userResponseJson = null,
    evaluationJson = null,
    responseMs = null,
    createdAtIso,
  } = params;

  const res = await db.runAsync(
    `INSERT INTO practice_attempts (
        session_id, user_id,
        modality, skill, item_type,
        prompt_text, question_json, user_response_json, evaluation_json,
        response_ms, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      userId,
      modality,
      skill,
      itemType,
      promptText,
      JSON.stringify(questionJson),
      userResponseJson ? JSON.stringify(userResponseJson) : null,
      evaluationJson ? JSON.stringify(evaluationJson) : null,
      responseMs,
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
          attempt_id, concept_id,
          score, is_correct, weight, evidence_json,
          created_at
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

/**
 * Atomic logger: attempt + per-concept evidence in ONE transaction.
 * (You can add mastery updates inside this transaction later.)
 */
export async function recordPracticeAttemptTx(params: {
  db: SQLiteDatabase;
  sessionId: number;
  userId: number;

  modality?: string | null;
  skill?: string | null;
  itemType: string;

  promptText?: string | null;

  questionJson: unknown;
  userResponseJson?: unknown;
  evaluation: EvaluationResult;

  responseMs?: number | null;
  createdAtIso?: string;
}) {
  const createdAtIso = params.createdAtIso ?? nowISO();

  await params.db.runAsync("BEGIN");
  try {
    const attemptId = await insertPracticeAttempt({
      db: params.db,
      sessionId: params.sessionId,
      userId: params.userId,
      modality: params.modality ?? null,
      skill: params.skill ?? null,
      itemType: params.itemType,
      promptText: params.promptText ?? null,
      questionJson: params.questionJson,
      userResponseJson: params.userResponseJson,
      evaluationJson: params.evaluation,
      responseMs: params.responseMs ?? null,
      createdAtIso,
    });

    await insertAttemptConceptResults({
      db: params.db,
      attemptId,
      conceptResults: params.evaluation.conceptResults,
      createdAtIso,
    });

    await applyAttemptToMasteryForConcepts(params.db, {
      userId: params.userId,
      attemptCreatedAtIso: createdAtIso,
      modality: params.modality ?? "reception",
      skill: params.skill,
      itemType: params.itemType,
      responseMs: params.responseMs ?? null,
      conceptResults: params.evaluation.conceptResults ?? [],
    });

    await params.db.runAsync("COMMIT");
    return attemptId;
  } catch (e) {
    await params.db.runAsync("ROLLBACK");
    throw e;
  }
}
