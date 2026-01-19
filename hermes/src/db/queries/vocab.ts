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
