// shared/domain/practice/items/clozeFreeFillPracticeItem.ts
import { z } from "zod";
import { PracticeItemBaseSchema } from "../practiceItemSchemas";
import { PracticeItem, EvaluationResult } from "../practiceItem";

export const ClozeFreeFillSchema = PracticeItemBaseSchema.extend({
  type: z.literal("cloze_v1.free_fill"),
  text: z.string().min(1),
  blanks: z
    .array(
      z.object({
        accepted: z.array(z.string().min(1)).min(1),
        conceptId: z.number().int().positive().optional(),
      })
    )
    .min(1),
});

export type ClozeFreeFillJSON = z.infer<typeof ClozeFreeFillSchema>;

function normalizeAnswer(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

export class ClozeFreeFillPracticeItem extends PracticeItem {
  private readonly text: string;
  private readonly blanks: { accepted: string[]; conceptId?: number }[];

  constructor(json: ClozeFreeFillJSON) {
    super(json); 
    this.text = json.text;
    this.blanks = json.blanks;
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    // Expected: { answers: string[] } aligned to blanks order
    const answers = (userResponse as any)?.answers;
    const safeAnswers: unknown[] = Array.isArray(answers) ? answers : [];

    const perBlank = this.blanks.map((b, idx) => {
      const response = normalizeAnswer(safeAnswers[idx]);
      const accepted = b.accepted.map(normalizeAnswer);

      const isCorrect = response.length > 0 && accepted.includes(response);
      const score = isCorrect ? 1 : 0;

      const conceptId =
        b.conceptId ?? (this.conceptIds.length ? this.conceptIds[0] : 0);

      return {
        conceptId,
        score,
        maxScore: 1,
        isCorrect,
        evidence: {
          index: idx,
          response,
          accepted: b.accepted,
        },
      };
    });

    const total = perBlank.length;
    const correct = perBlank.reduce((acc, r) => acc + r.score, 0);
    const score = total > 0 ? correct / total : 0;

    const byConcept = new Map<
      number,
      { s: number; m: number; anyWrong: boolean; evid: any[] }
    >();

    for (const r of perBlank) {
      const cur = byConcept.get(r.conceptId) ?? {
        s: 0,
        m: 0,
        anyWrong: false,
        evid: [],
      };
      cur.s += r.score;
      cur.m += r.maxScore;
      cur.anyWrong = cur.anyWrong || !r.isCorrect;
      cur.evid.push(r.evidence);
      byConcept.set(r.conceptId, cur);
    }

    const conceptResults = Array.from(byConcept.entries()).map(
      ([conceptId, v]) => ({
        conceptId,
        score: v.s,
        maxScore: v.m,
        isCorrect: !v.anyWrong,
        evidence: v.evid,
      })
    );

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      score,
      isCorrect: score === 1,
      conceptResults,
      feedback: score === 1 ? "All blanks correct." : "Some blanks incorrect.",
      meta: { text: this.text },
    };
  }

  override toJSON(): ClozeFreeFillJSON {
    return {
      ...super.toJSON(),
      type: "cloze_v1.free_fill", 
      text: this.text,
      blanks: this.blanks,
    };
  }
}
