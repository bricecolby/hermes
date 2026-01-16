import type { SQLiteDatabase } from "expo-sqlite";

export type ConceptRefRow = {
  conceptId: number;
  kind: string;
  refId: number;
  title: string | null;
  description: string | null;
};

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

  const byId = new Map(rows.map((r) => [r.id, r]));
  return conceptIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((r) => ({
      conceptId: r!.id,
      kind: r!.kind,
      refId: r!.ref_id,
      title: r!.title,
      description: r!.description,
    }));
}
