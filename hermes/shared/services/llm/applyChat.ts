import { z } from "zod";
import type { SQLiteDatabase } from "expo-sqlite";

import {
  getConceptRefsByMastery,
  getDueConceptRefsForApply,
  type ConceptRefRow,
} from "@/db/queries/concepts";

export const APPLY_STOP_WORDS = ["```", "\n```", "\n\n```", "</s>"];

const ApplyLlmResponseSchema = z.object({
  assistantMessage: z.string().min(1),
  correction: z
    .object({
      text: z.string().min(1),
      notes: z.string().optional(),
    })
    .nullable()
    .optional(),
  evaluation: z.object({
    isCorrect: z.boolean().optional(),
    score: z.number().optional(),
    feedback: z.string().optional(),
    conceptResults: z
      .array(
        z.object({
          conceptId: z.number().finite(),
          isCorrect: z.boolean().optional(),
          score: z.number().optional(),
          maxScore: z.number().optional(),
          evidence: z.record(z.string(), z.any()).optional(),
        })
      )
      .nullable()
      .optional(),
  }),
});

const ApplyEvaluationSchema = z.object({
  correction: z
    .object({
      text: z.string().min(1),
      notes: z.string().optional(),
    })
    .nullable()
    .optional(),
  evaluation: z.object({
    isCorrect: z.boolean().optional(),
    score: z.number().optional(),
    feedback: z.string().optional(),
    conceptResults: z
      .array(
        z.object({
          conceptId: z.number().finite(),
          isCorrect: z.boolean().optional(),
          score: z.number().optional(),
          maxScore: z.number().optional(),
          evidence: z.record(z.string(), z.any()).optional(),
        })
      )
      .nullable()
      .optional(),
  }),
});

export type ApplyChatContext = {
  knownVocab: ConceptRefRow[];
  knownGrammar: ConceptRefRow[];
  targets: ConceptRefRow[];
};

export type ApplyChatEvaluation = {
  isCorrect?: boolean;
  score: number;
  feedback?: string;
  conceptResults: Array<{
    conceptId: number;
    isCorrect: boolean;
    score: number;
    maxScore: number;
    evidence?: Record<string, unknown>;
  }>;
};

export type ApplyChatTurn = {
  assistantMessage: string;
  correction: string | null;
  evaluation: ApplyChatEvaluation;
  rawText: string;
};

function extractLikelyJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function tryBalanceJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  const slice = text.slice(start);
  let depth = 0;
  for (const ch of slice) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }
  if (depth <= 0) return slice;
  return slice + "}".repeat(depth);
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeScore(score: number | undefined | null) {
  if (score == null || !Number.isFinite(score)) return 0;
  if (score > 1 && score <= 100) return clamp(score / 100, 0, 1);
  return clamp(score, 0, 1);
}

function normalizeConceptResults(input: any): ApplyChatEvaluation["conceptResults"] {
  if (!Array.isArray(input)) return [];
  return input
    .map((cr) => ({
      conceptId: Number(cr?.conceptId ?? NaN),
      isCorrect: Boolean(cr?.isCorrect ?? false),
      score: normalizeScore(cr?.score ?? 0),
      maxScore: Number.isFinite(cr?.maxScore) ? Number(cr?.maxScore) : 1,
      evidence: cr?.evidence && typeof cr.evidence === "object" ? cr.evidence : undefined,
    }))
    .filter((cr) => Number.isFinite(cr.conceptId));
}

export function parseApplyLlmResponse(rawText: string): ApplyChatTurn {
  const slice = extractLikelyJson(rawText) ?? rawText;
  const parsed = safeJsonParse(slice);
  const safe = ApplyLlmResponseSchema.safeParse(parsed);

  if (!safe.success) {
    const fallback = rawText.trim();
    return {
      assistantMessage: fallback || "...",
      correction: null,
      evaluation: {
        score: 0,
        conceptResults: [],
      },
      rawText,
    };
  }

  const data = safe.data;
  const conceptResults = normalizeConceptResults(data.evaluation.conceptResults);
  const score = normalizeScore(data.evaluation.score ?? (data.evaluation.isCorrect ? 1 : 0));

  return {
    assistantMessage: data.assistantMessage.trim(),
    correction: data.correction?.text ?? null,
    evaluation: {
      isCorrect: data.evaluation.isCorrect,
      score,
      feedback: data.evaluation.feedback,
      conceptResults,
    },
    rawText,
  };
}

