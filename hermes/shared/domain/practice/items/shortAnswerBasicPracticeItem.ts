import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type ShortAnswerBasicJSON = PracticeItemJSON & {
  prompt: string;
  acceptedAnswers: string[];
  keywords?: string[];
};

export class ShortAnswerBasicPracticeItem extends PracticeItem {
  private readonly prompt: string;
  private readonly accepted: string[];
  private readonly keywords: string[];

  constructor(json: ShortAnswerBasicJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.prompt = String(json.prompt);
    this.accepted = (json.acceptedAnswers ?? []).map((s) => String(s));
    this.keywords = (json.keywords ?? []).map((s) => String(s));
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
      isCorrect = false;
    } else if (acceptedNorm.includes(response)) {
      score = 1;
      isCorrect = true;
    } else if (this.keywords.length > 0) {
      const hits = this.keywords
        .map((k) => this.norm(k))
        .filter((k) => k.length > 0 && response.includes(k)).length;
      score = Math.min(0.9, hits / Math.max(1, this.keywords.length));
      isCorrect = false;
    } else {
      score = 0.5; // non-empty attempt credit (MVP heuristic)
      isCorrect = false;
    }

    const conceptResults = this.conceptIds.map((conceptId) => ({
      conceptId,
      score,
      maxScore: 1,
      isCorrect,
      evidence: { response, accepted: this.accepted, keywords: this.keywords },
    }));

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      score,
      isCorrect,
      conceptResults,
      feedback: isCorrect ? "Correct." : "Submitted. (Heuristic scoring in MVP.)",
      meta: { prompt: this.prompt },
    };
  }
}
