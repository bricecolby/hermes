// shared/services/practiceGeneration/specs/mcqBasicSpec.ts
import type { PracticeItemSpec } from "./types";
import type { GenerationContext } from "../context/types";
import { qualityCheckMcq } from "../quality/McqQualityChecker";

function scriptConstraintLine(ctx: GenerationContext): string | null {
  if (ctx.constraints?.requireScript === "cyrillic") {
    return "- Use Cyrillic only (no Latin letters).";
  }
  if (ctx.constraints?.forbidLatin) {
    return "- Do not use Latin letters.";
  }
  return null;
}

export const mcqBasicSpec: PracticeItemSpec<GenerationContext> = {
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
      '  "conceptIds": [123],',
      '  "prompt": "Где метро?",',
      '  "choices": [{"id":"A","text":"Там"},{"id":"B","text":"Здесь"},{"id":"C","text":"Сейчас"},{"id":"D","text":"Потом"}],',
      '  "correctChoiceId": "B"',
      "}",
    ].join("\n");

    const constraints: string[] = [
      `- Target language: ${ctx.learner.targetLanguage}`,
      `- Learner level: ${ctx.learner.cefr}`,
      `- conceptIds must be ${JSON.stringify(ctx.targets.conceptIds)}`,
      `- Keep the prompt under ${ctx.constraints?.maxPromptWords ?? 10} words; each choice under ${ctx.constraints?.maxChoiceWords ?? 8} words.`,
      '- Use EXACTLY these choice ids: "A","B","C","D".',
    ];

    const scriptLine = scriptConstraintLine(ctx);
    if (scriptLine) constraints.splice(2, 0, scriptLine);

    const user = [
      "Generate ONE practice item JSON for this schema:",
      "{",
      '  "type": "mcq_v1.basic",',
      `  "mode": "${ctx.session.mode}",`,
      `  "skills": ${JSON.stringify(ctx.session.skills)},`,
      `  "conceptIds": ${JSON.stringify(ctx.targets.conceptIds)},`,
      '  "prompt": string,',
      '  "choices": [{"id":"A","text":string},{"id":"B","text":string},{"id":"C","text":string},{"id":"D","text":string}],',
      '  "correctChoiceId": "A" | "B" | "C" | "D"',
      "}",
      "",
      "Constraints:",
      ...constraints,
      "",
      "Example valid output:",
      example,
    ].join("\n");

    return { system, user };
  },
  qualityChecks: [(json) => qualityCheckMcq(json)],
};
