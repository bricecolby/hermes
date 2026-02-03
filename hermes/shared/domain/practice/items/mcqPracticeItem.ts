import { z } from "zod";
import { PracticeItemBaseSchema } from "../practiceItemSchemas";
import type { EvaluationResult } from "../practiceItem";
import { PracticeItem } from "../practiceItem";

export const McqBasicSchema = PracticeItemBaseSchema.extend({
  type: z.literal("mcq_v1.basic"),
  prompt: z.string().min(1),
  choices: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
      })
    )
    .min(2),
  correctChoiceId: z.string().min(1),
});

export type McqBasicJSON = z.infer<typeof McqBasicSchema>;

export type McqUserResponse = {
  choiceId: string;
};

export class McqBasicPracticeItem extends PracticeItem {
  public readonly prompt: string;
  public readonly choices: { id: string; text: string }[];
  public readonly correctChoiceId: string;

  constructor(json: McqBasicJSON) {
    super({
      type: json.type,
      mode: json.mode,
      skills: json.skills,
      conceptIds: json.conceptIds,
    });
    this.prompt = json.prompt;
    this.choices = json.choices;
    this.correctChoiceId = json.correctChoiceId;
  }

  evaluate(userResponse: unknown): EvaluationResult {
    const resp = userResponse as Partial<McqUserResponse> | null;
    const choiceId = typeof resp?.choiceId === "string" ? resp.choiceId : "";
    const isCorrect = choiceId === this.correctChoiceId;

    const conceptResults = this.conceptIds.map((conceptId) => ({
      conceptId,
      score: isCorrect ? 1 : 0,
      maxScore: 1,
      isCorrect,
      evidence: { choiceId, correctChoiceId: this.correctChoiceId },
    }));

    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      isCorrect,
      score: isCorrect ? 1 : 0,
      conceptResults,
      feedback: isCorrect ? "Correct." : "Incorrect.",
      meta: { choiceId },
    };
  }
}
