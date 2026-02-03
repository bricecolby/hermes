import type { SQLiteDatabase } from "expo-sqlite";
import { importVocabPacks } from "./importers/vocabPackImporter";
import { RU_VOCAB_PACKS } from "@/assets/packs/ru/vocab";
import { ensureCoreConcepts } from "./importers/conceptsImporter";

type SeedOpts = { fromSeedVersion?: number };

export const SEED_VERSION = 4;

export async function seedDb(db: SQLiteDatabase, opts: SeedOpts = {}) {
  const from = opts.fromSeedVersion ?? 0;

  if (from < SEED_VERSION) {
    await seedPatch_v1(db);
  }
}

/**
 * Seed Patch v1
 * - Minimal RU pack content
 * - Grammar sections/points/examples/tags
 * - Vocab items/senses/forms/media/examples/tags
 * - Concepts + lessons + practice + quests + achievements + features
 *
 * Idempotent + patch-safe: no assumed numeric IDs.
 */
async function seedPatch_v1(db: SQLiteDatabase) {
  const now = new Date().toISOString();

  // ----------------------------
  // Helpers
  // ----------------------------
  async function getId(table: string, whereSql: string, params: any[]): Promise<number> {
    const rows = await db.getAllAsync<{ id: number }>(
      `SELECT id FROM ${table} WHERE ${whereSql} LIMIT 1;`,
      params
    );
    if (!rows.length) throw new Error(`Missing row in ${table} WHERE ${whereSql} (${JSON.stringify(params)})`);
    return rows[0].id;
  }

  async function hasRow(table: string, whereSql: string, params: any[]): Promise<boolean> {
    const rows = await db.getAllAsync<{ one: number }>(
      `SELECT 1 as one FROM ${table} WHERE ${whereSql} LIMIT 1;`,
      params
    );
    return rows.length > 0;
  }


  // ----------------------------
  // Languages
  // ----------------------------
  await db.runAsync(
    `INSERT OR IGNORE INTO languages (name, code, created_at, updated_at) VALUES (?, ?, ?, ?);`,
    ["English", "en", now, now]
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO languages (name, code, created_at, updated_at) VALUES (?, ?, ?, ?);`,
    ["Russian", "ru", now, now]
  );

  const EN = await getId("languages", "code = ?", ["en"]);
  const RU = await getId("languages", "code = ?", ["ru"]);

  // ----------------------------
  // Language pack (RU target, EN native)
  // ----------------------------
  await db.runAsync(
    `INSERT OR IGNORE INTO language_packs (target_lang_id, native_lang_id, created_at, updated_at)
     VALUES (?, ?, ?, ?);`,
    [RU, EN, now, now]
  );

  const packId = await getId(
    "language_packs",
    "target_lang_id = ? AND native_lang_id = ?",
    [RU, EN]
  );

  // ----------------------------
  // Default user
  // ----------------------------
  await db.runAsync(
    `
    INSERT OR IGNORE INTO users (
      username, language_pack_id,
      xp, level, current_stamina, stamina_updated_at,
      perk_points, equip_slots, streak_count, last_login,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    ["default", packId, 250, 3, 85, now, 1, 1, 2, now, now, now]
  );

  const userId = await getId("users", "username = ?", ["default"]);

  // ----------------------------
  // CEFR Levels (minimum needed for lessons)
  // ----------------------------
  await db.runAsync(
    `INSERT OR IGNORE INTO cefr_levels (level, description, sort_order) VALUES (?, ?, ?);`,
    ["A1", "Beginner", 1]
  );
  const cefrA1Id = await getId("cefr_levels", "level = ?", ["A1"]);

  // ============================================================
  // VOCAB
  // ============================================================

  // ============================================================
  // RESET VOCAB TABLES (DEV SEED ONLY)
  // ============================================================
  // Since vocab is now sourced from language packs, we clear all
  // vocab-related tables before importing fresh data.
  // This is safe during early development when no user data exists.

  await db.execAsync(`
    DELETE FROM vocab_examples;
    DELETE FROM vocab_media;
    DELETE FROM vocab_forms;
    DELETE FROM vocab_senses;
    DELETE FROM vocab_item_tags;
    DELETE FROM vocab_items;
  `);

  await importVocabPacks(db, {
    languageCode: "ru",
    packs: RU_VOCAB_PACKS,
    replaceExisting: true, // wipe the dummy seed vocab
    verbose: true,
  });
 
  // ============================================================
  // GRAMMAR
  // ============================================================

  // ----------------------------
  // Grammar sections
  // ----------------------------
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_sections (language_id, title, description, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [RU, "Basics", "Core beginner concepts", null, 1, now, now]
  );
  const basicsId = await getId("grammar_sections", "language_id = ? AND title = ?", [RU, "Basics"]);

  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_sections (language_id, title, description, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [RU, "Nouns", "Noun basics and cases", basicsId, 1, now, now]
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_sections (language_id, title, description, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [RU, "Verbs", "Verb basics", basicsId, 2, now, now]
  );

  const nounsId = await getId("grammar_sections", "language_id = ? AND title = ?", [RU, "Nouns"]);
  const verbsId = await getId("grammar_sections", "language_id = ? AND title = ?", [RU, "Verbs"]);

  // ----------------------------
  // Grammar points
  // ----------------------------
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_points (language_id, title, summary, explanation, usage_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [RU, "Nominative vs Genitive (A1)", "Basic subject vs 'of/not having'", "Genitive often answers “of what” and appears after нет.", "Start with patterns: у меня нет …", now, now]
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_points (language_id, title, summary, explanation, usage_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [RU, "Present tense: читать", "Conjugation of читать", "читать → читаю, читаешь, читает…", "Imperfective present", now, now]
  );

  const gpNomGenId = await getId("grammar_points", "language_id = ? AND title = ?", [RU, "Nominative vs Genitive (A1)"]);
  const gpReadId = await getId("grammar_points", "language_id = ? AND title = ?", [RU, "Present tense: читать"]);

  // ----------------------------
  // Link points to sections
  // ----------------------------
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_point_sections (grammar_point_id, grammar_section_id, sort_order) VALUES (?, ?, ?);`,
    [gpNomGenId, nounsId, 1]
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_point_sections (grammar_point_id, grammar_section_id, sort_order) VALUES (?, ?, ?);`,
    [gpReadId, verbsId, 1]
  );

  // ----------------------------
  // Grammar tags (+ A1)
  // ----------------------------
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_tags (language_id, name, description, created_at) VALUES (?, ?, ?, ?);`,
    [RU, "cases", "Noun case system", now]
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_tags (language_id, name, description, created_at) VALUES (?, ?, ?, ?);`,
    [RU, "verbs", "Verb conjugation", now]
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO grammar_tags (language_id, name, description, created_at) VALUES (?, ?, ?, ?);`,
    [RU, "CEFR:A1", "CEFR level A1", now]
  );

  const tagCasesId = await getId("grammar_tags", "language_id = ? AND name = ?", [RU, "cases"]);
  const tagVerbsId = await getId("grammar_tags", "language_id = ? AND name = ?", [RU, "verbs"]);
  const tagA1GrammarId = await getId("grammar_tags", "language_id = ? AND name = ?", [RU, "CEFR:A1"]);

  await db.runAsync(`INSERT OR IGNORE INTO grammar_point_tags (grammar_point_id, grammar_tag_id) VALUES (?, ?);`, [gpNomGenId, tagCasesId]);
  await db.runAsync(`INSERT OR IGNORE INTO grammar_point_tags (grammar_point_id, grammar_tag_id) VALUES (?, ?);`, [gpReadId, tagVerbsId]);

  // tag both as A1 for now
  await db.runAsync(`INSERT OR IGNORE INTO grammar_point_tags (grammar_point_id, grammar_tag_id) VALUES (?, ?);`, [gpNomGenId, tagA1GrammarId]);
  await db.runAsync(`INSERT OR IGNORE INTO grammar_point_tags (grammar_point_id, grammar_tag_id) VALUES (?, ?);`, [gpReadId, tagA1GrammarId]);

  // ----------------------------
  // Grammar examples
  // ----------------------------
  if (!(await hasRow("grammar_examples", "grammar_point_id = ? AND example_text = ?", [gpNomGenId, "У меня нет книги."]))) {
    await db.runAsync(
      `INSERT INTO grammar_examples (grammar_point_id, example_text, translation_text, media_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [gpNomGenId, "У меня нет книги.", "I do not have a book.", null, "Genitive after нет", now, now]
    );
  }

  // // Link grammar point to vocab form (genitive "книги")
  // if (!(await hasRow("vocab_grammar_links", "grammar_point_id = ? AND vocab_form_id = ?", [gpNomGenId, formKnigiGenId]))) {
  //   await db.runAsync(
  //     `INSERT INTO vocab_grammar_links (grammar_point_id, vocab_form_id, created_at) VALUES (?, ?, ?);`,
  //     [gpNomGenId, formKnigiGenId, now]
  //   );
  // }

  // ============================================================
  // Concepts + Lessons
  // ============================================================

  // Ensure concepts exist for vocab_items + grammar_points
  await ensureCoreConcepts(db, RU);

  // Fetch the concept id for the grammar point you want in the lesson
  const conceptNomGenId = await getId("concepts", "kind = ? AND ref_id = ?", [
    "grammar_point",
    gpNomGenId,
  ]);

  // Lesson (A1)
  await db.runAsync(
    `INSERT OR IGNORE INTO lessons (language_id, title, description, cefr_level_id, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [RU, "Greetings & Introductions", "Core greeting vocab + basic grammar", cefrA1Id, 1, now, now]
  );

  const lessonId = await getId("lessons", "language_id = ? AND title = ?", [
    RU,
    "Greetings & Introductions",
  ]);

  await db.runAsync(
    `INSERT OR IGNORE INTO lesson_concepts (lesson_id, concept_id, order_in_lesson, created_at)
    VALUES (?, ?, ?, ?);`,
    [lessonId, conceptNomGenId, 3, now]
  );


  // ============================================================
  // Practice session + attempts (optional pipe test)
  // ============================================================

  // const sessionKey = "Seeded practice session";
  // if (!(await hasRow("practice_sessions", "user_id = ? AND source = ? AND notes = ?", [userId, "seed", sessionKey]))) {
  //   await db.runAsync(
  //     `INSERT INTO practice_sessions (language_id, user_id, started_at, completed_at, modality, source, notes)
  //      VALUES (?, ?, ?, ?, ?, ?, ?);`,
  //     [RU, userId, now, now, "quiz", "seed", sessionKey]
  //   );
  // }
  // const sessionId = await getId("practice_sessions", "user_id = ? AND source = ? AND notes = ?", [userId, "seed", sessionKey]);

  // const promptText = 'Translate: "привет"';
  // if (!(await hasRow("practice_attempts", "session_id = ? AND prompt_text = ?", [sessionId, promptText]))) {
  //   await db.runAsync(
  //     `INSERT INTO practice_attempts (session_id, user_id, modality, type, prompt_text, question_json, user_response_json, evaluation_json, created_at)
  //      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
  //     [
  //       sessionId,
  //       userId,
  //       "reading",
  //       "mcq",
  //       promptText,
  //       JSON.stringify({ question: "Translate: привет", choices: ["Hello", "Goodbye", "Please"], answerIndex: 0 }),
  //       JSON.stringify({ choiceIndex: 0 }),
  //       JSON.stringify({ isCorrect: true, score: 1 }),
  //       now,
  //     ]
  //   );
  // }
  // const attemptId = await getId("practice_attempts", "session_id = ? AND prompt_text = ?", [sessionId, promptText]);

  // if (!(await hasRow("practice_attempt_concepts", "attempt_id = ? AND concept_id = ?", [attemptId, conceptPrivetId]))) {
  //   await db.runAsync(
  //     `INSERT INTO practice_attempt_concepts (attempt_id, concept_id, score, is_correct, weight, evidence_json, created_at)
  //      VALUES (?, ?, ?, ?, ?, ?, ?);`,
  //     [attemptId, conceptPrivetId, 1.0, 1, 1.0, JSON.stringify({ reason: "Correct choice" }), now]
  //   );
  // }

  // ============================================================
  // Quests / Achievements / Features (optional pipe test)
  // ============================================================

  if (!(await hasRow("quests", "user_id = ? AND title = ?", [userId, "Do 3 quick reviews"]))) {
    await db.runAsync(
      `INSERT INTO quests (user_id, quest_type, title, description, status, due_at, completed_at, xp_reward, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [userId, "daily_practice", "Do 3 quick reviews", "Complete 3 practice attempts today.", "pending", null, null, 30, JSON.stringify({ targetAttempts: 3 }), now]
    );
  }

  if (!(await hasRow("quests", "user_id = ? AND title = ?", [userId, "Read Lesson 1"]))) {
    await db.runAsync(
      `INSERT INTO quests (user_id, quest_type, title, description, status, due_at, completed_at, xp_reward, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [userId, "lesson_read", "Read Lesson 1", "Open and read “Greetings & Introductions”.", "pending", null, null, 20, JSON.stringify({ lessonId }), now]
    );
  }

  if (!(await hasRow("achievements", "code = ?", ["FIRST_PRACTICE"]))) {
    await db.runAsync(
      `INSERT INTO achievements (code, title, description, points_awarded, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      ["FIRST_PRACTICE", "First Practice", "Complete your first practice attempt.", 10, now]
    );
  }
  const achievementId = await getId("achievements", "code = ?", ["FIRST_PRACTICE"]);

  if (!(await hasRow("user_achievements", "user_id = ? AND achievement_id = ?", [userId, achievementId]))) {
    await db.runAsync(
      `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?);`,
      [userId, achievementId, now]
    );
  }

  if (!(await hasRow("features", "code = ?", ["FEATURE_DAILY_QUESTS"]))) {
    await db.runAsync(
      `INSERT INTO features (code, name, description, cost_points, slot_cost, min_level, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ["FEATURE_DAILY_QUESTS", "Daily Quests", "Enables daily quest list UI.", 0, 1, 1, now]
    );
  }
  const featureId = await getId("features", "code = ?", ["FEATURE_DAILY_QUESTS"]);

  if (!(await hasRow("user_features", "user_id = ? AND feature_id = ?", [userId, featureId]))) {
    await db.runAsync(
      `INSERT INTO user_features (user_id, feature_id, purchased_at, is_equipped) VALUES (?, ?, ?, ?);`,
      [userId, featureId, now, 1]
    );
  }

  if (!(await hasRow("feature_unlock_requirements", "feature_id = ? AND achievement_id = ?", [featureId, achievementId]))) {
    await db.runAsync(
      `INSERT INTO feature_unlock_requirements (feature_id, achievement_id) VALUES (?, ?);`,
      [featureId, achievementId]
    );
  }

  // user_concept_mastery (optional demo; guard by (user, concept, modality, model_key))
  // const masteryRows: Array<[number, number, string, string, number, number, number, string, string]> = [
  //   [userId, conceptPrivetId, "reading", "ema_v1", 0.85, 10, 9, "2026-01-06T14:30:00.000Z", "2026-01-06T15:00:00.000Z"],
  //   [userId, conceptPrivetId, "listening", "ema_v1", 0.9, 8, 8, "2026-01-06T14:25:00.000Z", "2026-01-06T15:00:00.000Z"],
  //   [userId, conceptPrivetId, "speaking", "ema_v1", 0.55, 6, 4, "2026-01-06T14:20:00.000Z", "2026-01-06T15:00:00.000Z"],
  //   [userId, conceptPrivetId, "writing", "ema_v1", 0.6, 5, 4, "2026-01-06T14:15:00.000Z", "2026-01-06T15:00:00.000Z"],
  // ];

  // for (const [u, c, modality, modelKey, mastery, attempts, correct, lastAttemptAt, updatedAt] of masteryRows) {
  //   if (!(await hasRow("user_concept_mastery", "user_id = ? AND concept_id = ? AND modality = ? AND model_key = ?", [u, c, modality, modelKey]))) {
  //     await db.runAsync(
  //       `INSERT INTO user_concept_mastery
  //         (user_id, concept_id, modality, model_key, mastery, attempts_count, correct_count, last_attempt_at, updated_at)
  //        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
  //       [u, c, modality, modelKey, mastery, attempts, correct, lastAttemptAt, updatedAt]
  //     );
  //   }
  // }
}
