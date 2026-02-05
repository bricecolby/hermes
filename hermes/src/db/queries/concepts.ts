import type { SQLiteDatabase } from "expo-sqlite";

export type ConceptKind = "vocab_item" | "grammar_point";
export type CefrLevel = "CEFR:A1" | "CEFR:A2" | "CEFR:B1" | "CEFR:B2" | "CEFR:C1" | "CEFR:C2";
export type ProgressMode = "vocab" | "grammar" | "both";


export type ConceptRefRow = {
  conceptId: number;
  kind: ConceptKind;
  refId: number;
  title: string | null;
  description: string | null;
};

export type DueConceptRefRow = ConceptRefRow & {
  modality: string;
  dueAt: string | null;
};

export type MasteryOrder = "asc" | "desc";

export type CefrProgressRow = {
  cefr: CefrLevel;
  total: number;
  exposed: number;
  mastery: number;
  fluency: number;
  automaticity: number;
};

export type TierRules = {
  masteryMin: number;
  fluencyMin: number;
  autoMin: number;
  fluencyRtNormMax: number;
  autoRtNormMax: number;
};

export const DEFAULT_TIER_RULES: TierRules = {
  masteryMin: 0.80,
  fluencyMin: 0.9,
  autoMin: 0.95,
  fluencyRtNormMax: 1.15,
  autoRtNormMax: 1.00,
};

function tierCaseSql(rules: TierRules) {
  // tier order: 0 not exposed, 1 mastery, 2 fluency, 3 automaticity
  return `
    CASE
      WHEN exposed = 0 THEN 0
      WHEN mastery_max >= ${rules.autoMin}
           AND rt_norm_min IS NOT NULL
           AND rt_norm_min <= ${rules.autoRtNormMax} THEN 3
      WHEN mastery_max >= ${rules.fluencyMin}
           AND rt_norm_min IS NOT NULL
           AND rt_norm_min <= ${rules.fluencyRtNormMax} THEN 2
      WHEN mastery_max >= ${rules.masteryMin} THEN 1
      ELSE 0
    END
  `;
}

export async function getVocabCefrProgress(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    rules?: TierRules;
  }
): Promise<CefrProgressRow[]> {
  const { userId, languageId, modelKey, rules = DEFAULT_TIER_RULES } = args;

  const tierExpr = tierCaseSql(rules);

  const rows = await db.getAllAsync<CefrProgressRow>(
    `
    WITH per_concept AS (
      SELECT
        c.id AS conceptId,
        vt.name AS cefr,
        CASE WHEN COUNT(ucm.concept_id) > 0 THEN 1 ELSE 0 END AS exposed,
        MAX(ucm.mastery) AS mastery_max,
        MIN(ucm.rt_norm) AS rt_norm_min
      FROM concepts c
      JOIN vocab_items vi
        ON c.kind = 'vocab_item'
       AND c.ref_id = vi.id
       AND c.language_id = vi.language_id
      JOIN vocab_item_tags vit
        ON vit.vocab_item_id = vi.id
      JOIN vocab_tags vt
        ON vt.id = vit.vocab_tag_id
      LEFT JOIN user_concept_mastery ucm
        ON ucm.concept_id = c.id
       AND ucm.user_id = ?
       AND ucm.model_key = ?
      WHERE c.language_id = ?
        AND c.kind = 'vocab_item'
        AND vt.name IN ('CEFR:A1','CEFR:A2','CEFR:B1','CEFR:B2','CEFR:C1','CEFR:C2')
      GROUP BY c.id, vt.name
    ),
    tiered AS (
      SELECT
        conceptId,
        cefr,
        exposed,
        ${tierExpr} AS tier
      FROM per_concept
    )
    SELECT
      cefr AS cefr,
      COUNT(*) AS total,
      SUM(exposed) AS exposed,
      SUM(CASE WHEN tier >= 1 THEN 1 ELSE 0 END) AS mastery,
      SUM(CASE WHEN tier >= 2 THEN 1 ELSE 0 END) AS fluency,
      SUM(CASE WHEN tier >= 3 THEN 1 ELSE 0 END) AS automaticity
    FROM tiered
    GROUP BY cefr
    ORDER BY
      CASE cefr
        WHEN 'CEFR:A1' THEN 1
        WHEN 'CEFR:A2' THEN 2
        WHEN 'CEFR:B1' THEN 3
        WHEN 'CEFR:B2' THEN 4
        WHEN 'CEFR:C1' THEN 5
        WHEN 'CEFR:C2' THEN 6
        ELSE 999
      END ASC;
    `,
    [userId, modelKey, languageId]
  );

  return fillMissingCefrRows(rows);
}



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

