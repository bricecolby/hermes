// shared/services/practiceGeneration/prompts/mcqPrompt.ts
export type PromptPair = { system: string; user: string };

type Focus = {
  conceptId: number;
  target: string;
  resolved?: string;       
  distractors?: string[];
};

function pickWordList(focus: Focus | undefined): string[] {
  const target = (focus?.resolved ?? focus?.target ?? "").trim();
  const ds = (focus?.distractors ?? []).map((s) => s.trim()).filter(Boolean);
  const list = [target, ...ds].filter(Boolean);

  return Array.from(new Set(list)).slice(0, 8);
}

export function buildMcqPrompt(ctx?: any): PromptPair {
  const focus: Focus | undefined = ctx?.focus;

  const conceptId = focus?.conceptId ?? 123;
  const target = (focus?.resolved ?? focus?.target ?? "метро").trim();
  const vocabList = pickWordList(focus);

  const system = [
    "Return ONLY valid JSON.",
    "No markdown. No commentary. No code fences.",
    "Use double quotes for all strings.",
  ].join(" ");

  const user = [
    "TASK: Create ONE multiple-choice question to test ONE Russian word.",
    "",
    "Rules (important):",
    "- Russian only (Cyrillic). No Latin letters.",
    `- Correct answer MUST be exactly: "${target}"`,
    "- Use simple A1 language.",
    "- Use exactly 4 choices with ids A, B, C, D.",
    "- Do NOT repeat the same word in multiple choices.",
    "- Choose distractors from the allowed list when possible.",
    "",
    "Allowed words for choices (use these; do not invent English):",
    vocabList.length ? vocabList.join(", ") : "(none)",
    "",
    "Output MUST match this JSON template exactly (fill in values):",
    "{",
    '  "type": "mcq_v1.basic",',
    '  "mode": "reception",',
    '  "skills": ["reading"],',
    `  "conceptIds": [${conceptId}],`,
    '  "prompt": "…",',
    '  "choices": [',
    '    {"id":"A","text":"…"},',
    '    {"id":"B","text":"…"},',
    '    {"id":"C","text":"…"},',
    '    {"id":"D","text":"…"}',
    "  ],",
    '  "correctChoiceId": "A"',
    "}",
    "",
    "Constraints for prompt:",
    "- Prompt should be a short question or context sentence (5–10 words).",
    "- The prompt must make sense for the correct word.",
    "",
    "Now output ONLY the JSON.",
  ].join("\n");

  return { system, user };
}
