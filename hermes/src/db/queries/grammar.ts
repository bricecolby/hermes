import type { SQLiteDatabase } from "expo-sqlite";

export type GrammarPointRow = {
  id: number;
  language_id: number;
  title: string;
  summary: string | null;
  explanation: string | null;
  usage_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GrammarExampleRow = {
  id: number;
  grammar_point_id: number;
  example_text: string;
  translation_text: string | null;
  media_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GrammarSectionRow = {
  id: number;
  language_id: number;
  title: string;
  description: string | null;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type GrammarTagRow = {
  id: number;
  language_id: number;
  name: string;
  description: string | null;
  created_at: string;
};

export type VocabGrammarLinkRow = {
  id: number;
  grammar_point_id: number;
  vocab_item_id: number | null;
  vocab_sense_id: number | null;
  vocab_form_id: number | null;
  created_at: string;
};

export type GrammarPointListItem = {
  id: number;
  title: string;
  summary: string | null;
  language_id: number;
  sort_order: number;
};

export type GrammarSectionWithCount = {
  id: number;
  language_id: number;
  title: string;
  description: string | null;
  parent_id: number | null;
  sort_order: number;
  point_count: number;
};


export async function listGrammarPointsByLanguage(
  db: SQLiteDatabase,
  languageId: number
): Promise<GrammarPointRow[]> {
  return db.getAllAsync<GrammarPointRow>(
    `SELECT *
     FROM grammar_points
     WHERE language_id = ?
     ORDER BY title ASC;`,
    [languageId]
  );
}

export async function getGrammarPoint(
  db: SQLiteDatabase,
  grammarPointId: number
): Promise<GrammarPointRow | null> {
  return db.getFirstAsync<GrammarPointRow>(
    `SELECT *
     FROM grammar_points
     WHERE id = ?
     LIMIT 1;`,
    [grammarPointId]
  );
}

export async function listExamplesForGrammarPoint(
  db: SQLiteDatabase,
  grammarPointId: number
): Promise<GrammarExampleRow[]> {
  return db.getAllAsync<GrammarExampleRow>(
    `SELECT *
     FROM grammar_examples
     WHERE grammar_point_id = ?
     ORDER BY id ASC;`,
    [grammarPointId]
  );
}

export async function listGrammarSectionsByLanguage(
  db: SQLiteDatabase,
  languageId: number
): Promise<GrammarSectionRow[]> {
  return db.getAllAsync<GrammarSectionRow>(
    `SELECT *
     FROM grammar_sections
     WHERE language_id = ?
     ORDER BY sort_order ASC, title ASC;`,
    [languageId]
  );
}

export async function listGrammarTagsByLanguage(
  db: SQLiteDatabase,
  languageId: number
): Promise<GrammarTagRow[]> {
  return db.getAllAsync<GrammarTagRow>(
    `SELECT *
     FROM grammar_tags
     WHERE language_id = ?
     ORDER BY name ASC;`,
    [languageId]
  );
}

export async function listTagsForGrammarPoint(
  db: SQLiteDatabase,
  grammarPointId: number
): Promise<GrammarTagRow[]> {
  return db.getAllAsync<GrammarTagRow>(
    `SELECT t.*
     FROM grammar_tags t
     JOIN grammar_point_tags gpt ON gpt.grammar_tag_id = t.id
     WHERE gpt.grammar_point_id = ?
     ORDER BY t.name ASC;`,
    [grammarPointId]
  );
}

export async function listVocabLinksForGrammarPoint(
  db: SQLiteDatabase,
  grammarPointId: number
): Promise<VocabGrammarLinkRow[]> {
  return db.getAllAsync<VocabGrammarLinkRow>(
    `SELECT *
     FROM vocab_grammar_links
     WHERE grammar_point_id = ?
     ORDER BY id ASC;`,
    [grammarPointId]
  );
}

export async function listTopLevelGrammarLessons(
  db: SQLiteDatabase,
  languageId: number
): Promise<GrammarSectionWithCount[]> {
  return db.getAllAsync<GrammarSectionWithCount>(
    `
    SELECT
      s.*,
      COUNT(gps.grammar_point_id) AS point_count
    FROM grammar_sections s
    LEFT JOIN grammar_point_sections gps
      ON gps.grammar_section_id = s.id
    WHERE s.language_id = ?
      AND s.parent_id IS NULL
    GROUP BY s.id
    ORDER BY s.sort_order ASC, s.title ASC;
    `,
    [languageId]
  );
}

export async function listGrammarPointsForSection(
  db: SQLiteDatabase,
  grammarSectionId: number
): Promise<GrammarPointListItem[]> {
  return db.getAllAsync<GrammarPointListItem>(
    `
    SELECT
      gp.id,
      gp.title,
      gp.summary,
      gp.language_id,
      gps.sort_order
    FROM grammar_point_sections gps
    JOIN grammar_points gp
      ON gp.id = gps.grammar_point_id
    WHERE gps.grammar_section_id = ?
    ORDER BY gps.sort_order ASC, gp.title ASC;
    `,
    [grammarSectionId]
  );
}
