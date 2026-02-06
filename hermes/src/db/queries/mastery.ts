import type { SQLiteDatabase } from "expo-sqlite";
import type { EvaluationResult } from "shared/domain/practice/practiceItem";
import type { CefrLevel, ProgressMode, TierRules } from "./concepts";
import { DEFAULT_TIER_RULES } from "./concepts";

export type MasteryUpdateInput = {
  userId: number;
  attemptCreatedAtIso: string;

  modality: string;              // reception/production/interaction/mediation
  skill?: string | null;         // reading/writing/listening/speaking
  itemType: string;              // flashcard_v1.basic, mcq_v1.basic, ...
  responseMs?: number | null;

  conceptResults: NonNullable<EvaluationResult["conceptResults"]>;
};

const MODEL_KEY = "ema_v1";

// Accuracy EMA
const MASTERY_ALPHA = 0.15;

// RT avg smoothing 
const RT_BETA = 0.12;

// Half-life model defaults (days)
const H0_DAYS = 1.5;
const H_MIN_DAYS = 0.25;   // 6 hours
const H_MAX_DAYS = 365;

// scheduling target
const R_TARGET = 0.75;
// t = h * (-ln(R)/ln2)
const LN2 = Math.log(2);

// Half-life multipliers 
const SUCCESS_HARD = 1.7;  
const SUCCESS_EASY = 1.25;
const FAIL_LATE_DIV = 1.7; 
const FAIL_EARLY_DIV = 1.25;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function parseIso(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function daysBetween(aIso: string, bIso: string) {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  return Math.max(0, (b - a) / (1000 * 60 * 60 * 24));
}

function computeDueLagDays(hDays: number) {
  return hDays * (-Math.log(R_TARGET) / LN2); // 0.415*h for R=0.75
}

function addDaysIso(fromIso: string, days: number) {
  const t = Date.parse(fromIso);
  return new Date(t + days * 24 * 60 * 60 * 1000).toISOString();
}

async function upsertMasteryRow(
  db: SQLiteDatabase,
  keys: { userId: number; conceptId: number; modality: string }
) {
  await db.runAsync(
    `INSERT INTO user_concept_mastery (
      user_id, concept_id, modality, model_key,
      mastery, rt_avg_ms, rt_norm, half_life_days, due_at,
      attempts_count, correct_count,
      last_attempt_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, 0, 0, NULL, ?)
    ON CONFLICT(user_id, concept_id, modality, model_key) DO NOTHING`,
    [
      keys.userId,
      keys.conceptId,
      keys.modality,
      MODEL_KEY,
      0.5,
      H0_DAYS,
      addDaysIso(new Date().toISOString(), 1), // placeholder; will be overwritten after first update
      new Date().toISOString(),
    ]
  );
}

async function getMasteryRow(
  db: SQLiteDatabase,
  keys: { userId: number; conceptId: number; modality: string }
) {
  return await db.getFirstAsync<{
    mastery: number;
    rt_avg_ms: number | null;
    rt_norm: number | null;
    half_life_days: number | null;
    due_at: string | null;
    attempts_count: number;
    correct_count: number;
    last_attempt_at: string | null;
  }>(
    `SELECT mastery, rt_avg_ms, rt_norm, half_life_days, due_at,
            attempts_count, correct_count, last_attempt_at
     FROM user_concept_mastery
     WHERE user_id=? AND concept_id=? AND modality=? AND model_key=?`,
    [keys.userId, keys.conceptId, keys.modality, MODEL_KEY]
  );
}

async function upsertAndUpdateRtBaseline(
  db: SQLiteDatabase,
  params: {
    userId: number;
    itemType: string;
    skill?: string | null;
    modality: string;
    responseMs: number;
    updatedAtIso: string;
  }
) {
  const { userId, itemType, skill = null, modality, responseMs, updatedAtIso } = params;

  await db.runAsync(
    `INSERT INTO user_rt_baseline (user_id, item_type, skill, modality, rt_avg_ms, samples, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(user_id, item_type, skill, modality) DO UPDATE SET
       rt_avg_ms = CASE
         WHEN user_rt_baseline.rt_avg_ms IS NULL THEN excluded.rt_avg_ms
         ELSE user_rt_baseline.rt_avg_ms + ? * (excluded.rt_avg_ms - user_rt_baseline.rt_avg_ms)
       END,
       samples = user_rt_baseline.samples + 1,
       updated_at = excluded.updated_at`,
    [
      userId,
      itemType,
      skill,
      modality,
      responseMs,
      updatedAtIso,
      RT_BETA,
    ]
  );
}

async function getRtBaselineAvg(
  db: SQLiteDatabase,
  params: { userId: number; itemType: string; skill?: string | null; modality: string }
) {
  const { userId, itemType, skill = null, modality } = params;
  const row = await db.getFirstAsync<{ rt_avg_ms: number | null }>(
    `SELECT rt_avg_ms
     FROM user_rt_baseline
     WHERE user_id=? AND item_type=? AND skill IS ? AND modality=?`,
    [userId, itemType, skill, modality]
  );
  return row?.rt_avg_ms ?? null;
}

function updateHalfLifeDays(params: {
  oldHDays: number;
  lastLagDays: number;
  isCorrect: boolean;
}) {
  const { oldHDays, lastLagDays, isCorrect } = params;

  // predicted recall at review time
  const R_pred = Math.pow(2, -lastLagDays / oldHDays);

  let hNew = oldHDays;

  if (isCorrect) {
    hNew *= R_pred <= 0.9 ? SUCCESS_HARD : SUCCESS_EASY;
  } else {
    const late = lastLagDays >= 0.5 * oldHDays;
    hNew /= late ? FAIL_LATE_DIV : FAIL_EARLY_DIV;
  }

  return clamp(hNew, H_MIN_DAYS, H_MAX_DAYS);
}

export async function applyAttemptToMasteryForConcepts(
  db: SQLiteDatabase,
  input: MasteryUpdateInput
) {
  const {
    userId,
    attemptCreatedAtIso,
    modality,
    skill = null,
    itemType,
    responseMs = null,
    conceptResults,
  } = input;

  if (!conceptResults?.length) return;

  for (const cr of conceptResults) {
    const conceptId = cr.conceptId;
    const isCorrect = cr.isCorrect ? 1 : 0;

    await upsertMasteryRow(db, { userId, conceptId, modality });
    const row = await getMasteryRow(db, { userId, conceptId, modality });

    const masteryOld = row?.mastery ?? 0.5;
    const masteryNew = masteryOld + MASTERY_ALPHA * ((isCorrect ? 1 : 0) - masteryOld);

    // half-life update
    const oldHDays = row?.half_life_days ?? H0_DAYS;

    // lag based on last_attempt_at (if none, treat as 1 day bootstrap)
    const lastAttemptIso = row?.last_attempt_at;
    const lagDays =
      lastAttemptIso ? daysBetween(lastAttemptIso, attemptCreatedAtIso) : 1.0;

    const hNew = updateHalfLifeDays({
      oldHDays,
      lastLagDays: lagDays,
      isCorrect: Boolean(isCorrect),
    });

    const dueLag = computeDueLagDays(hNew);
    const dueAtIso = addDaysIso(attemptCreatedAtIso, dueLag);

    // RT updates (correct-only recommended)
    let rtAvgNew: number | null = row?.rt_avg_ms ?? null;
    let rtNormNew: number | null = row?.rt_norm ?? null;

    if (responseMs != null && isCorrect === 1) {
      // baseline update first
      await upsertAndUpdateRtBaseline(db, {
        userId,
        itemType,
        skill,
        modality,
        responseMs,
        updatedAtIso: attemptCreatedAtIso,
      });

      // concept-level running avg
      rtAvgNew =
        rtAvgNew == null ? responseMs : rtAvgNew + RT_BETA * (responseMs - rtAvgNew);

      const baseline = await getRtBaselineAvg(db, { userId, itemType, skill, modality });
      rtNormNew = baseline && baseline > 0 ? rtAvgNew / baseline : null;
    }

    await db.runAsync(
      `UPDATE user_concept_mastery
       SET
         mastery = ?,
         rt_avg_ms = ?,
         rt_norm = ?,
         half_life_days = ?,
         due_at = ?,
         attempts_count = attempts_count + 1,
         correct_count = correct_count + CASE WHEN ?=1 THEN 1 ELSE 0 END,
         last_attempt_at = ?,
         updated_at = ?
       WHERE user_id=? AND concept_id=? AND modality=? AND model_key=?`,
      [
        masteryNew,
        rtAvgNew,
        rtNormNew,
        hNew,
        dueAtIso,
        isCorrect,
        attemptCreatedAtIso,
        attemptCreatedAtIso,
        userId,
        conceptId,
        modality,
        MODEL_KEY,
      ]
    );
  }
}

export type ConceptMasteryRow = {
  modality: string;
  mastery: number;
  rt_avg_ms: number | null;
  rt_norm: number | null;
  half_life_days: number | null;
  due_at: string | null;
  attempts_count: number;
  correct_count: number;
  last_attempt_at: string | null;
  updated_at: string;
};

export async function listMasteryForConcept(
  db: SQLiteDatabase,
  args: { userId: number; conceptId: number; modelKey?: string }
): Promise<ConceptMasteryRow[]> {
  const { userId, conceptId, modelKey = MODEL_KEY } = args;

  return db.getAllAsync<ConceptMasteryRow>(
    `SELECT
       modality,
       mastery,
       rt_avg_ms,
       rt_norm,
       half_life_days,
       due_at,
       attempts_count,
       correct_count,
       last_attempt_at,
       updated_at
     FROM user_concept_mastery
     WHERE user_id = ? AND concept_id = ? AND model_key = ?;`,
    [userId, conceptId, modelKey]
  );
}

export type CefrProgressRow = {
  cefr: CefrLevel;
  total: number;
  exposed: number;
  mastery: number;
  fluency: number;
  automaticity: number;
};

export type CefrProgressByModalityRow = {
  cefr: CefrLevel;
  reception: CefrProgressRow;
  production: CefrProgressRow;
};

type CefrModality = "reception" | "production";

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

function fillMissingCefrRows(rows: CefrProgressRow[]): CefrProgressRow[] {
  const order: CefrLevel[] = ["CEFR:A1", "CEFR:A2", "CEFR:B1", "CEFR:B2", "CEFR:C1", "CEFR:C2"];
  const by = new Map(rows.map((r) => [r.cefr, r]));
  return order.map(
    (cefr) =>
      by.get(cefr) ?? ({
        cefr,
        total: 0,
        exposed: 0,
        mastery: 0,
        fluency: 0,
        automaticity: 0,
      } as CefrProgressRow)
  );
}

async function getVocabCefrProgressForModality(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    modality: CefrModality;
    rules?: TierRules;
  }
): Promise<CefrProgressRow[]> {
  const { userId, languageId, modelKey, modality, rules = DEFAULT_TIER_RULES } = args;

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
       AND ucm.modality = ?
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
    [userId, modelKey, modality, languageId]
  );

  return fillMissingCefrRows(rows);
}

