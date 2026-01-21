// src/db/importers/conceptsImporter.ts
import type { SQLiteDatabase } from "expo-sqlite";

function nowIso() {
  return new Date().toISOString();
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function conceptExists(db: SQLiteDatabase, kind: string, refId: number) {
  const rows = await db.getAllAsync<{ one: number }>(
    `SELECT 1 as one FROM concepts WHERE kind = ? AND ref_id = ? LIMIT 1;`,
    [kind, refId]
  );
  return rows.length > 0;
}

/**
 * Ensures each vocab_item has a matching concept row.
 * kind used: "vocab_item"
 * ref_id points to vocab_items.id
 */
export async function ensureVocabItemConcepts(db: SQLiteDatabase, languageId: number) {
  const ts = nowIso();

  const vocab = await db.getAllAsync<{
    id: number;
    base_form: string;
    part_of_speech: string;
  }>(
    `SELECT id, base_form, part_of_speech
     FROM vocab_items
     WHERE language_id = ?;`,
    [languageId]
  );

  for (const v of vocab) {
    const kind = "vocab_item";
    const refId = v.id;

    if (await conceptExists(db, kind, refId)) continue;

    // Optional: pull a short description from first sense translation/definition
    const sense = await db.getFirstAsync<{
      translation: string | null;
      definition: string | null;
    }>(
      `SELECT translation, definition
       FROM vocab_senses
       WHERE vocab_item_id = ?
       ORDER BY sense_index ASC
       LIMIT 1;`,
      [v.id]
    );

    const title = v.base_form;
    const desc = sense?.translation ?? sense?.definition ?? null;

    // Slug should be stable-ish; include vocab id so duplicates don't collide.
    const slug = `vocab-${v.id}-${slugify(v.base_form)}-${slugify(v.part_of_speech)}`;

    await db.runAsync(
      `INSERT INTO concepts (kind, ref_id, language_id, slug, title, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [kind, refId, languageId, slug, title, desc, ts]
    );
  }
}

/**
 * Ensures each grammar_point has a matching concept row.
 * kind used: "grammar_point"
 * ref_id points to grammar_points.id
 */
export async function ensureGrammarPointConcepts(db: SQLiteDatabase, languageId: number) {
  const ts = nowIso();

  const gps = await db.getAllAsync<{ id: number; title: string; summary: string | null }>(
    `SELECT id, title, summary
     FROM grammar_points
     WHERE language_id = ?;`,
    [languageId]
  );

  for (const gp of gps) {
    const kind = "grammar_point";
    const refId = gp.id;

    if (await conceptExists(db, kind, refId)) continue;

    const slug = `grammar-${gp.id}-${slugify(gp.title)}`;
    await db.runAsync(
      `INSERT INTO concepts (kind, ref_id, language_id, slug, title, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [kind, refId, languageId, slug, gp.title, gp.summary ?? null, ts]
    );
  }
}

export async function ensureCoreConcepts(db: SQLiteDatabase, languageId: number) {
  await ensureVocabItemConcepts(db, languageId);
  await ensureGrammarPointConcepts(db, languageId);
}
