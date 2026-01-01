import { PracticeItem, PracticeItemJSON, EvaluationResult } from "../practiceItem";

type MCQJSON = PracticeItemJSON & {
  prompt: string;
  choices: {id: string, text: string }[];
  correctChoiceId: string;
};

export class MultipleChoicePracticeItem extends PracticeItem {
  private readonly prompt: string;
  private readonly choices: Array<{ id: string; text: string }>;
  private readonly correctChoiceId: string;

  constructor(json: MCQJSON) {
    super({ type: json.type, conceptIds: json.conceptIds });
    this.prompt = String(json.prompt);
    this.choices = (json.choices ?? []) as any;
    this.correctChoiceId = String(json.correctChoiceId);
  }

  override evaluate(userResponse: unknown): EvaluationResult {
    const chosen = (userResponse as any)?.choiceId;
    const isCorrect = chosen === this.correctChoiceId;

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      conceptResults: this.conceptIds.map((conceptId) => ({
        conceptId,
        isCorrect,
        score: isCorrect ? 1 : 0,
      })),
    };
  }

  override toJSON(): MCQJSON {
    return {
      ...super.toJSON(),
      prompt: this.prompt,
      choices: this.choices,
      correctChoiceId: this.correctChoiceId,
    };
  }
}
