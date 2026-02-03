import { z } from "zod";
import { PracticeItemBaseSchema } from "../practiceItemSchemas";
import type { EvaluationResult } from "../practiceItem";
import { PracticeItem } from "../practiceItem";

export const FlashcardBasicSchema = PracticeItemBaseSchema.extend({
  type: z.literal("flashcard_v1.basic"),
  front: z.string().min(1),
  back: z.string().min(1),
});

export type FlashcardBasicJSON = z.infer<typeof FlashcardBasicSchema>;

export type FlashcardUserResponse = {
  isCorrect: boolean;
};

export class FlashcardBasicPracticeItem extends PracticeItem {
  public readonly front: string;
  public readonly back: string;

  constructor(json: FlashcardBasicJSON) {
    super({
      type: json.type,
      mode: json.mode,
      skills: json.skills,
      conceptIds: json.conceptIds,
    });
    this.front = json.front;
    this.back = json.back;
  }

  evaluate(userResponse: unknown): EvaluationResult {
    const resp = userResponse as Partial<FlashcardUserResponse> | null;
    const isCorrect = resp?.isCorrect === true;

    const conceptResults = this.conceptIds.map((conceptId) => ({
      conceptId,
      score: isCorrect ? 1 : 0,
      maxScore: 1,
      isCorrect,
    }));

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      isCorrect,
      score: isCorrect ? 1 : 0,
      conceptResults,
      feedback: isCorrect ? "Correct." : "Incorrect.",
    };
  }
}
