import type { SQLiteDatabase } from "expo-sqlite";
import type { ConceptKind } from "./concepts";
import {
  getFreshVocabConceptRefsForLearn,
  getFreshGrammarConceptRefsForLearn,
} from "./concepts";

export type LearnSettings = {
  vocabDailyTarget: number;
  vocabChunkSize: number;
  grammarDailyTarget: number;
  grammarChunkSize: number;
};

export const DEFAULT_LEARN_SETTINGS: LearnSettings = {
  vocabDailyTarget: 20,
  vocabChunkSize: 5,
  grammarDailyTarget: 5,
  grammarChunkSize: 2,
};

export type LearnQueueRow = {
  conceptId: number;
  kind: ConceptKind;
  modality: string;
  correctOnce: number;
};

function nowIso() {
  return new Date().toISOString();
}

export async function getLearnSettings(
  db: SQLiteDatabase,
  args: { userId: number; languageId: number }
): Promise<LearnSettings> {
  const { userId, languageId } = args;

  await db.runAsync(
    `INSERT INTO user_learn_settings (
      user_id, language_id,
      vocab_daily_target, vocab_chunk_size,
      grammar_daily_target, grammar_chunk_size,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, language_id) DO NOTHING;`,
    [
      userId,
      languageId,
      DEFAULT_LEARN_SETTINGS.vocabDailyTarget,
      DEFAULT_LEARN_SETTINGS.vocabChunkSize,
      DEFAULT_LEARN_SETTINGS.grammarDailyTarget,
      DEFAULT_LEARN_SETTINGS.grammarChunkSize,
      nowIso(),
    ]
  );

  const row = await db.getFirstAsync<{
    vocab_daily_target: number;
    vocab_chunk_size: number;
    grammar_daily_target: number;
    grammar_chunk_size: number;
  }>(
    `SELECT vocab_daily_target, vocab_chunk_size, grammar_daily_target, grammar_chunk_size
     FROM user_learn_settings
     WHERE user_id = ? AND language_id = ?;`,
    [userId, languageId]
  );

  return {
    vocabDailyTarget: Number(row?.vocab_daily_target ?? DEFAULT_LEARN_SETTINGS.vocabDailyTarget),
    vocabChunkSize: Number(row?.vocab_chunk_size ?? DEFAULT_LEARN_SETTINGS.vocabChunkSize),
    grammarDailyTarget: Number(row?.grammar_daily_target ?? DEFAULT_LEARN_SETTINGS.grammarDailyTarget),
    grammarChunkSize: Number(row?.grammar_chunk_size ?? DEFAULT_LEARN_SETTINGS.grammarChunkSize),
  };
}

export async function upsertLearnSettings(
  db: SQLiteDatabase,
  args: { userId: number; languageId: number } & LearnSettings
) {
  const {
    userId,
    languageId,
    vocabDailyTarget,
    vocabChunkSize,
    grammarDailyTarget,
    grammarChunkSize,
  } = args;

  await db.runAsync(
    `INSERT INTO user_learn_settings (
      user_id, language_id,
      vocab_daily_target, vocab_chunk_size,
      grammar_daily_target, grammar_chunk_size,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, language_id) DO UPDATE SET
      vocab_daily_target = excluded.vocab_daily_target,
      vocab_chunk_size = excluded.vocab_chunk_size,
      grammar_daily_target = excluded.grammar_daily_target,
      grammar_chunk_size = excluded.grammar_chunk_size,
      updated_at = excluded.updated_at;`,
    [
      userId,
      languageId,
      vocabDailyTarget,
      vocabChunkSize,
      grammarDailyTarget,
      grammarChunkSize,
      nowIso(),
    ]
  );
}

export async function listLearnQueueRows(
  db: SQLiteDatabase,
  args: { userId: number; languageId: number; kind?: ConceptKind }
): Promise<LearnQueueRow[]> {
  const { userId, languageId, kind } = args;

  const rows = await db.getAllAsync<{
    concept_id: number;
    kind: ConceptKind;
    modality: string;
    correct_once: number;
  }>(
    `SELECT concept_id, kind, modality, correct_once
     FROM user_learn_queue
     WHERE user_id = ? AND language_id = ?
     ${kind ? "AND kind = ?" : ""};`,
    kind ? [userId, languageId, kind] : [userId, languageId]
  );

  return rows.map((r) => ({
    conceptId: r.concept_id,
    kind: r.kind,
    modality: r.modality,
    correctOnce: Number(r.correct_once ?? 0),
  }));
}

