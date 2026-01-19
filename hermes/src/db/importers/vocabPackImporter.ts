import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import type { SQLiteDatabase } from "expo-sqlite";

export type HermesVocabJson = {
  vocab_item: {
    language_id?: number; // ignored; we map via languageCode
    base_form: string;
    part_of_speech: string;
    frequency_rank?: number | null;
    frequency_band?: number | null;
    lexeme_features?: unknown;
    usage_notes?: string | null;
    created_at?: string;
    updated_at?: string;
  };

  senses?: {
    sense_index?: number;
    definition?: string | null;
    translation?: string | null;
    usage_notes?: string | null;
    grammar_hint?: string | null;
    created_at?: string;
    updated_at?: string;

    examples?: {
      example_text: string;
      translation_text?: string | null;
      surface_form?: string | null; // optional link to vocab_forms
      media_uri?: string | null;    // optional link to vocab_media
      created_at?: string;
      updated_at?: string;
    }[];
  }[];

  forms?: {
    surface_form: string;
    tense?: string | null;
    mood?: string | null;
    person?: number | null;
    number?: string | null;
    gender?: string | null;
    case?: string | null;
    aspect?: string | null;
    degree?: string | null;
    morph_features?: unknown;
    is_irregular?: boolean | number | null;
    created_at?: string;
    updated_at?: string;
  }[];

  media?: {
    media_type: string;
    uri: string;
    description?: string | null;
    attribution?: string | null;
    created_at?: string;
    updated_at?: string;
  }[];

  tags?: (string | { name: string; description?: string | null })[];
};


export type VocabPackRef = {
  name: string;     // e.g. "RU A1"
  asset: number;    // require("...jsonl")
  levelTag?: string; // optional: force-add tag to each item (e.g. "CEFR:A1")
};

type ImportOptions = {
  languageCode: string;             // "ru"
  packs: readonly VocabPackRef[];
  replaceExisting?: boolean;        // wipe vocab_items for this language before importing
  verbose?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

async function readBundledText(assetModuleId: number): Promise<string> {
  const asset = Asset.fromModule(assetModuleId);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("Asset missing localUri");
  return await FileSystem.readAsStringAsync(asset.localUri, {
    encoding: "utf8",
  });

}

async function getLanguageId(db: SQLiteDatabase, code: string): Promise<number> {
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM languages WHERE code = ? LIMIT 1;`,
    [code]
  );
  if (!rows.length) throw new Error(`Missing language code: ${code}`);
  return rows[0].id;
}

function asJsonOrNull(v: any): string | null {
  if (v === undefined || v === null) return null;
  return JSON.stringify(v);
}

function truthyInt(v: any): number {
  if (v === true) return 1;
  if (v === false) return 0;
  if (v === 1 || v === 0) return v;
  return v ? 1 : 0;
}

async function ensureTag(db: SQLiteDatabase, name: string, description?: string | null): Promise<number> {
  const ts = nowIso();
  await db.runAsync(
    `INSERT OR IGNORE INTO vocab_tags (name, description, created_at) VALUES (?, ?, ?);`,
    [name, description ?? null, ts]
  );
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM vocab_tags WHERE name = ? LIMIT 1;`,
    [name]
  );
  if (!rows.length) throw new Error(`Failed to ensure tag: ${name}`);
  return rows[0].id;
}

