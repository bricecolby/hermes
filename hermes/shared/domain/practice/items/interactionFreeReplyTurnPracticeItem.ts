import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type InteractionFreeReplyTurnJSON = PracticeItemJSON & {
  prompt: string;
  targetKeywords?: { keyword: string; conceptId?: number }[];
};

export class InteractionFreeReplyTurnPracticeItem extends PracticeItem {
  private readonly prompt: string;
  private readonly targets: { keyword: string; conceptId?: number }[];

  constructor(json: InteractionFreeReplyTurnJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.prompt = String(json.prompt);
    this.targets = (json.targetKeywords ?? []) as any;
  }

  private norm(s: string): string {
    return s.trim().toLowerCase();
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const response = this.norm(String((userResponse as any)?.text ?? ""));
    const hasText = response.length > 0;

    const targetNorm = this.targets
      .map((t) => ({ ...t, k: this.norm(t.keyword) }))
      .filter((t) => t.k.length > 0);

    const hits = targetNorm.filter((t) => response.includes(t.k)).length;

    let score = 0;
    if (!hasText) score = 0;
    else if (targetNorm.length === 0) score = 0.7;
    else score = Math.min(1, 0.4 + 0.6 * (hits / targetNorm.length));

    const conceptResults: EvaluationResult["conceptResults"] = [];

    if (targetNorm.length > 0) {
      for (const t of targetNorm) {
        const hit = hasText && response.includes(t.k);
        const conceptId = t.conceptId ?? this.conceptIds[0];
        conceptResults.push({
          conceptId,
          score: hit ? 1 : 0,
          maxScore: 1,
          isCorrect: hit,
          evidence: { keyword: t.k },
        });
      }
    } else {
      for (const conceptId of this.conceptIds) {
        conceptResults.push({
          conceptId,
          score,
          maxScore: 1,
          evidence: { responseLength: response.length },
        });
      }
    }

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      score,
      isCorrect: score === 1,
      conceptResults,
      feedback: score === 0 ? "No response provided." : "Interaction scoring is heuristic in MVP.",
      meta: { prompt: this.prompt, hits, targets: targetNorm.length },
    };
  }
}
