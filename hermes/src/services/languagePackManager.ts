import type { SQLiteDatabase } from "expo-sqlite";

import { RU_GRAMMAR_PACKS } from "@/assets/packs/ru/grammar";
import { RU_VOCAB_PACKS } from "@/assets/packs/ru/vocab";
import { ensureCoreConcepts } from "@/db/importers/conceptsImporter";
import { importGrammarPacks } from "@/db/importers/grammarPackImporter";
import { importVocabPacks } from "@/db/importers/vocabPackImporter";
import { createUserProfileForLanguagePack } from "@/db/queries/users";

type SupportedLanguageCatalogEntry = {
  code: string;
  name: string;
  nativeCode: string;
  nativeName: string;
  vocabPacks: readonly { name: string; asset: number; levelTag?: string }[];
  grammarPacks: readonly { name: string; asset: number; levelTag?: string }[];
};

const LANGUAGE_PACK_CATALOG: readonly SupportedLanguageCatalogEntry[] = [
  {
    code: "ru",
    name: "Russian",
    nativeCode: "en",
    nativeName: "English",
    vocabPacks: RU_VOCAB_PACKS,
    grammarPacks: RU_GRAMMAR_PACKS,
  },
] as const;

export type ManagedLanguagePack = {
  code: string;
  name: string;
  nativeCode: string;
  nativeName: string;
  learningLangId: number | null;
  languagePackId: number | null;
  hasProfile: boolean;
  vocabItems: number;
  grammarPoints: number;
  installed: boolean;
};

function getCatalogEntryOrThrow(code: string): SupportedLanguageCatalogEntry {
  const entry = LANGUAGE_PACK_CATALOG.find((x) => x.code === code);
  if (!entry) {
    throw new Error(`Unsupported language code: ${code}`);
  }
  return entry;
}

async function getLanguageByCode(db: SQLiteDatabase, code: string): Promise<{ id: number; name: string } | null> {
  return db.getFirstAsync<{ id: number; name: string }>(
    `SELECT id, name FROM languages WHERE code = ? LIMIT 1;`,
    [code]
  );
}

async function ensureLanguage(db: SQLiteDatabase, code: string, name: string): Promise<number> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO languages (name, code, created_at, updated_at)
     VALUES (?, ?, ?, ?);`,
    [name, code, now, now]
  );

  const row = await getLanguageByCode(db, code);
  if (!row) throw new Error(`Failed to ensure language: ${code}`);
  return row.id;
}

async function getLanguagePackId(
  db: SQLiteDatabase,
  targetLangId: number,
  nativeLangId: number
): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id
     FROM language_packs
     WHERE target_lang_id = ? AND native_lang_id = ?
     LIMIT 1;`,
    [targetLangId, nativeLangId]
  );
  return row?.id ?? null;
}

