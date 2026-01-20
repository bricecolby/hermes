// shared/services/practiceGeneration/specs/clozeFreeFillSpec.ts
import type { PracticeItemSpec } from "./types";
import type { GenerationContext } from "../context/types";

function scriptConstraintLine(ctx: GenerationContext): string | null {
  if (ctx.constraints?.requireScript === "cyrillic") {
    return "- Use Cyrillic only (no Latin letters).";
  }
  if (ctx.constraints?.forbidLatin) {
    return "- Do not use Latin letters.";
  }
  return null;
}

export const clozeFreeFillSpec: PracticeItemSpec<GenerationContext> = {
  type: "cloze_v1.free_fill",
  buildPrompt: (ctx) => {
    const system = [
      "You generate content for a language-learning app.",
      "Return ONLY valid JSON (no markdown, no commentary).",
      "All keys and strings must use double quotes.",
      "No trailing commas.",
    ].join(" ");

    const example = [
      "{",
      '  "type": "cloze_v1.free_fill",',
      '  "mode": "reception",',
      '  "skills": ["reading"],',
      '  "conceptIds": [123],',
      '  "parts": [',
      '    { "type": "text", "value": "Я иду в " },',
      '    { "type": "blank", "id": "b1", "accepted": ["метро"], "conceptId": 123 },',
      '    { "type": "text", "value": "." }',
      "  ]",
      "}",
    ].join("\n");

    const constraints: string[] = [
      `- Target language: ${ctx.learner.targetLanguage}`,
      `- Learner level: ${ctx.learner.cefr}`,
      `- conceptIds must be ${JSON.stringify(ctx.targets.conceptIds)}`,
      "- Keep it short (<= 10 words total).",
      '- Use exactly ONE blank with id "b1".',
      "- The blank accepted list must contain exactly ONE correct answer.",
      "- The blank conceptId must be one of conceptIds.",
    ];

    const scriptLine = scriptConstraintLine(ctx);
    if (scriptLine) constraints.splice(2, 0, scriptLine);

    const user = [
      "Generate ONE practice item JSON for this schema:",
      "{",
      '  "type": "cloze_v1.free_fill",',
      `  "mode": "${ctx.session.mode}",`,
      `  "skills": ${JSON.stringify(ctx.session.skills)},`,
      `  "conceptIds": ${JSON.stringify(ctx.targets.conceptIds)},`,
      '  "parts": Array<',
      '    | { "type":"text",  "value": string }',
      '    | { "type":"blank", "id": string, "accepted": string[], "conceptId": number }',
      "  >",
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
};
