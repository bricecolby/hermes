export type PracticeMode = "reception" | "production" | "interaction" | "mediation";
export type AtomicSkill = "reading" | "listening" | "writing" | "speaking";

export type PracticeItemJSON = {
    type: string;
    mode: PracticeMode;
    skills: AtomicSkill[]
    conceptIds: number[];
    [key: string]: unknown;
};

export type ConceptEvaluationResult = {
    conceptId: number;
    score: number;
    maxScore: number;
    isCorrect?: boolean;
    weight?: number;
    evidence?: unknown;
}


export type EvaluationResult = {
    type: string;
    mode: PracticeMode;
    skills: AtomicSkill[];

    isCorrect?: boolean;
    score: number;

    conceptResults: ConceptEvaluationResult[];

    feedback?: string;
    meta?: Record<string, unknown>;
};

export abstract class PracticeItem {
    public readonly type: string;
    public readonly mode: PracticeMode;
    public readonly skills: AtomicSkill[];
    public readonly conceptIds: number[];


    protected constructor(props: { 
        type: string; 
        mode: PracticeMode; 
        skills: AtomicSkill[]; 
        conceptIds: number[] 
    }) {
        if (!props.type) throw new Error("PracticeItem.type is required.");
        if (!props.mode) throw new Error("PracticeItem.mode is required.");
        if (!Array.isArray(props.skills) || props.skills.length === 0) {
            throw new Error("PracticeItem.skills must be a non-empty array.");
        }
        if (!Array.isArray(props.conceptIds) || props.conceptIds.length === 0) {
            throw new Error("PracticeItem.conceptIds must be a non-empty array.");
        }
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


  static assertBaseShape(json: unknown): asserts json is PracticeItemJSON {
    if (!json || typeof json !== "object") {
      throw new Error("PracticeItem JSON must be an object.");
    }
    const obj = json as Record<string, unknown>;

    if (typeof obj.type !== "string" || obj.type.length === 0) {
      throw new Error("PracticeItem JSON must have a non-empty string 'type' field.");
    }

    if (
      typeof obj.mode !== "string" ||
      !["reception", "production", "interaction", "mediation"].includes(obj.mode)
    ) {
      throw new Error(
        "PracticeItem JSON must have a valid 'mode' field: reception | production | interaction | mediation."
      );
    }

    if (!Array.isArray(obj.skills) || obj.skills.length === 0) {
      throw new Error("PracticeItem JSON must have a non-empty array 'skills' field.");
    }
    if (
      !obj.skills.every(
        (x) => typeof x === "string" && ["reading", "listening", "writing", "speaking"].includes(x)
      )
    ) {
      throw new Error(
        "PracticeItem JSON 'skills' field must be an array containing only: reading | listening | writing | speaking."
      );
    }

    if (!Array.isArray(obj.conceptIds) || obj.conceptIds.length === 0) {
      throw new Error("PracticeItem JSON must have a non-empty array 'conceptIds' field.");
    }
    if (!obj.conceptIds.every((x) => typeof x === "number" && Number.isFinite(x))) {
      throw new Error("PracticeItem JSON 'conceptIds' field must be an array of numbers.");
    }
  }
}