export function parseApplyEvaluationResponse(rawText: string): {
  correction: string | null;
  evaluation: ApplyChatEvaluation;
  rawText: string;
} {
  const slice = extractLikelyJson(rawText) ?? rawText;
  const balanced = tryBalanceJson(slice) ?? slice;
  const parsed = safeJsonParse(balanced);
  const safe = ApplyEvaluationSchema.safeParse(parsed);

  if (!safe.success) {
    return {
      correction: null,
      evaluation: {
        score: 0,
        conceptResults: [],
      },
      rawText,
    };
  }

  const data = safe.data;
  const conceptResults = normalizeConceptResults(data.evaluation.conceptResults);
  const score = normalizeScore(data.evaluation.score ?? (data.evaluation.isCorrect ? 1 : 0));

  return {
    correction: data.correction?.text ?? null,
    evaluation: {
      isCorrect: data.evaluation.isCorrect,
      score,
      feedback: data.evaluation.feedback,
      conceptResults,
    },
    rawText,
  };
}


function formatConcept(ref: ConceptRefRow) {
  const title = (ref.title ?? "").trim();
  if (title) return `[${ref.conceptId}] ${title}`;
  return `[${ref.conceptId}]`;
}

export function buildApplyPersonaPrompt(params: {
  learningName: string;
  learningCode: string;
  nativeName: string;
  knownVocab: ConceptRefRow[];
  knownGrammar: ConceptRefRow[];
  targets: ConceptRefRow[];
}) {
  const { learningName, learningCode, nativeName, knownVocab, knownGrammar, targets } = params;

  const vocabLines = knownVocab.map(formatConcept).slice(0, 40).join("\n");
  const grammarLines = knownGrammar.map(formatConcept).slice(0, 25).join("\n");
  const targetLines = targets.map(formatConcept).slice(0, 10).join("\n");

  return [
    `You are Hermes, a patient language tutor for ${learningName} (${learningCode}).`,
    `The learner's native language is ${nativeName}.`,
    "Conversation rules:",
    `- Respond in ${learningName} only (not ${nativeName}) except for short correction notes if needed.`,
    "- Keep responses short, natural, and conversational.",
    "- Try to use only words and grammar the learner has been exposed to.",
    "- Your goal is to elicit the target concepts from the learner's responses.",
    "",
    "Known user vocabulary (conceptId, word - translation):",
    vocabLines || "(none)",
    "",
    "Known user grammar (conceptId, title - summary):",
    grammarLines || "(none)",
    "",
    "Target concepts to elicit (only evaluate these):",
    targetLines || "(none)",
    "",
    "When the learner replies:",
    "Your goal is to naturally elicit the target concepts from the learner's responses.",
  ].join("\n");
}

const DIACRITICS_RE = /[\\u0300-\\u036f]+/g;
const ZERO_WIDTH_RE = /[\\u200B-\\u200D\\uFEFF]/g;
let NON_WORD_RE: RegExp;
try {
  NON_WORD_RE = new RegExp("[^\\\\p{L}\\\\p{N}]+", "gu");
} catch {
  NON_WORD_RE = /[^0-9A-Za-z\\u0400-\\u04FF]+/g;
}

function stripDiacritics(input: string) {
  return input.normalize("NFD").replace(DIACRITICS_RE, "");
}

function normalizeText(input: string) {
  return stripDiacritics(input)
    .replace(ZERO_WIDTH_RE, "")
    .toLowerCase()
    .replace(NON_WORD_RE, " ")
    .trim();
}

export function fuzzyMatchTargets(
  userMessage: string,
  targets: ConceptRefRow[]
): number[] {
  const normalizedUser = normalizeText(userMessage);
  if (!normalizedUser) return [];

  const matches: number[] = [];

  for (const t of targets) {
    const title = (t.title ?? "").trim();
    if (!title) continue;

    const normalizedTitle = normalizeText(title);
    if (!normalizedTitle) continue;

    const hit = normalizedTitle && normalizedUser.includes(normalizedTitle);

    if (hit) {
      console.log("[apply][fuzzy] hit", {
        conceptId: t.conceptId,
        title,
        normalizedTitle,
        normalizedUser,
      });
      matches.push(t.conceptId);
    }
  }

  return matches;
}