export async function getConceptRefsByMastery(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    limit: number;
    order?: MasteryOrder;
  }
): Promise<ConceptRefRow[]> {
  const { userId, languageId, modelKey, limit, order = "desc" } = args;
  const dir = order === "asc" ? "ASC" : "DESC";

  return db.getAllAsync<ConceptRefRow>(
    `
    SELECT
      c.id           AS conceptId,
      c.kind         AS kind,
      c.ref_id       AS refId,
      c.title        AS title,
      c.description  AS description
    FROM user_concept_mastery ucm
    JOIN concepts c
      ON c.id = ucm.concept_id
     AND c.language_id = ?
    WHERE ucm.user_id = ?
      AND ucm.model_key = ?
    GROUP BY c.id
    ORDER BY MAX(ucm.mastery) ${dir}, RANDOM()
    LIMIT ?;
    `,
    [languageId, userId, modelKey, limit]
  );
}

export async function getConceptMetaByRef(
  db: SQLiteDatabase,
  args: { kind: ConceptKind; refId: number }
): Promise<{ conceptId: number; createdAt: string } | null> {
  const { kind, refId } = args;

  return db.getFirstAsync<{ conceptId: number; createdAt: string }>(
    `SELECT id AS conceptId, created_at AS createdAt
     FROM concepts
     WHERE kind = ? AND ref_id = ?
     LIMIT 1;`,
    [kind, refId]
  );
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


function cefrRankCaseSql(tagAlias: string) {
  return `
    CASE ${tagAlias}.name
      WHEN 'CEFR:A1' THEN 1
      WHEN 'CEFR:A2' THEN 2
      WHEN 'CEFR:B1' THEN 3
      WHEN 'CEFR:B2' THEN 4
      WHEN 'CEFR:C1' THEN 5
      WHEN 'CEFR:C2' THEN 6
      ELSE 999
    END
  `;
}

/**
 * Learn selector for vocab concepts:
 * - only vocab concepts
 * - exclude concepts that already exist in user_concept_mastery (any modality)
 * - optionally filter by CEFR tags (vt.name)
 */
export async function getFreshVocabConceptRefsForLearn(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    limit: number;
  }
): Promise<ConceptRefRow[]> {
  const { userId, languageId, modelKey, limit } = args;

  const rankExpr = cefrRankCaseSql("vt");

  return db.getAllAsync<ConceptRefRow>(
    `
    SELECT
      c.id              AS conceptId,
      c.kind            AS kind,
      c.ref_id          AS refId,
      c.title           AS title,
      c.description     AS description,
      MIN(${rankExpr})  AS cefr_rank
    FROM  concepts c
    JOIN  vocab_items vi
      ON    c.kind = 'vocab_item'
      AND   c.ref_id = vi.id
      AND   c.language_id = vi.language_id
    JOIN  vocab_item_tags vit
      ON    vit.vocab_item_id = vi.id
    JOIN  vocab_tags vt
      ON    vt.id = vit.vocab_tag_id
    WHERE c.language_id = ?
      AND c.kind = 'vocab_item'
      AND vt.name IN ('CEFR:A1', 'CEFR:A2', 'CEFR:B1', 'CEFR:B2', 'CEFR:C1', 'CEFR:C2')
      AND NOT EXISTS (
        SELECT 1
        FROM user_concept_mastery ucm
        WHERE ucm.user_id = ?
          AND ucm.concept_id = c.id
          AND ucm.model_key = ?
      )
    GROUP BY c.id
    ORDER BY cefr_rank ASC, RANDOM()
    LIMIT ?;
    `,
    [languageId, userId, modelKey, limit]
  );
}

