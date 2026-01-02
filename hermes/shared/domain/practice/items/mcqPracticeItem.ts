import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

export type McqBasicJSON = PracticeItemJSON & {
  prompt: string;
  choices: { id: string; text: string }[];
  correctChoiceId: string;
};

export class McqBasicPracticeItem extends PracticeItem {
  private readonly prompt: string;
  private readonly choices: { id: string; text: string }[];
  private readonly correctChoiceId: string;

  constructor(json: McqBasicJSON) {
    super({ type: json.type, mode: json.mode, skills: json.skills, conceptIds: json.conceptIds });
    this.prompt = String(json.prompt);
    this.choices = (json.choices ?? []) as any;
    this.correctChoiceId = String(json.correctChoiceId);
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
      prompt: this.prompt,
      choices: this.choices,
      correctChoiceId: this.correctChoiceId,
    };
  }
}
