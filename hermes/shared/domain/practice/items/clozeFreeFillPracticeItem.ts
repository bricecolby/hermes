import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type ClozeFreeFillJSON = PracticeItemJSON & {
  text: string;
  blanks: { accepted: string[]; conceptId?: number }[];
};

export class ClozeFreeFillPracticeItem extends PracticeItem {
  private readonly text: string;
  private readonly blanks: { accepted: string[]; conceptId?: number }[];

  constructor(json: ClozeFreeFillJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.text = String(json.text);
    this.blanks = (json.blanks ?? []) as any;
  }

  private norm(s: string): string {
    return s.trim().toLowerCase();
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const filled: string[] = ((userResponse as any)?.filled ?? []) as any;

    const total = this.blanks.length || 1;
    let correct = 0;

    const perBlank = this.blanks.map((b, idx) => {
      const submitted = this.norm(String(filled[idx] ?? ""));
      const accepted = (b.accepted ?? []).map((a) => this.norm(String(a)));
      const isCorrect = accepted.includes(submitted) && submitted.length > 0;
      if (isCorrect) correct += 1;

      const conceptId = b.conceptId ?? this.conceptIds[idx % this.conceptIds.length];

      return {
        conceptId,
        isCorrect,
        score: isCorrect ? 1 : 0,
        maxScore: 1,
        evidence: { idx, submitted, accepted },
      };
    });

    const score = correct / total;

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
      meta: { text: this.text },
    };
  }
}
