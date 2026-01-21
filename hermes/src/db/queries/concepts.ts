import type { SQLiteDatabase } from "expo-sqlite";

export type ConceptKind = "vocab_item" | "grammar_item";

export type ConceptRefRow = {
  conceptId: number;
  kind: ConceptKind;
  refId: number;
  title: string | null;
  description: string | null;
};

function isConceptKind(k: string): k is ConceptKind {
  return k === "vocab_item" || k === "grammar_point";
}

export async function getConceptRefsByConceptIds(
  db: SQLiteDatabase,
  conceptIds: number[]
): Promise<ConceptRefRow[]> {
  if (conceptIds.length === 0) return [];

  const placeholders = conceptIds.map(() => "?").join(", ");

  const rows = await db.getAllAsync<{
    id: number;
    kind: string;
    ref_id: number;
    title: string | null;
    description: string | null;
  }>(
    `SELECT id, kind, ref_id, title, description
     FROM concepts
     WHERE id IN (${placeholders});`,
    conceptIds
  );

  const byId = new Map<number, ConceptRefRow>();

  for (const r of rows) {
    if (!isConceptKind(r.kind)) continue;

    byId.set(r.id, {
      conceptId: r.id,
      kind: r.kind,
      refId: r.ref_id,
      title: r.title,
      description: r.description,
    });
  }

  return conceptIds.map((id) => byId.get(id)).filter((x): x is ConceptRefRow => !!x);
}

export async function getRandomVocabConceptRefs(
  db: SQLiteDatabase,
  languageId: number,
  limit: number
): Promise<ConceptRefRow[]> {
  return db.getAllAsync<ConceptRefRow>(
    `
    SELECT
      c.id             AS conceptId,
      'vocab_item'     AS kind,
      vi.id            AS refId,
      c.title          AS title,
      c.description    AS description
    FROM concepts c
    JOIN vocab_items vi
      ON c.kind = 'vocab_item'
     AND c.ref_id = vi.id
     AND c.language_id = vi.language_id
    WHERE c.language_id = ?
    ORDER BY RANDOM()
    LIMIT ?;
    `,
    [languageId, limit]
  );
}
