// shared/domain/practice/items/clozeFreeFillPracticeItem.ts
import { z } from "zod";
import { PracticeItemBaseSchema } from "../practiceItemSchemas";
import { PracticeItem, EvaluationResult } from "../practiceItem";

const ClozeTextPartSchema = z.object({
  type: z.literal("text"),
  value: z.string(),
});

const ClozeBlankPartSchema = z.object({
  type: z.literal("blank"),
  id: z.string().min(1),
  accepted: z.array(z.string().min(1)).min(1),
  conceptId: z.number().int().positive().optional(),
});

export const ClozeFreeFillSchema = PracticeItemBaseSchema.extend({
  type: z.literal("cloze_v1.free_fill"),
  parts: z.array(z.union([ClozeTextPartSchema, ClozeBlankPartSchema])).min(1),
}).superRefine((val, ctx) => {
  const blanks = val.parts.filter((p) => (p as any).type === "blank");
  if (blanks.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parts"],
      message: "Cloze must include at least one blank part.",
    });
  }
});

export type ClozeFreeFillJSON = z.infer<typeof ClozeFreeFillSchema>;

type ClozePart = z.infer<typeof ClozeTextPartSchema> | z.infer<typeof ClozeBlankPartSchema>;
type ClozeBlankPart = z.infer<typeof ClozeBlankPartSchema>;

function normalizeAnswer(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

export class ClozeFreeFillPracticeItem extends PracticeItem {
  private readonly parts: ClozePart[];

  constructor(json: ClozeFreeFillJSON) {
    super(json);
    this.parts = json.parts;
  }

  override evaluate(userResponse: unknown): EvaluationResult {

    const responses = (userResponse as any)?.responses;
    const safeResponses: Record<string, unknown> =
      responses && typeof responses === "object" ? responses : {};

    const blanks: ClozeBlankPart[] = this.parts.filter(
      (p): p is ClozeBlankPart => p.type === "blank"
    );

    const perBlank = blanks.map((b, idx) => {
      const response = normalizeAnswer(safeResponses[b.id]);
      const accepted = b.accepted.map(normalizeAnswer);

      const isCorrect = response.length > 0 && accepted.includes(response);
      const score = isCorrect ? 1 : 0;

      const conceptId = b.conceptId ?? (this.conceptIds.length ? this.conceptIds[0] : 0);

      return {
        conceptId,
        score,
        maxScore: 1,
        isCorrect,
        evidence: {
          index: idx,
          blankId: b.id,
          response,
          accepted: b.accepted,
        },
      };
    });

    const total = perBlank.length;
    const correct = perBlank.reduce((acc, r) => acc + r.score, 0);
    const score = total > 0 ? correct / total : 0;

    const byConcept = new Map<number, { s: number; m: number; anyWrong: boolean; evid: any[] }>();

    for (const r of perBlank) {
      const cur = byConcept.get(r.conceptId) ?? { s: 0, m: 0, anyWrong: false, evid: [] };
      cur.s += r.score;
      cur.m += r.maxScore;
      cur.anyWrong = cur.anyWrong || !r.isCorrect;
      cur.evid.push(r.evidence);
      byConcept.set(r.conceptId, cur);
    }

    const conceptResults = Array.from(byConcept.entries()).map(([conceptId, v]) => ({
      conceptId,
      score: v.s,
      maxScore: v.m,
      isCorrect: !v.anyWrong,
      evidence: v.evid,
    }));

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      score,
      isCorrect: score === 1,
      conceptResults,
      feedback: score === 1 ? "All blanks correct." : "Some blanks incorrect.",
      meta: { parts: this.parts },
    };
  }

  override toJSON(): ClozeFreeFillJSON {
    return {
      ...super.toJSON(),
      type: "cloze_v1.free_fill",
      parts: this.parts,
    };
  }
}
