import { RU_GRAMMAR_PACKS } from "@/assets/packs/ru/grammar";
import { RU_VOCAB_PACKS } from "@/assets/packs/ru/vocab";
import type { SQLiteDatabase } from "expo-sqlite";
import { ensureCoreConcepts } from "./importers/conceptsImporter";
import { importGrammarPacks } from "./importers/grammarPackImporter";
import { importVocabPacks } from "./importers/vocabPackImporter";

type SeedOpts = { fromSeedVersion?: number };

export const SEED_VERSION = 11;

export async function seedDb(db: SQLiteDatabase, opts: SeedOpts = {}) {
  const from = opts.fromSeedVersion ?? 0;

  if (from < SEED_VERSION) {
    await seedPatch_v1(db);
  }
}

/**
 * Seed Patch v1
 * - Import RU vocab packs
 * - Import RU grammar packs
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

  await importVocabPacks(db, {
    languageCode: "ru",
    packs: RU_VOCAB_PACKS,
    replaceExisting: false,
    verbose: true,
  });
 
  // ============================================================
  // GRAMMAR
  // ============================================================
  await importGrammarPacks(db, {
    languageCode: "ru",
    packs: RU_GRAMMAR_PACKS,
    replaceExisting: false,
    verbose: true,
  });

  // ============================================================
  // Concepts + Lessons
  // ============================================================

  // Ensure concepts exist for imported vocab_items + grammar_points
  await ensureCoreConcepts(db, RU);

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

  const seedLessonConcepts = await db.getAllAsync<{ id: number }>(
    `SELECT id
     FROM concepts
     WHERE language_id = ?
       AND kind IN ('vocab_item', 'grammar_point')
     ORDER BY kind ASC, id ASC
     LIMIT 3;`,
    [RU]
  );
  for (let i = 0; i < seedLessonConcepts.length; i++) {
    await db.runAsync(
      `INSERT OR IGNORE INTO lesson_concepts (lesson_id, concept_id, order_in_lesson, created_at)
      VALUES (?, ?, ?, ?);`,
      [lessonId, seedLessonConcepts[i].id, i + 1, now]
    );
  }


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
