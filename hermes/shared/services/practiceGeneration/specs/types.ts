// shared/services/practiceGeneration/specs/types.ts
export type PromptPair = { system: string; user: string };

export type PromptBuilder<TContext = unknown> = (ctx: TContext) => PromptPair;

export type QualityCheck = (json: unknown) => string[];

export type PracticeItemSpec<TContext = unknown> = {
  type: string; // e.g. "mcq_v1.basic"
  buildPrompt: PromptBuilder<TContext>;
  qualityChecks?: QualityCheck[];
};
