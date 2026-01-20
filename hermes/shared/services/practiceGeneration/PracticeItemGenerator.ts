// shared/services/practiceGeneration/PracticeItemGenerator.ts
import { z } from "zod";
import { practiceItemRegistry } from "shared/domain/practice";
import { getPracticeItemSpec } from "./specs/practiceItemSpecs";
import { formatBulletIssues } from "./quality/textQualityUtils";

export type StopWords = string[];

export type CompletionFn = (
  params: any,
  onPartial?: (text: string) => void
) => Promise<{ text: string; timings?: any }>;

type GenerateOptions = {
  maxAttempts?: number; // default 3
  debug?: boolean; // default false
  timeoutMs?: number; // default 25000
  logRawChars?: number; // default 500
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

export class PracticeItemGenerator {
  constructor(private complete: CompletionFn, private stopWords: StopWords) {}

  async generate<TContext>(
    type: string,
    ctx: TContext,
    onPartial?: (text: string) => void,
    options: GenerateOptions = {}
  ) {
    const spec = getPracticeItemSpec(type);
    const { system, user } = spec.buildPrompt(ctx);

    const maxAttempts = options.maxAttempts ?? 3;
    const debug = options.debug ?? false;
    const timeoutMs = options.timeoutMs ?? 25_000;
    const logRawChars = options.logRawChars ?? 500;

    let rawText = "";
    let timings: any = null;
    let jsonStr = "";
    let lastError = "";
    let lastQualityIssues: string[] = [];
    let hadParsableJson = false;

    const log = (...args: any[]) => {
      if (debug) console.log(...args);
    };
    const warn = (...args: any[]) => {
      if (debug) console.warn(...args);
    };

    log(`[GEN] generate(${type}) start`, {
      maxAttempts,
      timeoutMs,
      stopWords: this.stopWords?.length ?? 0,
      systemChars: system.length,
      userChars: user.length,
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const messages =
        attempt === 1 || !rawText
          ? [
              { role: "system", content: system },
              { role: "user", content: user },
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
                  "Return ONLY corrected JSON.",
              },
            ];

      const promptChars =
        messages.reduce((sum, m: any) => sum + String(m?.content ?? "").length, 0) ?? 0;

      log(`[GEN] (${type}) attempt ${attempt}/${maxAttempts} start`, {
        promptChars,
        temperature: attempt === 1 ? 0.4 : 0.2,
      });

      const t0 = nowMs();

      let r: { text: string; timings?: any };
      try {
        r = await withTimeout(
          this.complete(
            {
              messages,
              n_predict: 260,
              temperature: attempt === 1 ? 0.4 : 0.2,
              stop: this.stopWords,
            },
            onPartial
          ),
          timeoutMs,
          `LLM(${type})`
        );
      } catch (e: any) {
        const dur = Math.round(nowMs() - t0);
        lastQualityIssues = [];
        lastError = e?.message ?? String(e);
        warn(`[GEN] (${type}) attempt ${attempt} LLM error after ${dur}ms:`, lastError);
        continue;
      }

      const dur = Math.round(nowMs() - t0);

      rawText = r.text ?? "";
      timings = r.timings ?? null;
      jsonStr = extractLikelyJson(rawText) ?? rawText;

      log(`[GEN] (${type}) attempt ${attempt} LLM ok in ${dur}ms`, {
        rawChars: rawText.length,
        hadJsonSlice: extractLikelyJson(rawText) != null,
        timings: timings ?? undefined,
      });

      let parsed: any;

      try {
        parsed = JSON.parse(jsonStr);
        hadParsableJson = true;
      } catch (e: any) {
        hadParsableJson = false;
        lastQualityIssues = [];
        lastError = `JSON parse error: ${e?.message ?? String(e)}`;
        warn(`[GEN] (${type}) attempt ${attempt} parse failed:`, lastError);
        warn(`[GEN] (${type}) raw snippet:`, rawText.slice(0, logRawChars));
        continue;
      }

      try {
        practiceItemRegistry.create(parsed);
      } catch (e: any) {
        lastQualityIssues = [];
        lastError = e instanceof z.ZodError ? formatZodError(e) : e?.message ?? String(e);
        warn(`[GEN] (${type}) attempt ${attempt} schema failed:`, lastError);
        warn(`[GEN] (${type}) json snippet:`, JSON.stringify(parsed).slice(0, logRawChars));
        continue;
      }

      const checks = spec.qualityChecks ?? [];
      const qIssues = checks.flatMap((fn) => fn(parsed));
      lastQualityIssues = qIssues;

      if (qIssues.length === 0) {
        log(`[GEN] generate(${type}) success on attempt ${attempt}`);
        return { ok: true as const, rawText, parsed, attempts: attempt, timings, qualityIssues: [] };
      }

      warn(`[GEN] (${type}) attempt ${attempt} quality issues:`, qIssues);
      lastError = "";
    }

    const error = lastError || (lastQualityIssues.length ? "quality check failed" : "unknown error");
    warn(`[GEN] generate(${type}) failed`, { error, lastQualityIssues });

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
