// shared/services/practiceGeneration/specs/mcqBasicSpec.ts
import type { PracticeItemSpec } from "./types";
import { qualityCheckMcq } from "../quality/McqQualityChecker";

type McqGenContext = {
  targetLanguage: "Russian";
  cefr: "A1";
  conceptIds: number[]; // allow dynamic later
};

export const mcqBasicSpec: PracticeItemSpec<McqGenContext> = {
  type: "mcq_v1.basic",
  buildPrompt: (ctx) => {
    const system = [
      "You generate content for a language-learning app.",
      "Return ONLY valid JSON (no markdown, no commentary).",
      "All keys and strings must use double quotes.",
      "No trailing commas.",
    ].join(" ");

    const example = [
      "{",
      '  "type": "mcq_v1.basic",',
      '  "mode": "reception",',
      '  "skills": ["reading"],',
      `  "conceptIds": [${ctx.conceptIds[0] ?? 123}],`,
      '  "prompt": "Где находится банк?",',
      '  "choices": [',
      '    {"id":"A","text":"В школе"},',
      '    {"id":"B","text":"В банке"},',
      '    {"id":"C","text":"В парке"},',
      '    {"id":"D","text":"Дома"}',
      "  ],",
      '  "correctChoiceId": "B"',
      "}",
    ].join("\n");

    const user = [
      "Generate ONE practice item JSON for this schema:",
      "{",
      '  "type": "mcq_v1.basic",',
      '  "mode": "reception",',
      '  "skills": ["reading"],',
      `  "conceptIds": ${JSON.stringify(ctx.conceptIds)},`,
      '  "prompt": string,',
      '  "choices": [{"id":"A","text":string},{"id":"B","text":string},{"id":"C","text":string},{"id":"D","text":string}],',
      '  "correctChoiceId": "A" | "B" | "C" | "D"',
      "}",
      "",
      "Constraints:",
      `- Target language: ${ctx.targetLanguage}`,
      `- Learner level: ${ctx.cefr}`,
      "- prompt and choices must be Russian (Cyrillic only; no Latin letters).",
      '- Use EXACTLY these choice ids: "A","B","C","D".',
      "- Keep the prompt under 10 words; each choice under 8 words.",
      "",
      "Example valid output:",
      example,
    ].join("\n");

    return { system, user };
  },
  qualityChecks: [(json) => qualityCheckMcq(json)],
};
