import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type ShortAnswerSpokenStubJSON = PracticeItemJSON & {
  prompt: string;
  acceptedTranscripts?: string[];
};

export class ShortAnswerSpokenStubPracticeItem extends PracticeItem {
  private readonly prompt: string;
  private readonly accepted: string[];

  constructor(json: ShortAnswerSpokenStubJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.prompt = String(json.prompt);
    this.accepted = (json.acceptedTranscripts ?? []).map((s) => String(s));
  }

  private norm(s: string): string {
    return s.trim().toLowerCase();
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const transcript = this.norm(String((userResponse as any)?.transcript ?? ""));
    const hasAttempt = transcript.length > 0;

    const acceptedNorm = this.accepted.map((a) => this.norm(a));
    const isCorrect =
      hasAttempt && acceptedNorm.length > 0 ? acceptedNorm.includes(transcript) : undefined;

    const score = isCorrect === true ? 1 : hasAttempt ? 0.6 : 0;

    const conceptResults = this.conceptIds.map((conceptId) => ({
      conceptId,
      score,
      maxScore: 1,
      isCorrect,
      evidence: { transcript },
    }));

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      score,
      isCorrect,
      conceptResults,
      feedback: "Spoken evaluation is stubbed in MVP (no ASR/LLM scoring yet).",
      meta: { prompt: this.prompt },
    };
  }
}
