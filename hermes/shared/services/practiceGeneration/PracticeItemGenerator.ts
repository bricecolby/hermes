// shared/services/practiceGeneration/PracticeItemGenerator.ts
import { z } from "zod";
import { practiceItemRegistry } from "shared/domain/practice";
import { getPracticeItemSpec } from "./specs/practiceItemSpecs";
import { formatBulletIssues } from "./quality/textQualityUtils";
import { qualityCheckMcq } from "./quality/McqQualityChecker";
import { qualityCheckCloze } from "./quality/ClozeQualityChecker";

export type StopWords = string[];

export type CompletionFn = (
  params: any,
  onPartial?: (text: string) => void
) => Promise<{ text: string; timings?: any }>;

export type FocusSpec = {
  conceptId: number;
  target: string; // raw target from DB (may be messy)
  translation?: string;
  distractors?: string[];
};

type GenerateOptions = {
  maxAttempts?: number;
  debug?: boolean;
  timeoutMs?: number;
  logRawChars?: number;
  focus?: FocusSpec;

  focusCleanTimeoutMs?: number; // default 4000
};

function extractLikelyJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

function nowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

function sanitizeFocusToken(raw: string): string {
  return String(raw ?? "")
    .normalize("NFD")
    // Strip stress marks, but keep other combining marks (e.g. breve in "й").
    .replace(/[\u0300\u0301\u0341]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[«»"'`]/g, "")
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .trim();
}

function focusInstruction(type: string, focusResolved: string, focus: FocusSpec): string {
  const distractors = (focus.distractors ?? []).map((d) => d.trim()).filter(Boolean);

  const translationLine = focus.translation
    ? `- Meaning (for you, not to show in output): ${focus.translation}\n`
    : "";

  const distractorLine =
    distractors.length > 0 ? `- Use distractors from this list when possible: ${distrorsToCsv(distractors)}\n` : "";

  if (type === "mcq_v1.basic") {
    return [
      "FOCUS WORD (use exactly this surface form in output):",
      `- conceptId: ${focus.conceptId}`,
      `- target (raw): ${focus.target}`,
      `- target (resolved): ${focusResolved}`,
      translationLine.trimEnd(),
      distractorLine.trimEnd(),
      "",
      "Hard requirements for this item:",
      `- conceptIds must include ${focus.conceptId}`,
      `- The correct choice text MUST be exactly "${focusResolved}"`,
      "- All choices must be in the target language/script (no Latin).",
      "- The prompt must test understanding/recognition of the focus word.",
      "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (type === "cloze_v1.free_fill") {
    return [
      "FOCUS TARGET (blank should test this lemma/word family):",
      `- conceptId: ${focus.conceptId}`,
      `- target (raw): ${focus.target}`,
      `- target (resolved): ${focusResolved}`,
      translationLine.trimEnd(),
      distractorLine.trimEnd(),
      "",
      "Hard requirements for this item:",
      `- conceptIds must include ${focus.conceptId}`,
      `- Exactly ONE blank (id "b1") and it must correspond to conceptId ${focus.conceptId}`,
      "- accepted must include all valid forms for the sentence context, and no distractors",
      "- If only one form is valid, include only that form",
      "- The sentence must clearly cue the target form(s) from context",
      "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function distrorsToCsv(arr: string[]) {
  return arr.join(", ");
}

export class PracticeItemGenerator {
  private focusCache = new Map<string, string>();

  constructor(private complete: CompletionFn, private stopWords: StopWords) {}

  private focusCacheKey(focus: FocusSpec) {
    return `${focus.conceptId}::${focus.target}`;
  }

  private async resolveFocusTarget(
    focus: FocusSpec,
    debug: boolean,
    _timeoutMs: number
  ): Promise<string> {
    const key = this.focusCacheKey(focus);
    const cached = this.focusCache.get(key);
    if (cached) return cached;

    const resolved = sanitizeFocusToken(focus.target);
    const fallback = String(focus.target ?? "").trim();
    const finalValue = resolved || fallback;

    this.focusCache.set(key, finalValue);
    if (debug) console.log("[GEN][FOCUS] resolved (local)", { raw: focus.target, resolved: finalValue });

    return finalValue;
  }

  async generate<TContext>(
    type: string,
    ctx: TContext,
    onPartial?: (text: string) => void,
    options: GenerateOptions = {}
  ) {
    const spec = getPracticeItemSpec(type);

    const maxAttempts = options.maxAttempts ?? 3;
    const debug = options.debug ?? false;
    const timeoutMs = options.timeoutMs ?? 25_000;
    const logRawChars = options.logRawChars ?? 500;
    const focusCleanTimeoutMs = options.focusCleanTimeoutMs ?? 4_000;

    const log = (...args: any[]) => debug && console.log(...args);
    const warn = (...args: any[]) => debug && console.warn(...args);

    // ✅ Resolve focus via LLM once, use as truth
    let focusResolved: string | null = null;
    if (options.focus) {
      focusResolved = await this.resolveFocusTarget(options.focus, debug, focusCleanTimeoutMs);
    }

    // Merge focusResolved into ctx so prompt builders can use it if desired
    const ctxWithFocus: any =
      options.focus
        ? { ...(ctx as any), focus: { ...options.focus, resolved: focusResolved } }
        : ctx;

    const { system, user } = spec.buildPrompt(ctxWithFocus);

    let rawText = "";
    let timings: any = null;
    let jsonStr = "";
    let lastError = "";
    let lastQualityIssues: string[] = [];
    let hadParsableJson = false;

    log(`[GEN] generate(${type}) start`, {
      hasFocus: !!options.focus,
      maxAttempts,
      timeoutMs,
      systemChars: system.length,
      userChars: user.length,
      focusResolved: focusResolved ?? undefined,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const focusBlock =
        options.focus && focusResolved
          ? focusInstruction(type, focusResolved, options.focus)
          : "";

      const baseUser = focusBlock ? `${focusBlock}\n\n${user}` : user;

      const messages =
        attempt === 1 || !rawText
          ? [
              { role: "system", content: system },
              { role: "user", content: baseUser },
            ]
          : [
              { role: "system", content: system },
              {
                role: "user",
                content:
                  "Fix the JSON to satisfy BOTH structure and quality requirements. Return ONLY corrected JSON.\n\n" +
                  (hadParsableJson
                    ? `Current JSON:\n${jsonStr}\n\n`
                    : `Previous output (may be invalid):\n${rawText}\n\n`) +
                  (lastError ? `Structure/validation errors:\n${lastError}\n\n` : "") +
                  (lastQualityIssues.length
                    ? `Quality issues:\n${formatBulletIssues(lastQualityIssues)}\n\n`
                    : "") +
                  (focusBlock ? `\n\n${focusBlock}\n\n` : "") +
                  "Return ONLY corrected JSON.",
              },
            ];

      const promptChars =
        messages.reduce((sum, m: any) => sum + String(m?.content ?? "").length, 0) ?? 0;

      log(`[GEN] (${type}) attempt ${attempt}/${maxAttempts} start`, { promptChars });

      const t0 = nowMs();

      try {
        const r = await withTimeout(
          this.complete(
            {
              messages,
              n_predict: type === "cloze_v1.free_fill" ? 140 : 220,
              temperature: attempt === 1 ? 0.4 : 0.2,
              stop: this.stopWords,
            },
            onPartial
          ),
          timeoutMs,
          `LLM(${type})`
        );

        rawText = r.text ?? "";
        timings = r.timings ?? null;
        jsonStr = extractLikelyJson(rawText) ?? rawText;

        log(`[GEN] (${type}) attempt ${attempt} LLM ok in ${Math.round(nowMs() - t0)}ms`, {
          rawChars: rawText.length,
          hadJsonSlice: extractLikelyJson(rawText) != null,
          timings: timings ?? undefined,
        });
      } catch (e: any) {
        lastQualityIssues = [];
        lastError = e?.message ?? String(e);
        warn(`[GEN] (${type}) attempt ${attempt} LLM error:`, lastError);
        if (
          /context is busy/i.test(lastError) ||
          /timed out/i.test(lastError)
        ) {
          await delay(1500);
        }
        continue;
      }

      let parsed: any;

      try {
        parsed = JSON.parse(jsonStr);
        hadParsableJson = true;
      } catch (e: any) {
        hadParsableJson = false;
        lastQualityIssues = [];
        lastError = `JSON parse error: ${e?.message ?? String(e)}`;
        warn(`[GEN] (${type}) parse failed:`, lastError);
        warn(`[GEN] (${type}) raw snippet:`, rawText.slice(0, logRawChars));
        continue;
      }

      try {
        practiceItemRegistry.create(parsed);
      } catch (e: any) {
        lastQualityIssues = [];
        lastError = e instanceof z.ZodError ? formatZodError(e) : e?.message ?? String(e);
        warn(`[GEN] (${type}) schema failed:`, lastError);
        continue;
      }

      const checks = spec.qualityChecks ?? [];
      const qIssues: string[] = [];
      qIssues.push(...checks.flatMap((fn) => fn(parsed)));

      if (type === "mcq_v1.basic") {
        qIssues.push(...qualityCheckMcq(parsed, focusResolved ?? undefined));
      } else if (type === "cloze_v1.free_fill") {
        qIssues.push(...qualityCheckCloze(parsed, focusResolved ?? undefined, options.focus?.conceptId));
      }

      lastQualityIssues = qIssues;

      if (qIssues.length > 0) {
        warn(`[GEN] (${type}) quality warnings (non-fatal):`, qIssues);
        if (type === "cloze_v1.free_fill") {
          lastError = `quality issues:\n${formatBulletIssues(qIssues)}`;
          continue;
        }
      }

      log(`[GEN] generate(${type}) success on attempt ${attempt}`);
      return {
        ok: true as const,
        rawText,
        parsed,
        attempts: attempt,
        timings,
        qualityIssues: qIssues,
      };

    }

    const error = lastError || "gen failed (LLM/parse/schema)";
    return {
      ok: false as const,
      rawText,
      error,
      attempts: maxAttempts,
      timings,
      qualityIssues: lastQualityIssues,
    };
  }
}
