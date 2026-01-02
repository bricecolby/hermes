import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type InteractionRespondToPromptJSON = PracticeItemJSON & {
  audioUrl: string;
  promptText?: string;
  targetKeywords?: { keyword: string; conceptId?: number }[];
};

export class InteractionRespondToPromptPracticeItem extends PracticeItem {
  private readonly audioUrl: string;
  private readonly promptText?: string;
  private readonly targets: { keyword: string; conceptId?: number }[];

  constructor(json: InteractionRespondToPromptJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.audioUrl = String(json.audioUrl);
    this.promptText = json.promptText ? String(json.promptText) : undefined;
    this.targets = (json.targetKeywords ?? []) as any;
  }

  private norm(s: string): string {
    return s.trim().toLowerCase();
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    // MVP assumes upstream provides transcript (ASR later)
    const transcript = this.norm(String((userResponse as any)?.transcript ?? ""));
    const hasText = transcript.length > 0;

    const targetNorm = this.targets
      .map((t) => ({ ...t, k: this.norm(t.keyword) }))
      .filter((t) => t.k.length > 0);

    const hits = targetNorm.filter((t) => transcript.includes(t.k)).length;

    let score = 0;
    if (!hasText) score = 0;
    else if (targetNorm.length === 0) score = 0.7;
    else score = Math.min(1, 0.4 + 0.6 * (hits / targetNorm.length));

    const conceptResults: EvaluationResult["conceptResults"] = [];

    if (targetNorm.length > 0) {
      for (const t of targetNorm) {
        const hit = hasText && transcript.includes(t.k);
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
          evidence: { transcriptLength: transcript.length },
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
      feedback: "Listening+speaking interaction scoring is heuristic in MVP.",
      meta: { audioUrl: this.audioUrl, promptText: this.promptText, hits, targets: targetNorm.length },
    };
  }
}
