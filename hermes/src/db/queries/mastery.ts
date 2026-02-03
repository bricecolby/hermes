import type { SQLiteDatabase } from "expo-sqlite";
import type { EvaluationResult } from "shared/domain/practice/practiceItem";

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
