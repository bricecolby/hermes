import { z } from "zod";
import { PracticeItem, EvaluationResult } from "../practiceItem";
import { PracticeItemBaseSchema } from "../practiceItemSchemas";

export type FlashcardConfidence = "easy" | "hard" | "forgot" | "unknown";

export const FlashcardBasicSchema = PracticeItemBaseSchema.extend({
  type: z.literal("flashcard_v1.basic"),
  front: z.string().min(1),
  back: z.string().min(1),
  example: z.string().optional(),
});

export type FlashcardBasicJSON = z.infer<typeof FlashcardBasicSchema>;

export type FlashcardSubmission = {
  revealed?: boolean;
  confidence?: FlashcardConfidence;
};

export class FlashcardBasicPracticeItem extends PracticeItem {
  private readonly front: string;
  private readonly back: string;
  private readonly example?: string;

  constructor(json: FlashcardBasicJSON) {
    super(json);
    this.front = json.front;
    this.back = json.back;
    this.example = json.example;
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const submission = (userResponse ?? {}) as FlashcardSubmission;
    const confidence: FlashcardConfidence = submission.confidence ?? "unknown";

    const isCorrect = confidence !== "forgot" && confidence !== "unknown";

    const score =
      confidence === "easy"
        ? 1
        : confidence === "hard"
        ? 0.5
        : confidence === "forgot"
        ? 0
        : 0.25;

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
      type: "flashcard_v1.basic",
      front: this.front,
      back: this.back,
      example: this.example,
    };
  }
}
