import { z } from "zod";
import { PracticeItemBaseSchema } from "../practiceItemSchemas";
import type { EvaluationResult } from "../practiceItem";
import { PracticeItem } from "../practiceItem";

const ClozeTextPartSchema = z.object({
  type: z.literal("text"),
  value: z.string(),
});

const ClozeBlankPartSchema = z.object({
  type: z.literal("blank"),
  id: z.string().min(1),
  accepted: z.array(z.string().min(1)).min(1),
});

export const ClozeFreeFillSchema = PracticeItemBaseSchema.extend({
  type: z.literal("cloze_v1.free_fill"),
  parts: z.array(z.union([ClozeTextPartSchema, ClozeBlankPartSchema])).min(1),
});

export type ClozeFreeFillJSON = z.infer<typeof ClozeFreeFillSchema>;

export type ClozeUserResponse = {
  responses: Record<string, string>;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

export class ClozeFreeFillPracticeItem extends PracticeItem {
  public readonly parts: ClozeFreeFillJSON["parts"];

  constructor(json: ClozeFreeFillJSON) {
    super({
      type: json.type,
      mode: json.mode,
      skills: json.skills,
      conceptIds: json.conceptIds,
    });
    this.parts = json.parts;
  }

  evaluate(userResponse: unknown): EvaluationResult {
    const resp = userResponse as Partial<ClozeUserResponse> | null;
    const responses = resp?.responses && typeof resp.responses === "object" ? resp.responses : {};

    const blanks = this.parts.filter((p) => p.type === "blank") as Array<z.infer<typeof ClozeBlankPartSchema>>;
    const total = blanks.length;

    let correct = 0;
    const evidence: Record<string, unknown> = {};

    for (const b of blanks) {
      const givenRaw = typeof responses[b.id] === "string" ? responses[b.id] : "";
      const given = norm(givenRaw);
      const accepted = b.accepted.map(norm);
      const ok = accepted.includes(given);

      if (ok) correct += 1;

      evidence[b.id] = {
        given: givenRaw,
        accepted: b.accepted,
        isCorrect: ok,
      };
    }

    const score = total === 0 ? 0 : correct / total;
    const isCorrect = total > 0 ? correct === total : false;

    const conceptResults = this.conceptIds.map((conceptId) => ({
      conceptId,
      score,
      maxScore: 1,
      isCorrect,
      evidence,
    }));

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      isCorrect,
      score,
      conceptResults,
      feedback: isCorrect ? "Correct." : "Not quite.",
      meta: { correct, total },
    };
  }
}