export async function clearLearnQueueKind(
  db: SQLiteDatabase,
  args: { userId: number; languageId: number; kind: ConceptKind }
) {
  const { userId, languageId, kind } = args;
  await db.runAsync(
    `DELETE FROM user_learn_queue WHERE user_id = ? AND language_id = ? AND kind = ?;`,
    [userId, languageId, kind]
  );
}

export async function replaceLearnQueueKind(
  db: SQLiteDatabase,
  args: { userId: number; languageId: number; kind: ConceptKind; rows: LearnQueueRow[] }
) {
  const { userId, languageId, kind, rows } = args;
  const now = nowIso();

  await db.runAsync("BEGIN");
  try {
    await clearLearnQueueKind(db, { userId, languageId, kind });

    for (const r of rows) {
      await db.runAsync(
        `INSERT INTO user_learn_queue (
          user_id, language_id, concept_id, kind, modality,
          correct_once, added_at, last_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL);`,
        [userId, languageId, r.conceptId, r.kind, r.modality, r.correctOnce, now]
      );
    }

    await db.runAsync("COMMIT");
  } catch (e) {
    await db.runAsync("ROLLBACK");
    throw e;
  }
}

export async function markLearnQueueCorrect(
  db: SQLiteDatabase,
  args: { userId: number; languageId: number; conceptId: number; modality: string }
) {
  const { userId, languageId, conceptId, modality } = args;
  const now = nowIso();

  await db.runAsync(
    `UPDATE user_learn_queue
     SET correct_once = 1,
         last_attempt_at = ?
     WHERE user_id = ? AND language_id = ? AND concept_id = ? AND modality = ?;`,
    [now, userId, languageId, conceptId, modality]
  );
}

export async function ensureLearnQueueForKind(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    kind: ConceptKind;
    chunkSize: number;
    modelKey: string;
  }
) {
  const { userId, languageId, kind, chunkSize, modelKey } = args;

  const existing = await listLearnQueueRows(db, { userId, languageId, kind });
  const hasRows = existing.length > 0;
  const allCorrect = hasRows && existing.every((r) => r.correctOnce === 1);

  if (chunkSize <= 0) {
    if (hasRows) await clearLearnQueueKind(db, { userId, languageId, kind });
    return;
  }

  if (!hasRows || allCorrect) {
    const fresh =
      kind === "vocab_item"
        ? await getFreshVocabConceptRefsForLearn(db, {
            userId,
            languageId,
            modelKey,
            limit: chunkSize,
          })
        : await getFreshGrammarConceptRefsForLearn(db, {
            userId,
            languageId,
            modelKey,
            limit: chunkSize,
          });

    const rows: LearnQueueRow[] = [];

    for (const r of fresh) {
      if (kind === "vocab_item") {
        rows.push({ conceptId: r.conceptId, kind, modality: "reception", correctOnce: 0 });
        rows.push({ conceptId: r.conceptId, kind, modality: "production", correctOnce: 0 });
      } else {
        rows.push({ conceptId: r.conceptId, kind, modality: "reception", correctOnce: 0 });
      }
    }

    await replaceLearnQueueKind(db, { userId, languageId, kind, rows });
  }
}

export async function getLearnCompletedTodayByKind(
  db: SQLiteDatabase,
  args: { userId: number; languageId: number; kind: ConceptKind; sinceIso: string }
): Promise<number> {
  const { userId, languageId, kind, sinceIso } = args;

  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT pac.concept_id) AS count
     FROM practice_attempt_concepts pac
     JOIN practice_attempts pa ON pa.id = pac.attempt_id
     JOIN practice_sessions ps ON ps.id = pa.session_id
     JOIN concepts c ON c.id = pac.concept_id
     WHERE ps.user_id = ?
       AND ps.language_id = ?
       AND ps.source = 'learn'
       AND pac.is_correct = 1
       AND pac.created_at >= ?
       AND c.kind = ?;`,
    [userId, languageId, sinceIso, kind]
  );

  return Number(row?.count ?? 0);
}

export async function getLearnChunkProgressByKind(
  db: SQLiteDatabase,
  args: { userId: number; languageId: number; kind: ConceptKind }
): Promise<{ totalConcepts: number; completedConcepts: number }> {
  const rows = await listLearnQueueRows(db, args);

  const byConcept = new Map<number, { total: number; correct: number }>();

  for (const r of rows) {
    const entry = byConcept.get(r.conceptId) ?? { total: 0, correct: 0 };
    entry.total += 1;
    entry.correct += r.correctOnce ? 1 : 0;
    byConcept.set(r.conceptId, entry);
  }

  let completedConcepts = 0;
  for (const v of byConcept.values()) {
    if (v.total > 0 && v.correct === v.total) completedConcepts += 1;
  }

  return { totalConcepts: byConcept.size, completedConcepts };
}
