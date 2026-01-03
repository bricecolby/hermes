import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type FlashcardConfidence = "easy" | "hard" | "forgot" | "unknown";

export type FlashcardBasicJSON = PracticeItemJSON & {
  front: string;       // prompt side
  back: string;        // answer side
  example?: string;    // optional usage example
};

export type FlashcardSubmission = {
  revealed?: boolean;                 // user flipped card
  confidence?: FlashcardConfidence;   // self-reported recall
};

export class FlashcardBasicPracticeItem extends PracticeItem {
  private readonly front: string;
  private readonly back: string;
  private readonly example?: string;

  constructor(json: FlashcardBasicJSON) {
    super({
      type: json.type,
      mode: json.mode,
      skills: json.skills,
      conceptIds: json.conceptIds,
    });

    this.front = String(json.front);
    this.back = String(json.back);
    this.example = json.example != null ? String(json.example) : undefined;
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const submission = (userResponse ?? {}) as FlashcardSubmission;

    const confidence: FlashcardConfidence =
      submission.confidence ?? "unknown";

    // "forgot" is objectively incorrect; others are "correct" in the sense of recall.
    const isCorrect = confidence !== "forgot" && confidence !== "unknown";

    // Strength score (0..1). Useful later for spaced repetition scheduling.
    const score =
      confidence === "easy" ? 1 :
      confidence === "hard" ? 0.5 :
      confidence === "forgot" ? 0 :
      0.25; // unknown/other: low credit for engagement

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      isCorrect,
      score,
      conceptResults: this.conceptIds.map((conceptId) => ({
        conceptId,
        isCorrect,
        score,
        maxScore: 1,
        evidence: {
          revealed: submission.revealed ?? false,
          confidence,
        },
      })),
      feedback: "Flashcard reviewed.",
    };
  }

  override toJSON(): FlashcardBasicJSON {
    return {
      ...super.toJSON(),
      front: this.front,
      back: this.back,
      example: this.example,
    };
  }
}