/**
 * Review selector for any concepts:
 * - any concept kind (vocab or grammar)
 * - only concepts with due_at in the past (per modality)
 */
export async function getDueConceptRefsForReview(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    limit: number;
    dueBeforeIso: string;
  }
): Promise<DueConceptRefRow[]> {
  const { userId, languageId, modelKey, limit, dueBeforeIso } = args;

  return db.getAllAsync<DueConceptRefRow>(
    `
    SELECT
      c.id           AS conceptId,
      c.kind         AS kind,
      c.ref_id       AS refId,
      c.title        AS title,
      c.description  AS description,
      ucm.modality   AS modality,
      ucm.due_at     AS dueAt
    FROM user_concept_mastery ucm
    JOIN concepts c
      ON c.id = ucm.concept_id
     AND c.language_id = ?
    WHERE ucm.user_id = ?
      AND ucm.model_key = ?
      AND ucm.due_at IS NOT NULL
      AND ucm.due_at <= ?
    ORDER BY ucm.due_at ASC
    LIMIT ?;
    `,
    [languageId, userId, modelKey, dueBeforeIso, limit]
  );
}

export async function getDueConceptRefsForApply(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    limit: number;
    dueBeforeIso: string;
  }
): Promise<DueConceptRefRow[]> {
  const { userId, languageId, modelKey, limit, dueBeforeIso } = args;

  return db.getAllAsync<DueConceptRefRow>(
    `
    SELECT
      c.id           AS conceptId,
      c.kind         AS kind,
      c.ref_id       AS refId,
      c.title        AS title,
      c.description  AS description,
      ucm.modality   AS modality,
      ucm.due_at     AS dueAt
    FROM user_concept_mastery ucm
    JOIN concepts c
      ON c.id = ucm.concept_id
     AND c.language_id = ?
    WHERE ucm.user_id = ?
      AND ucm.model_key = ?
      AND ucm.modality = 'production'
      AND ucm.due_at IS NOT NULL
      AND ucm.due_at <= ?
    ORDER BY ucm.due_at ASC
    LIMIT ?;
    `,
    [languageId, userId, modelKey, dueBeforeIso, limit]
  );
}

export async function getGrammarCefrProgress(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    rules?: TierRules;
  }
): Promise<CefrProgressRow[]> {
  const { userId, languageId, modelKey, rules = DEFAULT_TIER_RULES } = args;

  const tierExpr = tierCaseSql(rules);

  const rows = await db.getAllAsync<CefrProgressRow>(
    `
    WITH per_concept AS (
      SELECT
        c.id AS conceptId,
        gt.name AS cefr,
        CASE WHEN COUNT(ucm.concept_id) > 0 THEN 1 ELSE 0 END AS exposed,
        MAX(ucm.mastery) AS mastery_max,
        MIN(ucm.rt_norm) AS rt_norm_min
      FROM concepts c
      JOIN grammar_points gp
        ON c.kind = 'grammar_point'
       AND c.ref_id = gp.id
       AND c.language_id = gp.language_id
      JOIN grammar_point_tags gpt
        ON gpt.grammar_point_id = gp.id
      JOIN grammar_tags gt
        ON gt.id = gpt.grammar_tag_id
       AND gt.language_id = gp.language_id
      LEFT JOIN user_concept_mastery ucm
        ON ucm.concept_id = c.id
       AND ucm.user_id = ?
       AND ucm.model_key = ?
      WHERE c.language_id = ?
        AND c.kind = 'grammar_point'
        AND gt.name IN ('CEFR:A1','CEFR:A2','CEFR:B1','CEFR:B2','CEFR:C1','CEFR:C2')
      GROUP BY c.id, gt.name
    ),
    tiered AS (
      SELECT
        conceptId,
        cefr,
        exposed,
        ${tierExpr} AS tier
      FROM per_concept
    )
    SELECT
      cefr AS cefr,
      COUNT(*) AS total,
      SUM(exposed) AS exposed,
      SUM(CASE WHEN tier >= 1 THEN 1 ELSE 0 END) AS mastery,
      SUM(CASE WHEN tier >= 2 THEN 1 ELSE 0 END) AS fluency,
      SUM(CASE WHEN tier >= 3 THEN 1 ELSE 0 END) AS automaticity
    FROM tiered
    GROUP BY cefr
    ORDER BY
      CASE cefr
        WHEN 'CEFR:A1' THEN 1
        WHEN 'CEFR:A2' THEN 2
        WHEN 'CEFR:B1' THEN 3
        WHEN 'CEFR:B2' THEN 4
        WHEN 'CEFR:C1' THEN 5
        WHEN 'CEFR:C2' THEN 6
        ELSE 999
      END ASC;
    `,
    [userId, modelKey, languageId]
  );

  return fillMissingCefrRows(rows);
}

