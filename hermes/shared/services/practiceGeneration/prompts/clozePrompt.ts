// shared/services/practiceGeneration/prompts/clozePrompt.ts
export type PromptPair = { system: string; user: string };

export function buildClozePrompt(): PromptPair {
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

  const user = [
    "Generate ONE practice item JSON for this schema:",
    "{",
    '  "type": "cloze_v1.free_fill",',
    '  "mode": "reception",',
    '  "skills": ["reading"],',
    '  "conceptIds": [123],',
    '  "parts": Array<',
    '    | { "type":"text",  "value": string }',
    '    | { "type":"blank", "id": string, "accepted": string[], "conceptId": number }',
    "  >",
    "}",
    "",
    "Constraints:",
    "- Target language: Russian",
    "- Learner level: A1",
    "- All learner-visible text must be Cyrillic only (no Latin letters).",
    "- conceptIds must be [123] exactly.",
    '- Use exactly ONE blank with id \"b1\".',
    "- The blank's accepted list must contain exactly ONE correct answer.",
    "- Keep it short (<= 10 words total).",
    "",
    "Example valid output:",
    example,
  ].join("\n");

  return { system, user };
}
