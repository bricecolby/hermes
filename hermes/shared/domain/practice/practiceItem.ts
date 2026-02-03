// shared/domain/practice/practiceItem.ts
import { z } from "zod";
import {
  PracticeItemBaseSchema,
  PracticeModeSchema,
  PracticeSkillSchema,
  type PracticeItemBaseJSON,
  type PracticeMode,
  type PracticeSkill,
} from "./practiceItemSchemas";

export type PracticeItemJSON = PracticeItemBaseJSON & {
  [key: string]: unknown;
};

export type ConceptEvaluationResult = {
  conceptId: number;
  score: number;
  maxScore: number;
  isCorrect?: boolean;
  weight?: number;
  evidence?: unknown;
};

export type EvaluationResult = {
  type: string;
  mode: PracticeMode;
  skills: PracticeSkill[];

  isCorrect?: boolean;
  score: number;

  conceptResults: ConceptEvaluationResult[];

  feedback?: string;
  meta?: Record<string, unknown>;
};

export abstract class PracticeItem {
  public readonly type: string;
  public readonly mode: PracticeMode;
  public readonly skills: PracticeSkill[];
  public readonly conceptIds: number[];

  protected constructor(props: {
    type: string;
    mode: PracticeMode;
    skills: PracticeSkill[];
    conceptIds: number[];
  }) {
    if (!props.type) throw new Error("PracticeItem.type is required.");
    this.type = props.type;
    this.mode = props.mode;
    this.skills = props.skills;
    this.conceptIds = props.conceptIds;
  }

  abstract evaluate(userResponse: unknown): EvaluationResult;

  toJSON(): PracticeItemJSON {
    return {
      type: this.type,
      mode: this.mode,
      skills: this.skills,
      conceptIds: this.conceptIds,
    };
  }

  static parseBase(json: unknown): PracticeItemJSON {
    const base = PracticeItemBaseSchema.parse(json);

    if (json && typeof json === "object") {
      return { ...(json as Record<string, unknown>), ...base } as PracticeItemJSON;
    }

    return base as PracticeItemJSON;
  }

  static assertBaseShape(json: unknown): asserts json is PracticeItemJSON {
    PracticeItem.parseBase(json);
  }

  static parseMode(mode: unknown): PracticeMode {
    return PracticeModeSchema.parse(mode);
  }

  static parseSkills(skills: unknown): PracticeSkill[] {
    return z.array(PracticeSkillSchema).min(1).parse(skills);
  }
}
