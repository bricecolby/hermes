// shared/services/practiceGeneration/context/buildGenerationContext.ts
import type { GenerationContext } from "./types";

export async function buildGenerationContext(input: {
  userId: string;
  mode: GenerationContext["session"]["mode"];
  skills: GenerationContext["session"]["skills"];
  conceptIds: number[];
}): Promise<GenerationContext> {
  // TODO: fetch learner profile, mastery, target language, etc.
  return {
    learner: {
      userId: input.userId,
      cefr: "A1",
      nativeLanguage: "English",
      targetLanguage: "Russian",
    },
    session: { mode: input.mode, skills: input.skills },
    targets: { conceptIds: input.conceptIds },
    constraints: {
      maxPromptWords: 10,
      maxChoiceWords: 8,
      requireScript: "cyrillic",
      forbidLatin: true,
    },
  };
}