export function buildApplyEvaluatorPrompt(params: {
  learningName: string;
  learningCode: string;
  nativeName: string;
  knownVocab: ConceptRefRow[];
  knownGrammar: ConceptRefRow[];
  targets: ConceptRefRow[];
}) {
  const { learningName, learningCode, nativeName, knownVocab, knownGrammar, targets } = params;

  const vocabLines = knownVocab.map(formatConcept).slice(0, 40).join("\n");
  const grammarLines = knownGrammar.map(formatConcept).slice(0, 25).join("\n");
  const targetLines = targets.map(formatConcept).slice(0, 10).join("\n");

  return [
    `You evaluate learner responses in ${learningName} (${learningCode}).`,
    `The learner's native language is ${nativeName}.`,
    "Use these only for evaluation and corrections.",
    "",
    "Known vocabulary (conceptId, word - translation):",
    vocabLines || "(none)",
    "",
    "Known grammar (conceptId, title - summary):",
    grammarLines || "(none)",
    "",
    "Target concepts to evaluate (only these):",
    targetLines || "(none)",
    "",
    "Rules:",
    "- Evaluate whether the learner used any target concepts correctly.",
    "- If incorrect, provide a corrected version of their message (same meaning) in the target language.",
    "- If no target concepts were attempted, set conceptResults to an empty array.",
    "- In feedback, refer to target concepts using the exact target-language text from the list (no English).",
    "",
    "Return ONLY JSON with this schema:",
    "{",
    "  \"correction\": { \"text\": string, \"notes\"?: string } | null,",
    "  \"evaluation\": {",
    "    \"isCorrect\"?: boolean,",
    "    \"score\"?: number,",
    "    \"feedback\"?: string,",
    "    \"conceptResults\": Array<{",
    "      \"conceptId\": number,",
    "      \"isCorrect\": boolean,",
    "      \"score\": number,",
    "      \"maxScore\"?: number,",
    "      \"evidence\"?: object",
    "    }>",
    "  }",
    "}",
    "",
    "Hard rules:",
    "- Only use conceptIds from the target list in conceptResults.",
    "- Do not include any assistant chat response in this JSON.",
  ].join("\n");
}

export async function loadApplyContext(
  db: SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    targetLimit?: number;
    knownLimit?: number;
  }
): Promise<ApplyChatContext> {
  const { userId, languageId, modelKey, targetLimit = 6, knownLimit = 60 } = args;

  const due = await getDueConceptRefsForApply(db, {
    userId,
    languageId,
    modelKey,
    limit: targetLimit,
    dueBeforeIso: new Date().toISOString(),
  });

  const known = await getConceptRefsByMastery(db, {
    userId,
    languageId,
    modelKey,
    limit: knownLimit,
    order: "desc",
  });

  const low = await getConceptRefsByMastery(db, {
    userId,
    languageId,
    modelKey,
    limit: targetLimit,
    order: "asc",
  });

  const targets = due.length > 0 ? due : low;

  return {
    targets,
    knownVocab: known.filter((k) => k.kind === "vocab_item"),
    knownGrammar: known.filter((k) => k.kind === "grammar_point"),
  };
}

function buildConversationSnippet(
  messages: Array<{ role: "assistant" | "user"; content: string }>,
  maxTurns = 6
) {
  const slice = messages.slice(-maxTurns * 2);
  return slice
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
}

export async function startApplyConversation(
  complete: (params: any, onPartial?: (text: string) => void) => Promise<{ text: string }>,
  personaPrompt: string
): Promise<string> {
  const res = await complete({
    messages: [
      { role: "system", content: personaPrompt },
      { role: "user", content: "Start the conversation with a friendly prompt." },
    ],
    n_predict: 220,
    temperature: 0.6,
    stop: APPLY_STOP_WORDS,
  });

  return String(res.text ?? "").trim();
}

export async function evaluateApplyConversation(
  complete: (params: any, onPartial?: (text: string) => void) => Promise<{ text: string }>,
  evaluatorPrompt: string,
  messages: Array<{ role: "assistant" | "user"; content: string }>,
  userMessage: string
) {
  const convo = buildConversationSnippet(messages);

  const res = await complete({
    messages: [
      { role: "system", content: evaluatorPrompt },
      {
        role: "user",
        content: [
          "Conversation so far:",
          convo || "(none)",
          "",
          `New user message: ${JSON.stringify(userMessage)}`,
          "",
          "Return JSON only.",
        ].join("\n"),
      },
    ],
    n_predict: 380,
    temperature: 0.2,
    stop: APPLY_STOP_WORDS,
  });

  console.log("Evaluator raw response:", res.text);

  return parseApplyEvaluationResponse(res.text ?? "");
}

export async function continueApplyConversation(
  complete: (params: any, onPartial?: (text: string) => void) => Promise<{ text: string }>,
  personaPrompt: string,
  messages: Array<{ role: "assistant" | "user"; content: string }>,
  userMessage: string
): Promise<string> {
  const convo = buildConversationSnippet(messages);

  const res = await complete({
    messages: [
      { role: "system", content: personaPrompt },
      {
        role: "user",
        content: [
          "Conversation so far:",
          convo || "(none)",
          "",
          `New user message: ${JSON.stringify(userMessage)}`,
        ].join("\n"),
      },
    ],
    n_predict: 260,
    temperature: 0.6,
    stop: APPLY_STOP_WORDS,
  });
  return String(res.text ?? "").trim();
}
