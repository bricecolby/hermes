import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type OrderingWordOrderJSON = PracticeItemJSON & {
  prompt?: string;
  tokens: { id: string; text: string; conceptId?: number }[];
  correctOrder: string[];
};

export class OrderingWordOrderPracticeItem extends PracticeItem {
  private readonly tokens: { id: string; text: string; conceptId?: number }[];
  private readonly correctOrder: string[];
  private readonly prompt?: string;

  constructor(json: OrderingWordOrderJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.prompt = json.prompt ? String(json.prompt) : undefined;
    this.tokens = (json.tokens ?? []) as any;
    this.correctOrder = (json.correctOrder ?? []) as any;
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const submitted: string[] = ((userResponse as any)?.order ?? []) as any;

    const total = this.correctOrder.length || 1;
    let correctPos = 0;

    const perPos = this.correctOrder.map((expectedId, idx) => {
      const actualId = submitted[idx];
      const isCorrect = actualId === expectedId;
      if (isCorrect) correctPos += 1;

      const conceptId =
        this.tokens.find((t) => t.id === expectedId)?.conceptId ??
        this.conceptIds[idx % this.conceptIds.length];

      return {
        conceptId,
        isCorrect,
        score: isCorrect ? 1 : 0,
        maxScore: 1,
        evidence: { idx, expectedId, actualId },
      };
    });

    const score = correctPos / total;

    const byConcept = new Map<number, { s: number; m: number; anyWrong: boolean; evid: any[] }>();
    for (const r of perPos) {
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
      feedback: score === 1 ? "Perfect order." : "Some tokens out of order.",
      meta: { prompt: this.prompt },
    };
  }
}