export async function importVocabPacks(db: SQLiteDatabase, opts: ImportOptions) {
  const langId = await getLanguageId(db, opts.languageCode);
  const ts = nowIso();

  if (opts.replaceExisting) {
    // Cascades remove senses/forms/media/examples/item_tags
    await db.runAsync(`DELETE FROM vocab_items WHERE language_id = ?;`, [langId]);
  }

  for (const pack of opts.packs) {
    if (opts.verbose) console.log(`[vocab] importing pack: ${pack.name}`);
    const text = await readBundledText(pack.asset);
    const lines = text.split(/\r?\n/).filter(Boolean);


    for (let i = 0; i < lines.length; i++) {
      let obj: HermesVocabJson | null = null;
      try {
        obj = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      if (!obj?.vocab_item) continue;

      const vi = obj.vocab_item;
      const base = (vi.base_form ?? "").trim();
      const pos = (vi.part_of_speech ?? "").trim();
      if (!base || !pos) continue;
      // Insert vocab_items
      const itemRes = await db.runAsync(
        `INSERT INTO vocab_items
          (language_id, base_form, part_of_speech, frequency_rank, frequency_band, lexeme_features, usage_notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          langId,
          base,
          pos,
          vi.frequency_rank ?? null,
          vi.frequency_band ?? null,
          vi.lexeme_features ? asJsonOrNull(vi.lexeme_features) : null,
          vi.usage_notes ?? null,
          vi.created_at ?? ts,
          vi.updated_at ?? ts,
        ]
      );
      const vocabItemId = Number(itemRes.lastInsertRowId);

      // Forms first so examples can link by surface_form
      const forms = obj.forms ?? [];
      const formIdBySurface = new Map<string, number>();

      for (const f of forms) {
        const sf = (f.surface_form ?? "").trim();
        if (!sf) continue;

        const formRes = await db.runAsync(
          `INSERT INTO vocab_forms
            (vocab_item_id, surface_form, tense, mood, person, number, gender, "case", aspect, degree, morph_features, is_irregular, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            vocabItemId,
            sf,
            f.tense ?? null,
            f.mood ?? null,
            f.person ?? null,
            f.number ?? null,
            f.gender ?? null,
            f.case ?? null,
            f.aspect ?? null,
            f.degree ?? null,
            f.morph_features ? asJsonOrNull(f.morph_features) : null,
            truthyInt(f.is_irregular),
            f.created_at ?? ts,
            f.updated_at ?? ts,
          ]
        );
        if (!formIdBySurface.has(sf)) {
          formIdBySurface.set(sf, Number(formRes.lastInsertRowId));
        }
      }

      // Media (optional) so examples can link by uri
      const media = obj.media ?? [];
      const mediaIdByUri = new Map<string, number>();

      for (const m of media) {
        const uri = (m.uri ?? "").trim();
        const mt = (m.media_type ?? "").trim();
        if (!uri || !mt) continue;

        const mediaRes = await db.runAsync(
          `INSERT INTO vocab_media
            (vocab_item_id, media_type, uri, description, attribution, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            vocabItemId,
            mt,
            uri,
            m.description ?? null,
            m.attribution ?? null,
            m.created_at ?? ts,
            m.updated_at ?? ts,
          ]
        );
        mediaIdByUri.set(uri, Number(mediaRes.lastInsertRowId));
      }

      // Senses + examples
      const senses = obj.senses ?? [];
      for (const s of senses) {
        const senseIndex = Number(s.sense_index ?? 1);

        const senseRes = await db.runAsync(
          `INSERT INTO vocab_senses
            (vocab_item_id, sense_index, definition, translation, usage_notes, grammar_hint, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            vocabItemId,
            senseIndex,
            s.definition ?? null,
            s.translation ?? null,
            s.usage_notes ?? null,
            s.grammar_hint ?? null,
            s.created_at ?? ts,
            s.updated_at ?? ts,
          ]
        );
        const vocabSenseId = Number(senseRes.lastInsertRowId);

        const examples = s.examples ?? [];
        for (const ex of examples) {
          const exText = (ex.example_text ?? "").trim();
          if (!exText) continue;

          let vocabFormId: number | null = null;
          const sf = (ex.surface_form ?? "").trim();
          if (sf && formIdBySurface.has(sf)) vocabFormId = formIdBySurface.get(sf)!;

          let mediaId: number | null = null;
          const exUri = (ex.media_uri ?? "").trim();
          if (exUri && mediaIdByUri.has(exUri)) mediaId = mediaIdByUri.get(exUri)!;

          await db.runAsync(
            `INSERT INTO vocab_examples
              (vocab_sense_id, vocab_form_id, example_text, translation_text, media_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [
              vocabSenseId,
              vocabFormId,
              exText,
              ex.translation_text ?? null,
              mediaId,
              ex.created_at ?? ts,
              ex.updated_at ?? ts,
            ]
          );
        }
      }

      // Tags (pack tags + per-item tags)
      const tagNames: Array<string | { name: string; description?: string | null }> = [];
      if (pack.levelTag) tagNames.push(pack.levelTag);
      if (obj.tags?.length) tagNames.push(...obj.tags);

      for (const t of tagNames) {
        const name = (typeof t === "string" ? t : t.name ?? "").trim();
        if (!name) continue;

        const desc = typeof t === "object" ? (t.description ?? null) : null;
        const tagId = await ensureTag(db, name, desc);

        await db.runAsync(
          `INSERT OR IGNORE INTO vocab_item_tags (vocab_item_id, vocab_tag_id) VALUES (?, ?);`,
          [vocabItemId, tagId]
        );
      }
    }


    if (opts.verbose) console.log(`[vocab] done pack: ${pack.name} (${lines.length} lines)`);
  }
}
