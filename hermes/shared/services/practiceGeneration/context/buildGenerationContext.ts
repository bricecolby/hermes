// shared/services/practiceGeneration/context/buildGenerationContext.ts
import type { GenerationContext } from "./types";

export async function buildGenerationContext(input: {
  userId: string;
  mode: GenerationContext["session"]["mode"];
  skills: GenerationContext["session"]["skills"];
  conceptIds: number[];
  learner?: Partial<Omit<GenerationContext["learner"], "userId">>;
  vocab?: GenerationContext["targets"]["vocab"];
  grammarFocus?: GenerationContext["targets"]["grammarFocus"];
  constraints?: GenerationContext["constraints"];
}): Promise<GenerationContext> {
  const constraints = {
    maxPromptWords: 10,
    maxChoiceWords: 8,
    requireScript: "cyrillic" as const,
    forbidLatin: true,
    ...(input.constraints ?? {}),
  };

  return {
    learner: {
      userId: input.userId,
      cefr: "A1",
      nativeLanguage: "English",
      targetLanguage: "Russian",
      ...input.learner,
    },
    session: { mode: input.mode, skills: input.skills },
    targets: {
      conceptIds: input.conceptIds,
      vocab: input.vocab,
      grammarFocus: input.grammarFocus,
    },
    constraints,
  };
}
