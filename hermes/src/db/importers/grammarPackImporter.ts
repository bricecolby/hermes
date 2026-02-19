import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { SQLiteDatabase } from "expo-sqlite";

export type HermesGrammarPackJson = {
  meta?: {
    level?: string;
  };
  sections?: {
    slug: string;
    title: string;
    description?: string | null;
    parent_slug?: string | null;
    sort_order?: number | null;
  }[];
  tags?: {
    name: string;
    description?: string | null;
  }[];
  grammar_points?: {
    slug?: string;
    title: string;
    summary?: string | null;
    explanation?: string | null;
    usage_notes?: string | null;
    section_slugs?: string[];
    tag_names?: string[];
    section_sort_order?: Record<string, number | null | undefined>;
    examples?: {
      example_text: string;
      translation_text?: string | null;
      notes?: string | null;
    }[];
  }[];
};

export type GrammarPackRef = {
  name: string;
  asset: number | HermesGrammarPackJson;
  levelTag?: string;
};

type ImportOptions = {
  languageCode: string;
  packs: readonly GrammarPackRef[];
  replaceExisting?: boolean; // destructive mode; avoid for production
  verbose?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

async function readBundledPack(source: number | HermesGrammarPackJson): Promise<HermesGrammarPackJson> {
  // JSON imports in Metro can resolve to an object (not an asset module id).
  if (typeof source === "object" && source !== null) {
    return source as HermesGrammarPackJson;
  }

  const asset = Asset.fromModule(source);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("Asset missing localUri");
  const text = await FileSystem.readAsStringAsync(asset.localUri, {
    encoding: "utf8",
  });
  return JSON.parse(text) as HermesGrammarPackJson;
}

async function getLanguageId(db: SQLiteDatabase, code: string): Promise<number> {
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM languages WHERE code = ? LIMIT 1;`,
    [code]
  );
  if (!rows.length) throw new Error(`Missing language code: ${code}`);
  return rows[0].id;
}

async function ensureGrammarTag(
  db: SQLiteDatabase,
  languageId: number,
  name: string,
  description?: string | null
): Promise<number> {
  const ts = nowIso();
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_tags (language_id, name, description, created_at)
     VALUES (?, ?, ?, ?);`,
    [languageId, name, description ?? null, ts]
  );

  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM grammar_tags WHERE language_id = ? AND name = ? LIMIT 1;`,
    [languageId, name]
  );
  if (!rows.length) throw new Error(`Failed to ensure grammar tag: ${name}`);
  return rows[0].id;
}

function slugifyIdPart(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sectionExternalId(slug: string): string {
  return `grammar-section:${slug}`;
}

function pointExternalId(slug: string, title: string): string {
  const trimmed = slug.trim();
  if (trimmed) return `grammar-point:${trimmed}`;
  return `grammar-point:title:${slugifyIdPart(title)}`;
}

async function upsertSections(
  db: SQLiteDatabase,
  languageId: number,
  sections: NonNullable<HermesGrammarPackJson["sections"]>,
  verbose?: boolean
): Promise<Map<string, number>> {
  const ts = nowIso();
  const bySlug = new Map<string, NonNullable<HermesGrammarPackJson["sections"]>[number]>();
  for (const s of sections) {
    const slug = (s.slug ?? "").trim();
    const title = (s.title ?? "").trim();
    if (!slug || !title) continue;
    bySlug.set(slug, s);
  }

  const upserted = new Map<string, number>();
  const pending = new Set<string>(Array.from(bySlug.keys()));

  while (pending.size > 0) {
    let progressed = false;

    for (const slug of Array.from(pending)) {
      const s = bySlug.get(slug);
      if (!s) {
        pending.delete(slug);
        continue;
      }

      const parentSlug = (s.parent_slug ?? "").trim();
      let parentId: number | null = null;
      if (parentSlug) {
        if (!upserted.has(parentSlug)) {
          continue;
        }
        parentId = upserted.get(parentSlug)!;
      }

      const externalId = sectionExternalId(slug);
      let existing = await db.getAllAsync<{ id: number }>(
        `SELECT id
         FROM grammar_sections
         WHERE language_id = ? AND external_id = ?
         LIMIT 1;`,
        [languageId, externalId]
      );
      if (!existing.length) {
        existing = await db.getAllAsync<{ id: number }>(
          `SELECT id
           FROM grammar_sections
           WHERE language_id = ? AND title = ?
           ORDER BY id ASC
           LIMIT 1;`,
          [languageId, s.title]
        );
      }

      if (existing.length) {
        await db.runAsync(
          `UPDATE grammar_sections
           SET external_id = ?,
               title = ?,
               description = ?,
               parent_id = ?,
               sort_order = ?,
               updated_at = ?
           WHERE id = ?;`,
          [externalId, s.title, s.description ?? null, parentId, s.sort_order ?? 0, ts, existing[0].id]
        );
        upserted.set(slug, existing[0].id);
      } else {
        const res = await db.runAsync(
          `INSERT INTO grammar_sections (language_id, external_id, title, description, parent_id, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [languageId, externalId, s.title, s.description ?? null, parentId, s.sort_order ?? 0, ts, ts]
        );
        upserted.set(slug, Number(res.lastInsertRowId));
      }

      pending.delete(slug);
      progressed = true;
    }

    if (!progressed) {
      if (verbose) {
        console.warn("[grammar] unresolved parent_slug dependencies; inserting leftovers as roots");
      }
      for (const slug of Array.from(pending)) {
        const s = bySlug.get(slug);
        if (!s) {
          pending.delete(slug);
          continue;
        }
        const externalId = sectionExternalId(slug);
        let existing = await db.getAllAsync<{ id: number }>(
          `SELECT id
           FROM grammar_sections
           WHERE language_id = ? AND external_id = ?
           LIMIT 1;`,
          [languageId, externalId]
        );
        if (!existing.length) {
          existing = await db.getAllAsync<{ id: number }>(
            `SELECT id
             FROM grammar_sections
             WHERE language_id = ? AND title = ?
             ORDER BY id ASC
             LIMIT 1;`,
            [languageId, s.title]
          );
        }
        if (existing.length) {
          await db.runAsync(
            `UPDATE grammar_sections
             SET external_id = ?, title = ?, description = ?, parent_id = NULL, sort_order = ?, updated_at = ?
             WHERE id = ?;`,
            [externalId, s.title, s.description ?? null, s.sort_order ?? 0, ts, existing[0].id]
          );
          upserted.set(slug, existing[0].id);
        } else {
          const res = await db.runAsync(
            `INSERT INTO grammar_sections (language_id, external_id, title, description, parent_id, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            [languageId, externalId, s.title, s.description ?? null, null, s.sort_order ?? 0, ts, ts]
          );
          upserted.set(slug, Number(res.lastInsertRowId));
        }
        pending.delete(slug);
      }
    }
  }

  return upserted;
}

export async function importGrammarPacks(db: SQLiteDatabase, opts: ImportOptions) {
  const langId = await getLanguageId(db, opts.languageCode);
  const ts = nowIso();

  if (opts.replaceExisting) {
    await db.execAsync(`
      DELETE FROM vocab_grammar_links;
      DELETE FROM grammar_examples;
      DELETE FROM grammar_point_sections;
      DELETE FROM grammar_point_tags;
      DELETE FROM grammar_points;
      DELETE FROM grammar_sections;
      DELETE FROM grammar_tags;
    `);
  }

  for (const pack of opts.packs) {
    if (opts.verbose) console.log(`[grammar] importing pack: ${pack.name}`);

    let obj: HermesGrammarPackJson;
    try {
      obj = await readBundledPack(pack.asset);
    } catch (e) {
      throw new Error(`Failed to load grammar pack ${pack.name}: ${String(e)}`);
    }

    const sections = obj.sections ?? [];
    const tags = obj.tags ?? [];
    const points = obj.grammar_points ?? [];

    const sectionIdBySlug = await upsertSections(db, langId, sections, opts.verbose);

    const tagIdByName = new Map<string, number>();
    for (const t of tags) {
      const name = (t.name ?? "").trim();
      if (!name) continue;
      const tagId = await ensureGrammarTag(db, langId, name, t.description ?? null);
      tagIdByName.set(name, tagId);
    }

    const autoLevelTag = (obj.meta?.level ?? "").trim();
    const levelTag = (pack.levelTag ?? (autoLevelTag ? `CEFR:${autoLevelTag}` : "")).trim();
    if (levelTag) {
      const levelTagId = await ensureGrammarTag(db, langId, levelTag, `CEFR level from pack ${pack.name}`);
      tagIdByName.set(levelTag, levelTagId);
    }

    for (const gp of points) {
      const title = (gp.title ?? "").trim();
      if (!title) continue;
      const gpExternalId = pointExternalId(gp.slug ?? "", title);

      let existingPoint = await db.getAllAsync<{ id: number }>(
        `SELECT id
         FROM grammar_points
         WHERE language_id = ? AND external_id = ?
         LIMIT 1;`,
        [langId, gpExternalId]
      );
      if (!existingPoint.length) {
        existingPoint = await db.getAllAsync<{ id: number }>(
          `SELECT id
           FROM grammar_points
           WHERE language_id = ? AND title = ?
           ORDER BY id ASC
           LIMIT 1;`,
          [langId, title]
        );
      }

      let grammarPointId: number;
      if (existingPoint.length) {
        grammarPointId = existingPoint[0].id;
        await db.runAsync(
          `UPDATE grammar_points
           SET external_id = ?,
               title = ?,
               summary = ?,
               explanation = ?,
               usage_notes = ?,
               updated_at = ?
           WHERE id = ?;`,
          [gpExternalId, title, gp.summary ?? null, gp.explanation ?? null, gp.usage_notes ?? null, ts, grammarPointId]
        );
        await db.runAsync(`DELETE FROM grammar_examples WHERE grammar_point_id = ?;`, [grammarPointId]);
        await db.runAsync(`DELETE FROM grammar_point_sections WHERE grammar_point_id = ?;`, [grammarPointId]);
        await db.runAsync(`DELETE FROM grammar_point_tags WHERE grammar_point_id = ?;`, [grammarPointId]);
      } else {
        const gpRes = await db.runAsync(
          `INSERT INTO grammar_points (language_id, external_id, title, summary, explanation, usage_notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [langId, gpExternalId, title, gp.summary ?? null, gp.explanation ?? null, gp.usage_notes ?? null, ts, ts]
        );
        grammarPointId = Number(gpRes.lastInsertRowId);
      }

      const slugs = gp.section_slugs ?? [];
      for (const slug of slugs) {
        const sectionId = sectionIdBySlug.get(slug);
        if (!sectionId) continue;
        const sectionSortOrder = gp.section_sort_order?.[slug];
        await db.runAsync(
          `INSERT OR IGNORE INTO grammar_point_sections (grammar_point_id, grammar_section_id, sort_order)
           VALUES (?, ?, ?);`,
          [grammarPointId, sectionId, sectionSortOrder ?? 0]
        );
      }

      const pointTagNames = new Set<string>(gp.tag_names ?? []);
      if (levelTag) pointTagNames.add(levelTag);
      for (const name of pointTagNames) {
        if (!name) continue;

        let tagId = tagIdByName.get(name);
        if (!tagId) {
          tagId = await ensureGrammarTag(db, langId, name, null);
          tagIdByName.set(name, tagId);
        }

        await db.runAsync(
          `INSERT OR IGNORE INTO grammar_point_tags (grammar_point_id, grammar_tag_id)
           VALUES (?, ?);`,
          [grammarPointId, tagId]
        );
      }

      const examples = gp.examples ?? [];
      for (const ex of examples) {
        const textVal = (ex.example_text ?? "").trim();
        if (!textVal) continue;

        await db.runAsync(
          `INSERT INTO grammar_examples (grammar_point_id, example_text, translation_text, media_id, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [grammarPointId, textVal, ex.translation_text ?? null, null, ex.notes ?? null, ts, ts]
        );
      }
    }

    if (opts.verbose) {
      console.log(
        `[grammar] done pack: ${pack.name} (sections=${sections.length}, tags=${tags.length}, points=${points.length})`
      );
    }
  }
}