async function getGrammarCefrProgressForModality(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    modality: CefrModality;
    rules?: TierRules;
  }
): Promise<CefrProgressRow[]> {
  const { userId, languageId, modelKey, modality, rules = DEFAULT_TIER_RULES } = args;

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
       AND ucm.modality = ?
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
    [userId, modelKey, modality, languageId]
  );

  return fillMissingCefrRows(rows);
}

async function getCefrProgressForModality(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    modality: CefrModality;
    mode: ProgressMode;
    rules?: TierRules;
  }
): Promise<CefrProgressRow[]> {
  const { mode, ...rest } = args;

  if (mode === "vocab") return getVocabCefrProgressForModality(db, rest);
  if (mode === "grammar") return getGrammarCefrProgressForModality(db, rest);

  const [v, g] = await Promise.all([
    getVocabCefrProgressForModality(db, rest),
    getGrammarCefrProgressForModality(db, rest),
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

export async function getCefrProgressByModality(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    mode: ProgressMode;
    rules?: TierRules;
  }
): Promise<CefrProgressByModalityRow[]> {
  const [reception, production] = await Promise.all([
    getCefrProgressForModality(db, { ...args, modality: "reception" }),
    getCefrProgressForModality(db, { ...args, modality: "production" }),
  ]);

  return reception.map((row, i) => ({
    cefr: row.cefr,
    reception: row,
    production: production[i],
  }));
}
