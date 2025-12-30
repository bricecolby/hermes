export const schemaStatements: string[] = [
  "PRAGMA foreign_keys = ON;",

  `CREATE TABLE IF NOT EXISTS languages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,

    name        TEXT NOT NULL UNIQUE,
    code        TEXT NOT NULL UNIQUE,

    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );`,


  `CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT NOT NULL UNIQUE,
    learning_lang_id    INTEGER NOT NULL,
    native_lang_id      INTEGER NOT NULL,    

    xp                  INTEGER NOT NULL DEFAULT 0,
    level               INTEGER NOT NULL DEFAULT 1,
    current_stamina     INTEGER NOT NULL DEFAULT 100,
    stamina_updated_at  TEXT NOT NULL,

    perk_points         INTEGER NOT NULL DEFAULT 0,
    equip_slots         INTEGER NOT NULL DEFAULT 1,
    streak_count        INTEGER NOT NULL DEFAULT 0,
    last_login          TEXT NOT NULL,

    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,

    UNIQUE (username, learning_lang_id, native_lang_id),

    FOREIGN KEY (learning_lang_id) REFERENCES languages(id) ON DELETE CASCADE,
    FOREIGN KEY (native_lang_id)   REFERENCES languages(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS vocab_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id     INTEGER NOT NULL,

    base_form       TEXT NOT NULL,
    part_of_speech  TEXT NOT NULL,
    frequency_rank  INTEGER,
    frequency_band  INTEGER,
    usage_notes     TEXT,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,

    FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS vocab_senses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vocab_item_id   INTEGER NOT NULL,
    sense_index     INTEGER NOT NULL DEFAULT 1,

    definition      TEXT,
    translation     TEXT,
    usage_notes     TEXT,
    grammar_hint    TEXT,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,

    FOREIGN KEY (vocab_item_id) REFERENCES vocab_items(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS vocab_forms (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vocab_item_id   INTEGER NOT NULL,

    surface_form    TEXT NOT NULL,
    tense           TEXT,
    mood            TEXT,
    person          INTEGER,
    number          TEXT,
    gender          TEXT,
    "case"          TEXT,
    aspect          TEXT,
    degree          TEXT,
    is_irregular    INTEGER DEFAULT 0,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,

    FOREIGN KEY (vocab_item_id) REFERENCES vocab_items(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS vocab_examples (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    vocab_sense_id      INTEGER NOT NULL,
    vocab_form_id       INTEGER,
    example_text        TEXT NOT NULL,
    translation_text    TEXT,
    media_id            INTEGER,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,

    FOREIGN KEY (vocab_sense_id)    REFERENCES vocab_senses(id)  ON DELETE CASCADE,
    FOREIGN KEY (vocab_form_id)     REFERENCES vocab_forms(id)   ON DELETE SET NULL,
    FOREIGN KEY (media_id)          REFERENCES vocab_media(id)   ON DELETE SET NULL
  );`,

  `CREATE TABLE IF NOT EXISTS grammar_examples (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    grammar_point_id    INTEGER NOT NULL,

    example_text        TEXT NOT NULL,
    translation_text    TEXT,
    media_id            INTEGER,
    notes               TEXT,

    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,

    FOREIGN KEY (grammar_point_id)  REFERENCES grammar_points(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id)          REFERENCES vocab_media(id)    ON DELETE SET NULL
  );`,

  `CREATE TABLE IF NOT EXISTS vocab_tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,

    name        TEXT NOT NULL UNIQUE,
    description TEXT,

    created_at  TEXT NOT NULL
  );`,
  
  `CREATE TABLE IF NOT EXISTS vocab_item_tags (
    vocab_item_id   INTEGER NOT NULL,
    vocab_tag_id    INTEGER NOT NULL,

    PRIMARY KEY (vocab_item_id, vocab_tag_id),

    FOREIGN KEY (vocab_item_id) REFERENCES vocab_items(id)  ON DELETE CASCADE,
    FOREIGN KEY (vocab_tag_id)  REFERENCES vocab_tags(id)   ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS vocab_media (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    vocab_item_id    INTEGER NOT NULL,

    media_type       TEXT    NOT NULL, 
    uri              TEXT    NOT NULL,  
    description      TEXT,
    attribution      TEXT,

    created_at       TEXT    NOT NULL,
    updated_at       TEXT    NOT NULL,

    FOREIGN KEY (vocab_item_id) REFERENCES vocab_items(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS grammar_points (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id INTEGER NOT NULL,

    title       TEXT NOT NULL,
    summary     TEXT,
    explanation TEXT,
    usage_notes TEXT,

    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,

    FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS grammar_sections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id INTEGER NOT NULL,

    title       TEXT NOT NULL,
    description TEXT,
    parent_id   INTEGER,
    sort_order  INTEGER NOT NULL DEFAULT 0,

    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,

    FOREIGN KEY (language_id) REFERENCES languages(id)        ON DELETE CASCADE,
    FOREIGN KEY (parent_id)   REFERENCES grammar_sections(id) ON DELETE SET NULL
  );`,

  `CREATE TABLE IF NOT EXISTS grammar_point_sections (
    grammar_point_id    INTEGER NOT NULL,
    grammar_section_id  INTEGER NOT NULL,
    sort_order          INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (grammar_point_id, grammar_section_id),

    FOREIGN KEY (grammar_point_id)      REFERENCES grammar_points(id)   ON DELETE CASCADE,
    FOREIGN KEY (grammar_section_id)    REFERENCES grammar_sections(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS grammar_tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id INTEGER NOT NULL,

    name        TEXT NOT NULL,
    description TEXT,

    created_at  TEXT NOT NULL,

    UNIQUE (language_id, name),

    FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS grammar_point_tags (
    grammar_point_id    INTEGER NOT NULL,
    grammar_tag_id      INTEGER NOT NULL,

    PRIMARY KEY (grammar_point_id, grammar_tag_id),

    FOREIGN KEY (grammar_point_id)  REFERENCES grammar_points(id) ON DELETE CASCADE,
    FOREIGN KEY (grammar_tag_id)    REFERENCES grammar_tags(id)   ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS vocab_grammar_links (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    grammar_point_id INTEGER NOT NULL,

    vocab_item_id    INTEGER,
    vocab_sense_id   INTEGER,
    vocab_form_id    INTEGER,

    created_at       TEXT NOT NULL,

    CHECK (
        vocab_item_id IS NOT NULL OR
        vocab_sense_id IS NOT NULL OR
        vocab_form_id IS NOT NULL
    ),

    FOREIGN KEY (grammar_point_id) REFERENCES grammar_points(id) ON DELETE CASCADE,
    FOREIGN KEY (vocab_item_id)    REFERENCES vocab_items(id)    ON DELETE CASCADE,
    FOREIGN KEY (vocab_sense_id)   REFERENCES vocab_senses(id)   ON DELETE CASCADE,
    FOREIGN KEY (vocab_form_id)    REFERENCES vocab_forms(id)    ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS cefr_levels (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,

    level       TEXT NOT NULL UNIQUE,
    description TEXT,

    sort_order  INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS concepts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id     INTEGER NOT NULL,

    title           TEXT NOT NULL,
    description     TEXT,
    parent_id       INTEGER,
    cefr_level_id   INTEGER,
  
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,

    FOREIGN KEY (language_id)   REFERENCES languages(id)    ON DELETE CASCADE,
    FOREIGN KEY (parent_id)     REFERENCES concepts(id)     ON DELETE SET NULL,
    FOREIGN KEY (cefr_level_id) REFERENCES cefr_levels(id)  ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS concept_links (
    from_concept_id INTEGER NOT NULL,
    to_concept_id   INTEGER NOT NULL,
    link_type       TEXT NOT NULL,

    created_at      TEXT NOT NULL,

    PRIMARY KEY (from_concept_id, to_concept_id, link_type),

    FOREIGN KEY (from_concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
    FOREIGN KEY (to_concept_id)   REFERENCES concepts(id) ON DELETE CASCADE
  )`,
  
  `CREATE TABLE IF NOT EXISTS concept_vocab_items (
    concept_id      INTEGER NOT NULL,
    vocab_item_id   INTEGER NOT NULL,

    created_at      TEXT NOT NULL,

    PRIMARY KEY (concept_id, vocab_item_id),

    FOREIGN KEY (concept_id)      REFERENCES concepts(id)    ON DELETE CASCADE,
    FOREIGN KEY (vocab_item_id)   REFERENCES vocab_items(id) ON DELETE CASCADE

  )`,

  `CREATE TABLE IF NOT EXISTS concept_grammar_points (
    concept_id        INTEGER NOT NULL,
    grammar_point_id  INTEGER NOT NULL,

    created_at        TEXT NOT NULL,

    PRIMARY KEY (concept_id, grammar_point_id),

    FOREIGN KEY (concept_id)        REFERENCES concepts(id)       ON DELETE CASCADE,
    FOREIGN KEY (grammar_point_id)  REFERENCES grammar_points(id)  ON DELETE CASCADE

  )`,

  `CREATE TABLE IF NOT EXISTS practice_sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id   INTEGER NOT NULL,
    user_id       INTEGER NOT NULL,

    started_at    TEXT NOT NULL,
    completed_at  TEXT,

    modality      TEXT,
    source        TEXT,
    notes         TEXT,

    FOREIGN KEY (language_id)   REFERENCES languages(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)       REFERENCES users(id)      ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS practice_attempts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          INTEGER NOT NULL,
    user_id             INTEGER NOT NULL,

    modality            TEXT,
    prompt_text         TEXT,
    question_json       TEXT NOT NULL,
    user_response_json  TEXT,
    evaluation_json     TEXT,

    concept_id          INTEGER,
    vocab_item_id       INTEGER,
    vocab_sense_id      INTEGER,
    vocab_form_id       INTEGER,
    grammar_point_id    INTEGER,

    created_at          TEXT NOT NULL,

    FOREIGN KEY (session_id)  REFERENCES practice_sessions(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)              ON DELETE CASCADE,

    FOREIGN KEY (concept_id)        REFERENCES concepts(id)       ON DELETE SET NULL,
    FOREIGN KEY (vocab_item_id)     REFERENCES vocab_items(id)    ON DELETE SET NULL,
    FOREIGN KEY (vocab_sense_id)    REFERENCES vocab_senses(id)   ON DELETE SET NULL,
    FOREIGN KEY (vocab_form_id)     REFERENCES vocab_forms(id)    ON DELETE SET NULL,
    FOREIGN KEY (grammar_point_id)  REFERENCES grammar_points(id) ON DELETE SET NULL
  )`,

  
  `CREATE TABLE IF NOT EXISTS tasks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,

    task_type     TEXT NOT NULL,
    description   TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',
    due_at        TEXT,
    completed_at  TEXT,
    xp_reward     INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,

    created_at    TEXT NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS achievements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,

    code            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT,
    points_awarded  INTEGER NOT NULL DEFAULT 0,

    created_at      TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_achievements (
    user_id         INTEGER NOT NULL,
    achievement_id  INTEGER NOT NULL,
    unlocked_at     TEXT NOT NULL,

    PRIMARY KEY (user_id, achievement_id),

    FOREIGN KEY (user_id)           REFERENCES users(id)            ON DELETE CASCADE,
    FOREIGN KEY (achievement_id)    REFERENCES achievements(id)     ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS features (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,

    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,

    cost_points INTEGER NOT NULL DEFAULT 0,
    slot_cost   INTEGER NOT NULL DEFAULT 1,
    min_level   INTEGER NOT NULL DEFAULT 1,

    created_at  TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_features (
    user_id       INTEGER NOT NULL,
    feature_id    INTEGER NOT NULL,
    purchased_at  TEXT NOT NULL,
    is_equipped   INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (user_id, feature_id),

    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS feature_unlock_requirements (
    feature_id      INTEGER NOT NULL,
    achievement_id  INTEGER NOT NULL,

    PRIMARY KEY (feature_id, achievement_id),

    FOREIGN KEY (feature_id)      REFERENCES features(id)     ON DELETE CASCADE,
    FOREIGN KEY (achievement_id)  REFERENCES achievements(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_vocab_items_language_base
    ON vocab_items (language_id, base_form);`,

  `CREATE INDEX IF NOT EXISTS idx_vocab_forms_vocab_item
    ON vocab_forms (vocab_item_id);`,

  `CREATE INDEX IF NOT EXISTS idx_vocab_senses_vocab_item
    ON vocab_senses (vocab_item_id);`,

  `CREATE INDEX IF NOT EXISTS idx_vocab_examples_sense
    ON vocab_examples (vocab_sense_id);`,

  `CREATE INDEX IF NOT EXISTS idx_grammar_points_language_title
    ON grammar_points (language_id, title);`,

  `CREATE INDEX IF NOT EXISTS idx_grammar_sections_language_parent
    ON grammar_sections (language_id, parent_id);`,

  `CREATE INDEX IF NOT EXISTS idx_grammar_tags_language_name
    ON grammar_tags (language_id, name);`,

  `CREATE INDEX IF NOT EXISTS idx_concepts_language_parent
    ON concepts (language_id, parent_id);`,

  `CREATE INDEX IF NOT EXISTS idx_concepts_language_cefr
    ON concepts (language_id, cefr_level_id);`,

  `CREATE INDEX IF NOT EXISTS idx_concept_vocab_items_vocab_item
    ON concept_vocab_items (vocab_item_id);`,

  `CREATE INDEX IF NOT EXISTS idx_concept_grammar_points_grammar
    ON concept_grammar_points (grammar_point_id);`,

  `CREATE INDEX IF NOT EXISTS idx_attempts_user_time
    ON practice_attempts(user_id, created_at);`,

  `CREATE INDEX IF NOT EXISTS idx_attempts_vocab_sense
    ON practice_attempts(vocab_sense_id);`,

  `CREATE INDEX IF NOT EXISTS idx_attempts_grammar
    ON practice_attempts(grammar_point_id);`,

  `CREATE INDEX IF NOT EXISTS idx_attempts_concept
    ON practice_attempts(concept_id);`
];