async function ensureLanguagePack(
  db: SQLiteDatabase,
  targetLangId: number,
  nativeLangId: number
): Promise<number> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO language_packs (target_lang_id, native_lang_id, created_at, updated_at)
     VALUES (?, ?, ?, ?);`,
    [targetLangId, nativeLangId, now, now]
  );

  const packId = await getLanguagePackId(db, targetLangId, nativeLangId);
  if (!packId) {
    throw new Error(`Failed to ensure language pack: ${targetLangId}/${nativeLangId}`);
  }
  return packId;
}

async function countLanguageContent(db: SQLiteDatabase, languageId: number): Promise<{ vocabItems: number; grammarPoints: number }> {
  const [vocab, grammar] = await Promise.all([
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM vocab_items WHERE language_id = ?;`,
      [languageId]
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM grammar_points WHERE language_id = ?;`,
      [languageId]
    ),
  ]);

  return {
    vocabItems: Number(vocab?.count ?? 0),
    grammarPoints: Number(grammar?.count ?? 0),
  };
}

export async function listManagedLanguagePacks(
  db: SQLiteDatabase,
  username: string
): Promise<ManagedLanguagePack[]> {
  const out: ManagedLanguagePack[] = [];

  for (const entry of LANGUAGE_PACK_CATALOG) {
    const learningLang = await getLanguageByCode(db, entry.code);
    const nativeLang = await getLanguageByCode(db, entry.nativeCode);

    let learningLangId: number | null = learningLang?.id ?? null;
    let languagePackId: number | null = null;
    let hasProfile = false;
    let vocabItems = 0;
    let grammarPoints = 0;

    if (learningLangId != null && nativeLang?.id != null) {
      languagePackId = await getLanguagePackId(db, learningLangId, nativeLang.id);
      if (languagePackId != null) {
        const p = await db.getFirstAsync<{ one: number }>(
          `SELECT 1 AS one
           FROM users
           WHERE username = ? AND language_pack_id = ?
           LIMIT 1;`,
          [username, languagePackId]
        );
        hasProfile = !!p;
      }

      const counts = await countLanguageContent(db, learningLangId);
      vocabItems = counts.vocabItems;
      grammarPoints = counts.grammarPoints;
    }

    out.push({
      code: entry.code,
      name: entry.name,
      nativeCode: entry.nativeCode,
      nativeName: entry.nativeName,
      learningLangId,
      languagePackId,
      hasProfile,
      vocabItems,
      grammarPoints,
      installed: vocabItems > 0 || grammarPoints > 0,
    });
  }

  return out;
}

export async function installOrUpdateLanguagePack(
  db: SQLiteDatabase,
  username: string,
  code: string
): Promise<void> {
  const entry = getCatalogEntryOrThrow(code);

  await db.withTransactionAsync(async () => {
    const learningLangId = await ensureLanguage(db, entry.code, entry.name);
    const nativeLangId = await ensureLanguage(db, entry.nativeCode, entry.nativeName);

    const packId = await ensureLanguagePack(db, learningLangId, nativeLangId);

    await importVocabPacks(db, {
      languageCode: entry.code,
      packs: entry.vocabPacks,
      replaceExisting: false,
      verbose: true,
    });

    await importGrammarPacks(db, {
      languageCode: entry.code,
      packs: entry.grammarPacks,
      replaceExisting: false,
      verbose: true,
    });

    await ensureCoreConcepts(db, learningLangId);

    const existingProfile = await db.getFirstAsync<{ id: number }>(
      `SELECT id
       FROM users
       WHERE username = ? AND language_pack_id = ?
       LIMIT 1;`,
      [username, packId]
    );

    if (!existingProfile) {
      await createUserProfileForLanguagePack(db, username, packId);
    }
  });
}

export async function deleteLanguagePack(
  db: SQLiteDatabase,
  username: string,
  code: string
): Promise<void> {
  const entry = getCatalogEntryOrThrow(code);

  await db.withTransactionAsync(async () => {
    const learningLang = await getLanguageByCode(db, entry.code);
    const nativeLang = await getLanguageByCode(db, entry.nativeCode);
    if (!learningLang || !nativeLang) return;

    const packId = await getLanguagePackId(db, learningLang.id, nativeLang.id);

    // Remove user profiles for this pack. This cascades per-user progress tied to those user rows.
    if (packId != null) {
      await db.runAsync(
        `DELETE FROM users
         WHERE username = ? AND language_pack_id = ?;`,
        [username, packId]
      );
    }

    // Remove language content (concept deletes cascade to concept-linked progress queues).
    await db.runAsync(
      `DELETE FROM concepts
       WHERE language_id = ? AND kind IN ('vocab_item', 'grammar_point');`,
      [learningLang.id]
    );

    await db.runAsync(`DELETE FROM vocab_items WHERE language_id = ?;`, [learningLang.id]);
    await db.runAsync(`DELETE FROM grammar_points WHERE language_id = ?;`, [learningLang.id]);
    await db.runAsync(`DELETE FROM grammar_sections WHERE language_id = ?;`, [learningLang.id]);
    await db.runAsync(`DELETE FROM grammar_tags WHERE language_id = ?;`, [learningLang.id]);

    if (packId != null) {
      await db.runAsync(`DELETE FROM language_packs WHERE id = ?;`, [packId]);
    }
  });
}

export function listSupportedLanguageCodes(): string[] {
  return LANGUAGE_PACK_CATALOG.map((x) => x.code);
}
