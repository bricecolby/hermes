import { PracticeItem, EvaluationResult } from "../practiceItem";
import { z } from "zod";
import { PracticeItemBaseSchema } from "../practiceItemSchemas";

export const McqBasicSchema = PracticeItemBaseSchema.extend({
  type: z.literal("mcq_v1.basic"),
  prompt: z.string().min(1),
  choices: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(2),
  correctChoiceId: z.string().min(1),
}).superRefine((val, ctx) => {
  if (!val.choices.some((c) => c.id === val.correctChoiceId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correctChoiceId"],
      message: "correctChoiceId must match one of choices[].id",
    });
  }
});

export type McqBasicJSON = z.infer<typeof McqBasicSchema>;

export class McqBasicPracticeItem extends PracticeItem {
  private readonly prompt: string;
  private readonly choices: { id: string; text: string }[];
  private readonly correctChoiceId: string;

  constructor(json: McqBasicJSON) {
    super(json); // base fields already validated
    this.prompt = json.prompt;
    this.choices = json.choices;
    this.correctChoiceId = json.correctChoiceId;
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const chosen = (userResponse as any)?.choiceId;
    const isCorrect = chosen === this.correctChoiceId;
    const score = isCorrect ? 1 : 0;

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
        evidence: { chosen, correctChoiceId: this.correctChoiceId },
      })),
      feedback: isCorrect ? "Correct." : "Incorrect.",
    };
  }

  override toJSON(): McqBasicJSON {
    return {
      ...super.toJSON(),
      type: "mcq_v1.basic",
      prompt: this.prompt,
      choices: this.choices,
      correctChoiceId: this.correctChoiceId,
    };
  }
}
