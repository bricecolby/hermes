import type { SQLiteDatabase } from "expo-sqlite";

export type VocabItemRow = {
  id: number;
  language_id: number;
  base_form: string;
  part_of_speech: string;
  frequency_rank: number | null;
  frequency_band: number | null;
  usage_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VocabSenseRow = {
  id: number;
  vocab_item_id: number;
  sense_index: number;
  definition: string | null;
  translation: string | null;
  usage_notes: string | null;
  grammar_hint: string | null;
  created_at: string;
  updated_at: string;
};

export type VocabFormRow = {
  id: number;
  vocab_item_id: number;
  surface_form: string;
  tense: string | null;
  mood: string | null;
  person: number | null;
  number: string | null;
  gender: string | null;
  case_value?: string | null;
  aspect: string | null;
  degree: string | null;
  is_irregular: number | null;
  created_at: string;
  updated_at: string;
};

export type VocabExampleRow = {
  id: number;
  vocab_sense_id: number;
  vocab_form_id: number | null;
  example_text: string;
  translation_text: string | null;
  media_id: number | null;
  created_at: string;
  updated_at: string;
};

export type VocabTagRow = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

export type VocabRow = {
  id: number;
  base_form: string;
  translation: string;
}

export async function getRandomVocab(
  db: SQLiteDatabase,
  languageId: number,
  limit = 20
): Promise<VocabRow[]> {
  return db.getAllAsync<VocabRow>(
    `
    SELECT
      vi.id AS id,
      vi.base_form AS base_form,
      vs.translation AS translation
    FROM vocab_items vi
    JOIN vocab_senses vs
      ON vs.vocab_item_id = vi.id
     AND vs.sense_index = 1
    WHERE vi.language_id = ?
      AND vs.translation IS NOT NULL
    ORDER BY RANDOM()
    LIMIT ?;
    `,
    [languageId, limit]
  );
}

export async function searchVocabItems(
  db: SQLiteDatabase,
  params: { languageId: number; q: string; limit?: number }
): Promise<VocabItemRow[]> {
  const like = `%${params.q.trim()}%`;
  const limit = params.limit ?? 50;

  return db.getAllAsync<VocabItemRow>(
    `SELECT *
     FROM vocab_items
     WHERE language_id = ?
       AND (base_form LIKE ? OR part_of_speech LIKE ? OR usage_notes LIKE ?)
     ORDER BY base_form
     LIMIT ?;`,
    [params.languageId, like, like, like, limit]
  );
}

export async function listVocabItemsByLanguage(
  db: SQLiteDatabase,
  languageId: number
): Promise<VocabItemRow[]> {
  return db.getAllAsync<VocabItemRow>(
    `SELECT *
     FROM vocab_items
     WHERE language_id = ?
     ORDER BY base_form;`,
    [languageId]
  );
}

export async function getVocabItem(
  db: SQLiteDatabase,
  vocabItemId: number
): Promise<VocabItemRow | null> {
  const id = Number.isFinite(vocabItemId) ? vocabItemId : null;
  if (id === null) return null;

  const rows = await db.getAllAsync<VocabItemRow>(
    `SELECT *
     FROM vocab_items
     WHERE id = ?
     LIMIT 1;`,
    [id]
  );

  return rows[0] ?? null;
}


export async function listSensesForItem(
  db: SQLiteDatabase,
  vocabItemId: number
): Promise<VocabSenseRow[]> {
  return db.getAllAsync<VocabSenseRow>(
    `SELECT *
     FROM vocab_senses
     WHERE vocab_item_id = ?
     ORDER BY sense_index ASC, id ASC;`,
    [vocabItemId]
  );
}

export async function listFormsForItem(
  db: SQLiteDatabase,
  vocabItemId: number
): Promise<VocabFormRow[]> {
  return db.getAllAsync<VocabFormRow>(
    `SELECT
       id,
       vocab_item_id,
       surface_form,
       tense,
       mood,
       person,
       number,
       gender,
       "case" as case_value,
       aspect,
       degree,
       is_irregular,
       created_at,
       updated_at
     FROM vocab_forms
     WHERE vocab_item_id = ?
     ORDER BY surface_form ASC, id ASC;`,
    [vocabItemId]
  );
}

export async function listExamplesForSense(
  db: SQLiteDatabase,
  vocabSenseId: number
): Promise<VocabExampleRow[]> {
  return db.getAllAsync<VocabExampleRow>(
    `SELECT *
     FROM vocab_examples
     WHERE vocab_sense_id = ?
     ORDER BY id ASC;`,
    [vocabSenseId]
  );
}

export async function listTags(db: SQLiteDatabase): Promise<VocabTagRow[]> {
  return db.getAllAsync<VocabTagRow>(
    `SELECT *
     FROM vocab_tags
     ORDER BY name;`
  );
}

export async function listTagsForItem(
  db: SQLiteDatabase,
  vocabItemId: number
): Promise<VocabTagRow[]> {
  return db.getAllAsync<VocabTagRow>(
    `SELECT t.*
     FROM vocab_tags t
     JOIN vocab_item_tags vit ON vit.vocab_tag_id = t.id
     WHERE vit.vocab_item_id = ?
     ORDER BY t.name;`,
    [vocabItemId]
  );
}


type UpsertVocabPayload = {
  languageId: number;
  baseForm: string;
  partOfSpeech: string;
  usageNotes?: string | null;

  translation?: string | null;
  definition?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

export async function createVocabItem(
  db: SQLiteDatabase,
  payload: UpsertVocabPayload
): Promise<number> {
  const ts = nowIso();

  await db.execAsync("BEGIN;");
  try {
    await db.runAsync(
      `
      INSERT INTO vocab_items (
        language_id, base_form, part_of_speech,
        frequency_rank, frequency_band,
        usage_notes, created_at, updated_at
      )
      VALUES (?, ?, ?, NULL, NULL, ?, ?, ?);
      `,
      [
        payload.languageId,
        payload.baseForm.trim(),
        payload.partOfSpeech.trim(),
        payload.usageNotes ?? null,
        ts,
        ts,
      ]
    );

    const row = await db.getFirstAsync<{ id: number }>(
      `SELECT last_insert_rowid() as id;`
    );
    const vocabItemId = row?.id ?? 0;
    if (!vocabItemId) throw new Error("Failed to create vocab item (no id).");

    const hasSense =
      (payload.translation?.trim() ?? "") !== "" ||
      (payload.definition?.trim() ?? "") !== "";

    if (hasSense) {
      await db.runAsync(
        `
        INSERT INTO vocab_senses (
          vocab_item_id, sense_index,
          definition, translation, usage_notes, grammar_hint,
          created_at, updated_at
        )
        VALUES (?, 1, ?, ?, NULL, NULL, ?, ?);
        `,
        [
          vocabItemId,
          payload.definition?.trim() ?? null,
          payload.translation?.trim() ?? null,
          ts,
          ts,
        ]
      );
    }

    await db.execAsync("COMMIT;");
    return vocabItemId;
  } catch (e) {
    await db.execAsync("ROLLBACK;");
    throw e;
  }
}

export async function updateVocabItem(
  db: SQLiteDatabase,
  vocabItemId: number,
  payload: Omit<UpsertVocabPayload, "languageId">
): Promise<void> {
  const ts = nowIso();

  await db.execAsync("BEGIN;");
  try {
    await db.runAsync(
      `
      UPDATE vocab_items
      SET base_form = ?,
          part_of_speech = ?,
          usage_notes = ?,
          updated_at = ?
      WHERE id = ?;
      `,
      [
        payload.baseForm.trim(),
        payload.partOfSpeech.trim(),
        payload.usageNotes ?? null,
        ts,
        vocabItemId,
      ]
    );

    const existing = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM vocab_senses WHERE vocab_item_id = ? AND sense_index = 1 LIMIT 1;`,
      [vocabItemId]
    );

    const translation = payload.translation?.trim() ?? null;
    const definition = payload.definition?.trim() ?? null;

    if (existing?.id) {
      await db.runAsync(
        `
        UPDATE vocab_senses
        SET definition = ?,
            translation = ?,
            updated_at = ?
        WHERE id = ?;
        `,
        [definition, translation, ts, existing.id]
      );
    } else if (translation || definition) {
      await db.runAsync(
        `
        INSERT INTO vocab_senses (
          vocab_item_id, sense_index, definition, translation,
          usage_notes, grammar_hint, created_at, updated_at
        )
        VALUES (?, 1, ?, ?, NULL, NULL, ?, ?);
        `,
        [vocabItemId, definition, translation, ts, ts]
      );
    }

    await db.execAsync("COMMIT;");
  } catch (e) {
    await db.execAsync("ROLLBACK;");
    throw e;
  }
}

export async function deleteVocabItem(db: SQLiteDatabase, vocabItemId: number) {
  await db.runAsync(`DELETE FROM vocab_items WHERE id = ?;`, [vocabItemId]);
}

function normalizeTagName(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

async function upsertVocabTagId(db: SQLiteDatabase, name: string): Promise<number> {
  const n = normalizeTagName(name);
  if (!n) throw new Error("Tag name is empty.");
  
  await db.runAsync(
    `INSERT OR IGNORE INTO vocab_tags (name, description, created_at)
     VALUES (?, NULL, datetime('now'));`,
    [n]
  );

  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM vocab_tags WHERE name = ? LIMIT 1;`,
    [n]
  );

  const id = row?.id ?? 0;
  if (!id) throw new Error(`Failed to upsert vocab tag: ${n}`);
  return id;
}


export async function replaceTagsForItem(
  db: SQLiteDatabase,
  vocabItemId: number,
  tagNames: string[]
): Promise<void> {
  const cleaned = Array.from(
    new Set(tagNames.map(normalizeTagName).filter(Boolean))
  );

  await db.execAsync("BEGIN;");
  try {
    await db.runAsync(
      `DELETE FROM vocab_item_tags WHERE vocab_item_id = ?;`,
      [vocabItemId]
    );

    for (const name of cleaned) {
      const tagId = await upsertVocabTagId(db, name);
      await db.runAsync(
        `INSERT OR IGNORE INTO vocab_item_tags (vocab_item_id, vocab_tag_id)
         VALUES (?, ?);`,
        [vocabItemId, tagId]
      );
    }

    await db.execAsync("COMMIT;");
  } catch (e) {
    await db.execAsync("ROLLBACK;");
    throw e;
  }
}
