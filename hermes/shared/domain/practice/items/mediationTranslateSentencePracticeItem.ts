import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type MediationTranslateSentenceJSON = PracticeItemJSON & {
  sourceSentence: string;
  acceptedTranslations: string[];
  requiredTokens?: { token: string; conceptId?: number }[];
};

export class MediationTranslateSentencePracticeItem extends PracticeItem {
  private readonly sourceSentence: string;
  private readonly accepted: string[];
  private readonly required: { token: string; conceptId?: number }[];

  constructor(json: MediationTranslateSentenceJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.sourceSentence = String(json.sourceSentence);
    this.accepted = (json.acceptedTranslations ?? []).map((s) => String(s));
    this.required = (json.requiredTokens ?? []) as any;
  }

  private norm(s: string): string {
    return s.trim().toLowerCase();
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const response = this.norm(String((userResponse as any)?.text ?? ""));
    const acceptedNorm = this.accepted.map((a) => this.norm(a));

    let score = 0;
    let isCorrect = false;

    if (response.length === 0) {
      score = 0;
    } else if (acceptedNorm.includes(response)) {
      score = 1;
      isCorrect = true;
    } else if (this.required.length > 0) {
      const req = this.required
        .map((r) => ({ ...r, n: this.norm(r.token) }))
        .filter((r) => r.n.length > 0);

      const hits = req.filter((r) => response.includes(r.n)).length;
      score = Math.min(0.95, hits / Math.max(1, req.length));
      isCorrect = false;
    } else {
      score = 0.6; // attempt credit
    }

    const conceptResults: EvaluationResult["conceptResults"] = [];

    if (this.required.length > 0) {
      for (const r of this.required
        .map((r) => ({ ...r, n: this.norm(r.token) }))
        .filter((r) => r.n.length > 0)) {
        const hit = response.includes(r.n);
        const conceptId = r.conceptId ?? this.conceptIds[0];
        conceptResults.push({
          conceptId,
          score: hit ? 1 : 0,
          maxScore: 1,
          isCorrect: hit,
          evidence: { token: r.n },
        });
      }
    } else {
      for (const conceptId of this.conceptIds) {
        conceptResults.push({
          conceptId,
          score,
          maxScore: 1,
          isCorrect,
          evidence: { response },
        });
      }
    }

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      score,
      isCorrect,
      conceptResults,
      feedback: "Translation scoring is deterministic (accepted list) with optional token partial credit.",
      meta: { sourceSentence: this.sourceSentence },
    };
  }
}
