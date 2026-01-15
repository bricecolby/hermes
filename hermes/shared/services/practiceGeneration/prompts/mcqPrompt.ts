// shared/services/practiceGeneration/prompts/mcqPrompt.ts
export type PromptPair = { system: string; user: string };

export function buildMcqPrompt(): PromptPair {
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
    '  "conceptIds": [123],',
    '  "prompt": string,',
    '  "choices": [{"id":"A","text":string},{"id":"B","text":string},{"id":"C","text":string},{"id":"D","text":string}],',
    '  "correctChoiceId": "A" | "B" | "C" | "D"',
    "}",
    "",
    "Constraints:",
    "- Target language: Russian",
    "- Learner level: A1",
    "- prompt and choices must be Russian (Cyrillic only; no Latin letters).",
    '- Use EXACTLY these choice ids: "A","B","C","D".',
    "- Keep the prompt under 10 words; each choice under 8 words.",
    "- conceptIds must be [123] exactly.",
    "",
    "Example valid output:",
    example,
  ].join("\n");

  return { system, user };
}
