export type PracticeItemJSON = {
    type: string;
    conceptIds: number[];
    [key: string]: unknown;
};

export type EvaluationResult = {
    isCorrect?: boolean;
    score?: number;

    conceptResults?: {
        conceptId: number;
        isCorrect?: boolean;
        score?: number;
        weight?: number;
        evidence?: unknown;
    }[];

    feedback?: string;
    meta?: Record<string, unknown>;
};

export abstract class PracticeItem {
    public readonly type: string;
    public readonly conceptIds: number[];

    protected constructor(props: { type: string; conceptIds: number[] }) {
        if (!props.type) throw new Error("PracticeItem.type is required.");
        if (!Array.isArray(props.conceptIds) || props.conceptIds.length === 0) {
            throw new Error("PracticeItem.conceptIds must be a non-empty array.");
        }
        this.type = props.type;
        this.conceptIds = props.conceptIds;
    }

    evaluate(_userResponse: unknown): EvaluationResult {
        throw new Error(
            `PracticeItem.evaluate() not implemented for type "${this.type}". ` + 
            `Did you forget to override evaluate() in the subclass?`
        );
    }

    toJSON(): PracticeItemJSON {
        return {
            type: this.type,
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
        if (!Array.isArray(obj.conceptIds) || obj.conceptIds.length === 0) {
            throw new Error("PracticeItem JSON must have a non-empty array 'conceptIds' field.");
        }
        if (!obj.conceptIds.every((x) => typeof x === "number" && Number.isFinite(x))) {
            throw new Error("PracticeItem JSON 'conceptIds' field must be an array of numbers.");
        }
    }
}