function fillMissingCefrRows(rows: CefrProgressRow[]): CefrProgressRow[] {
  const order: CefrLevel[] = ["CEFR:A1","CEFR:A2","CEFR:B1","CEFR:B2","CEFR:C1","CEFR:C2"];
  const by = new Map(rows.map(r => [r.cefr, r]));
  return order.map((cefr) => by.get(cefr) ?? ({
    cefr, total: 0, exposed: 0, mastery: 0, fluency: 0, automaticity: 0
  }));
}

export async function getCefrProgress(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    mode: ProgressMode;
    rules?: TierRules;
  }
): Promise<CefrProgressRow[]> {
  const { mode, ...rest } = args;

  if (mode === "vocab") return getVocabCefrProgress(db, rest);
  if (mode === "grammar") return getGrammarCefrProgress(db, rest);

  const [v, g] = await Promise.all([
    getVocabCefrProgress(db, rest),
    getGrammarCefrProgress(db, rest),
  ]);

  return v.map((vr, i) => {
    const gr = g[i];
    return {
      cefr: vr.cefr,
      total: vr.total + gr.total,
      exposed: vr.exposed + gr.exposed,
      mastery: vr.mastery + gr.mastery,
      fluency: vr.fluency + gr.fluency,
      automaticity: vr.automaticity + gr.automaticity,
    };
  });
}


/**
 * Learn selector for grammar concepts:
 * - only grammar concepts
 * - exclude concepts that already exist in user_concept_mastery (any modality)
 * - optionally filter by CEFR tags (vt.name)
 */
export async function getFreshGrammarConceptRefsForLearn(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    limit: number;
  }
): Promise<ConceptRefRow[]> {
  const { userId, languageId, modelKey, limit } = args;

  const rankExpr = cefrRankCaseSql("gt");

  return db.getAllAsync<ConceptRefRow>(
    `
    SELECT
      c.id           AS conceptId,
      c.kind         AS kind,
      c.ref_id       AS refId,
      c.title        AS title,
      c.description  AS description,
      MIN(${rankExpr}) AS cefr_rank
    FROM concepts c
    JOIN grammar_points gp
      ON c.kind = 'grammar_point'
     AND c.ref_id = gp.id
     AND c.language_id = gp.language_id
    JOIN grammar_point_tags gpt
      ON gpt.grammar_point_id = gp.id
    JOIN grammar_tags gt
      ON gt.id = gpt.grammar_tag_id
     AND gt.language_id = gp.language_id
    WHERE c.language_id = ?
      AND c.kind = 'grammar_point'
      AND gt.name IN ('CEFR:A1','CEFR:A2','CEFR:B1','CEFR:B2','CEFR:C1','CEFR:C2')
      AND NOT EXISTS (
        SELECT 1
        FROM user_concept_mastery ucm
        WHERE ucm.user_id = ?
          AND ucm.concept_id = c.id
          AND ucm.model_key = ?
      )
    GROUP BY c.id
    ORDER BY cefr_rank ASC, RANDOM()
    LIMIT ?;
    `,
    [languageId, userId, modelKey, limit]
  );
}
