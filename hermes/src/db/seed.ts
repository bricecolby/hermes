import type { SQLiteDatabase } from "expo-sqlite";

export async function seedDb(db: SQLiteDatabase) {
  const now = new Date().toISOString();

  // Languages
  await db.runAsync(
    `INSERT INTO languages (name, code, created_at, updated_at) VALUES (?, ?, ?, ?);`,
    ["English", "en", now, now]
  );
  await db.runAsync(
    `INSERT INTO languages (name, code, created_at, updated_at) VALUES (?, ?, ?, ?);`,
    ["Russian", "ru", now, now]
  );

  await db.runAsync(
    `
    INSERT INTO language_packs (target_lang_id, native_lang_id, created_at, updated_at)
    VALUES (?, ?, ?, ?);
    `,
    [2, 1, now, now]
  );

  // User (learning ru, native en)
  await db.runAsync(
    `
    INSERT INTO users (
      username, language_pack_id,
      xp, level, current_stamina, stamina_updated_at,
      perk_points, equip_slots, streak_count, last_login,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    ["default", 1, 250, 3, 85, now, 1, 1, 2, now, now, now]
  );

  // CEFR levels
  await db.runAsync(`INSERT INTO cefr_levels (level, description, sort_order) VALUES (?, ?, ?);`, ["A1", "Beginner", 1]);
  await db.runAsync(`INSERT INTO cefr_levels (level, description, sort_order) VALUES (?, ?, ?);`, ["A2", "Elementary", 2]);
  await db.runAsync(`INSERT INTO cefr_levels (level, description, sort_order) VALUES (?, ?, ?);`, ["B1", "Intermediate", 3]);
  await db.runAsync(`INSERT INTO cefr_levels (level, description, sort_order) VALUES (?, ?, ?);`, ["B2", "Upper Intermediate", 4]);

  // Vocab
  await db.runAsync(
    `INSERT INTO vocab_items (language_id, base_form, part_of_speech, frequency_rank, frequency_band, usage_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [2, "привет", "interjection", 50, 1, "Informal greeting", now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_items (language_id, base_form, part_of_speech, frequency_rank, frequency_band, usage_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [2, "книга", "noun", 300, 2, "Feminine noun", now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_items (language_id, base_form, part_of_speech, frequency_rank, frequency_band, usage_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [2, "читать", "verb", 220, 2, "Imperfective verb", now, now]
  );

  // Senses 
  await db.runAsync(
    `INSERT INTO vocab_senses (vocab_item_id, sense_index, definition, translation, usage_notes, grammar_hint, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [1, 1, "A casual greeting", "hi / hello", "Used with friends", null, now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_senses (vocab_item_id, sense_index, definition, translation, usage_notes, grammar_hint, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [2, 1, "A bound set of pages for reading", "book", "Common noun", "Case changes: книга/книги/книгу…", now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_senses (vocab_item_id, sense_index, definition, translation, usage_notes, grammar_hint, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [3, 1, "To read", "to read", "Imperfective; habitual/ongoing", "Conjugates: читаю, читаешь…", now, now]
  );

  // Forms
  await db.runAsync(
    `INSERT INTO vocab_forms (vocab_item_id, surface_form, number, gender, "case", is_irregular, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [2, "книга", "singular", "feminine", "nominative", 0, now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_forms (vocab_item_id, surface_form, number, gender, "case", is_irregular, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [2, "книги", "singular", "feminine", "genitive", 0, now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_forms (vocab_item_id, surface_form, tense, person, number, aspect, is_irregular, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [3, "читаю", "present", 1, "singular", "imperfective", 0, now, now]
  );

  // Media (requires vocab_item_id)
  await db.runAsync(
    `INSERT INTO vocab_media (vocab_item_id, media_type, uri, description, attribution, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [1, "audio", "app://seed/audio/privet.mp3", "Pronunciation: привет", "seed", now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_media (vocab_item_id, media_type, uri, description, attribution, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, "image", "app://seed/img/kniga.png", "Image: a book", "seed", now, now]
  );

  // Examples 
  await db.runAsync(
    `INSERT INTO vocab_examples (vocab_sense_id, vocab_form_id, example_text, translation_text, media_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [1, null, "Привет, как дела?", "Hi, how are you?", 1, now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_examples (vocab_sense_id, vocab_form_id, example_text, translation_text, media_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, 1, "Это моя книга.", "This is my book.", 2, now, now]
  );
  await db.runAsync(
    `INSERT INTO vocab_examples (vocab_sense_id, vocab_form_id, example_text, translation_text, media_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [3, 3, "Я читаю книгу.", "I am reading a book.", null, now, now]
  );

  // Grammar points + sections + tags
  await db.runAsync(
    `INSERT INTO grammar_points (language_id, title, summary, explanation, usage_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, "Nominative vs Genitive (A1)", "Basic subject vs 'of/not having'", "Genitive often answers “of what” and appears after нет.", "Start with patterns: у меня нет …", now, now]
  );
  await db.runAsync(
    `INSERT INTO grammar_points (language_id, title, summary, explanation, usage_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, "Present tense: читать", "Conjugation of читать", "читать → читаю, читаешь, читает…", "Imperfective present", now, now]
  );

  await db.runAsync(
    `INSERT INTO grammar_sections (language_id, title, description, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, "Basics", "Core beginner concepts", null, 1, now, now]
  );
  await db.runAsync(
    `INSERT INTO grammar_sections (language_id, title, description, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, "Nouns", "Noun basics and cases", 1, 1, now, now]
  );
  await db.runAsync(
    `INSERT INTO grammar_sections (language_id, title, description, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, "Verbs", "Verb basics", 1, 2, now, now]
  );

  await db.runAsync(
    `INSERT INTO grammar_point_sections (grammar_point_id, grammar_section_id, sort_order) VALUES (?, ?, ?);`,
    [1, 2, 1]
  );
  await db.runAsync(
    `INSERT INTO grammar_point_sections (grammar_point_id, grammar_section_id, sort_order) VALUES (?, ?, ?);`,
    [2, 3, 1]
  );

  await db.runAsync(
    `INSERT INTO grammar_tags (language_id, name, description, created_at) VALUES (?, ?, ?, ?);`,
    [2, "cases", "Noun case system", now]
  );
  await db.runAsync(
    `INSERT INTO grammar_tags (language_id, name, description, created_at) VALUES (?, ?, ?, ?);`,
    [2, "verbs", "Verb conjugation", now]
  );

  await db.runAsync(
    `INSERT INTO grammar_point_tags (grammar_point_id, grammar_tag_id) VALUES (?, ?);`,
    [1, 1]
  );
  await db.runAsync(
    `INSERT INTO grammar_point_tags (grammar_point_id, grammar_tag_id) VALUES (?, ?);`,
    [2, 2]
  );

  await db.runAsync(
    `INSERT INTO grammar_examples (grammar_point_id, example_text, translation_text, media_id, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [1, "У меня нет книги.", "I do not have a book.", null, "Genitive after нет", now, now]
  );

  // vocab_grammar_links 
  await db.runAsync(
    `INSERT INTO vocab_grammar_links (grammar_point_id, vocab_form_id, created_at) VALUES (?, ?, ?);`,
    [1, 2, now] 
  );

  // Concepts + lesson mapping (ref_id must be set; kind/ref_id is unique)
  await db.runAsync(
    `INSERT INTO concepts (kind, ref_id, language_id, slug, title, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    ["vocab_sense", 1, 2, "privet-hello", "привет — hello", "Informal greeting", now]
  );
  await db.runAsync(
    `INSERT INTO concepts (kind, ref_id, language_id, slug, title, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    ["vocab_sense", 2, 2, "kniga-book", "книга — book", "Common noun", now]
  );
  await db.runAsync(
    `INSERT INTO concepts (kind, ref_id, language_id, slug, title, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    ["grammar_point", 1, 2, "nom-vs-gen-a1", "Nominative vs Genitive (A1)", "Basic case contrast", now]
  );

  await db.runAsync(
    `INSERT INTO lessons (language_id, title, description, cefr_level_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, "Greetings & Introductions", "Core greeting vocab + basic grammar", 1, 1, now, now]
  );

  await db.runAsync(`INSERT INTO lesson_concepts (lesson_id, concept_id, order_in_lesson, created_at) VALUES (?, ?, ?, ?);`, [1, 1, 1, now]);
  await db.runAsync(`INSERT INTO lesson_concepts (lesson_id, concept_id, order_in_lesson, created_at) VALUES (?, ?, ?, ?);`, [1, 2, 2, now]);
  await db.runAsync(`INSERT INTO lesson_concepts (lesson_id, concept_id, order_in_lesson, created_at) VALUES (?, ?, ?, ?);`, [1, 3, 3, now]);

  // Practice session + attempts
  await db.runAsync(
    `INSERT INTO practice_sessions (language_id, user_id, started_at, completed_at, modality, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [2, 1, now, now, "quiz", "seed", "Seeded practice session"]
  );

  await db.runAsync(
    `INSERT INTO practice_attempts (session_id, user_id, modality, type, prompt_text, question_json, user_response_json, evaluation_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      1, 1, "reading", "mcq", 'Translate: "привет"',
      JSON.stringify({ question: "Translate: привет", choices: ["Hello", "Goodbye", "Please"], answerIndex: 0 }),
      JSON.stringify({ choiceIndex: 0 }),
      JSON.stringify({ isCorrect: true, score: 1 }),
      now
    ]
  );

  await db.runAsync(
    `INSERT INTO practice_attempt_concepts (attempt_id, concept_id, score, is_correct, weight, evidence_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [1, 1, 1.0, 1, 1.0, JSON.stringify({ reason: "Correct choice" }), now]
  );

  // Quests (what you want to show in-app)
  await db.runAsync(
    `INSERT INTO quests (user_id, quest_type, title, description, status, due_at, completed_at, xp_reward, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [1, "daily_practice", "Do 3 quick reviews", "Complete 3 practice attempts today.", "pending", null, null, 30, JSON.stringify({ targetAttempts: 3 }), now]
  );
  await db.runAsync(
    `INSERT INTO quests (user_id, quest_type, title, description, status, due_at, completed_at, xp_reward, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [1, "lesson_read", "Read Lesson 1", "Open and read “Greetings & Introductions”.", "pending", null, null, 20, JSON.stringify({ lessonId: 1 }), now]
  );

  // Achievements + features
  await db.runAsync(
    `INSERT INTO achievements (code, title, description, points_awarded, created_at) VALUES (?, ?, ?, ?, ?);`,
    ["FIRST_PRACTICE", "First Practice", "Complete your first practice attempt.", 10, now]
  );

  await db.runAsync(
    `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?);`,
    [1, 1, now]
  );

  await db.runAsync(
    `INSERT INTO features (code, name, description, cost_points, slot_cost, min_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    ["FEATURE_DAILY_QUESTS", "Daily Quests", "Enables daily quest list UI.", 0, 1, 1, now]
  );

  await db.runAsync(
    `INSERT INTO user_features (user_id, feature_id, purchased_at, is_equipped) VALUES (?, ?, ?, ?);`,
    [1, 1, now, 1]
  );

  await db.runAsync(
    `INSERT INTO feature_unlock_requirements (feature_id, achievement_id) VALUES (?, ?);`,
    [1, 1]
  );

  await db.runAsync(
    `
    INSERT INTO user_concept_mastery (
      user_id,
      concept_id,
      modality,
      model_key,
      mastery,
      attempts_count,
      correct_count,
      last_attempt_at,
      updated_at
    ) VALUES
      -- привет (hello)
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?),

      -- книга (book)
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?),

      -- Nominative vs Genitive (grammar)
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?)
    `,
    [
      // привет
      1, 1, 'reading',   'ema_v1', 0.85, 10, 9, '2026-01-06T14:30:00.000Z', '2026-01-06T15:00:00.000Z',
      1, 1, 'listening', 'ema_v1', 0.90, 8,  8, '2026-01-06T14:25:00.000Z', '2026-01-06T15:00:00.000Z',
      1, 1, 'speaking',  'ema_v1', 0.55, 6,  4, '2026-01-06T14:20:00.000Z', '2026-01-06T15:00:00.000Z',
      1, 1, 'writing',   'ema_v1', 0.60, 5,  4, '2026-01-06T14:15:00.000Z', '2026-01-06T15:00:00.000Z',

      // книга
      1, 2, 'reading',   'ema_v1', 0.70, 9,  7, '2026-01-06T14:40:00.000Z', '2026-01-06T15:00:00.000Z',
      1, 2, 'listening', 'ema_v1', 0.65, 7,  5, '2026-01-06T14:35:00.000Z', '2026-01-06T15:00:00.000Z',
      1, 2, 'speaking',  'ema_v1', 0.40, 6,  3, '2026-01-06T14:30:00.000Z', '2026-01-06T15:00:00.000Z',
      1, 2, 'writing',   'ema_v1', 0.45, 6,  3, '2026-01-06T14:25:00.000Z', '2026-01-06T15:00:00.000Z',

      // grammar: nominative vs genitive
      1, 3, 'reading',   'ema_v1', 0.55, 8,  5, '2026-01-06T14:50:00.000Z', '2026-01-06T15:00:00.000Z',
      1, 3, 'writing',   'ema_v1', 0.35, 6,  2, '2026-01-06T14:45:00.000Z', '2026-01-06T15:00:00.000Z'
    ]
  );

}
