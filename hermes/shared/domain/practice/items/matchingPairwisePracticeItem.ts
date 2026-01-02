import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type MatchingPairwiseJSON = PracticeItemJSON & {
  prompt?: string;
  left: { id: string; text: string; conceptId?: number }[];
  right: { id: string; text: string }[];
  correctMatches: Record<string, string>; // leftId -> rightId
};

export class MatchingPairwisePracticeItem extends PracticeItem {
  private readonly left: { id: string; text: string; conceptId?: number }[];
  private readonly right: { id: string; text: string }[];
  private readonly correctMatches: Record<string, string>;
  private readonly prompt?: string;

  constructor(json: MatchingPairwiseJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.prompt = json.prompt ? String(json.prompt) : undefined;
    this.left = (json.left ?? []) as any;
    this.right = (json.right ?? []) as any;
    this.correctMatches = (json.correctMatches ?? {}) as any;
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const submitted: Record<string, string> = ((userResponse as any)?.matches ?? {}) as any;

    const leftIds = this.left.map((l) => l.id).filter(Boolean);
    const total = leftIds.length || 1;

    let correct = 0;

    const perLeft = leftIds.map((leftId) => {
      const expected = this.correctMatches[leftId];
      const actual = submitted[leftId];
      const isCorrect = expected !== undefined && actual === expected;
      if (isCorrect) correct += 1;

      const conceptId = this.left.find((l) => l.id === leftId)?.conceptId ?? this.conceptIds[0];

      return {
        conceptId,
        isCorrect,
        score: isCorrect ? 1 : 0,
        maxScore: 1,
        evidence: { leftId, expected, actual },
      };
    });

    const score = correct / total;

    // roll-up by concept
    const byConcept = new Map<number, { s: number; m: number; anyWrong: boolean; evid: any[] }>();
    for (const r of perLeft) {
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
      feedback: score === 1 ? "All matches correct." : "Some matches incorrect.",
      meta: { prompt: this.prompt },
    };
  }
}
