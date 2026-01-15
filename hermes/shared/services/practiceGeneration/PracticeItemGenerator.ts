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

    let rawText = "";
    let timings: any = null;
    let jsonStr = "";
    let lastError = "";
    let lastQualityIssues: string[] = [];
    let hadParsableJson = false;

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

      const r = await this.complete(
        {
          messages,
          n_predict: 260,
          temperature: attempt === 1 ? 0.4 : 0.2,
          stop: this.stopWords,
        },
        onPartial
      );

      rawText = r.text;
      timings = r.timings;
      jsonStr = extractLikelyJson(rawText) ?? rawText;

      let parsed: any;

      try {
        parsed = JSON.parse(jsonStr);
        hadParsableJson = true;
      } catch (e: any) {
        hadParsableJson = false;
        lastQualityIssues = [];
        lastError = `JSON parse error: ${e?.message ?? String(e)}`;
        continue;
      }

      try {
        practiceItemRegistry.create(parsed);
      } catch (e: any) {
        lastQualityIssues = [];
        lastError = e instanceof z.ZodError ? formatZodError(e) : e?.message ?? String(e);
        continue;
      }

      const checks = spec.qualityChecks ?? [];
      const qIssues = checks.flatMap((fn) => fn(parsed));
      lastQualityIssues = qIssues;

      if (qIssues.length === 0) {
        return { ok: true as const, rawText, parsed, attempts: attempt, timings, qualityIssues: [] };
      }

      lastError = "";
    }

    const error = lastError || (lastQualityIssues.length ? "quality check failed" : "unknown error");
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
