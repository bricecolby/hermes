// shared/services/practiceGeneration/context/types.ts
export type GenerationContext = {
  learner: {
    userId: string;
    cefr: "A1" | "A2" | "B1" | "B2";
    nativeLanguage: string;   
    targetLanguage: string;   
  };

  session: {
    mode: "reception" | "production" | "interaction" | "mediation";
    skills: ("reading" | "listening" | "writing" | "speaking")[];
  };

  targets: {
    conceptIds: number[];
    vocab?: Array<{ lemma: string; mastery: number }>;
    grammarFocus?: string[];
  };

  constraints?: {
    maxPromptWords?: number;
    maxChoiceWords?: number;
    requireScript?: "cyrillic" | "latin" | "any";
    forbidLatin?: boolean;
  };
};
