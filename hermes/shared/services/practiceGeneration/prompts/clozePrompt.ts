// shared/services/practiceGeneration/prompts/clozePrompt.ts
export type PromptPair = { system: string; user: string };

type Focus = {
  conceptId: number;
  target: string;
  resolved?: string;
  distractors?: string[];
};

function pickAccepted(focus: Focus | undefined): string[] {
  const target = (focus?.resolved ?? focus?.target ?? "").trim();
  const ds = (focus?.distractors ?? []).map((s) => s.trim()).filter(Boolean);

  const list = [target, ...ds].filter(Boolean);
  const uniq = Array.from(new Set(list));

  const out = uniq.slice(0, 4);
  while (out.length < 4) out.push("парк");
  return out;
}

export function buildClozePrompt(ctx?: any): PromptPair {
  const focus: Focus | undefined = ctx?.focus;

  const conceptId = focus?.conceptId ?? 123;
  const target = (focus?.resolved ?? focus?.target ?? "метро").trim();
  const accepted = pickAccepted(focus);

  const system = [
    "Return ONLY valid JSON.",
    "No markdown. No commentary.",
    "Use double quotes for all strings.",
  ].join(" ");

  const user = [
    "TASK: Create ONE cloze (fill-in-the-blank) sentence for ONE Russian word.",
    "",
    "Rules (important):",
    "- Russian only (Cyrillic). No Latin letters.",
    `- The correct missing word MUST be exactly: "${target}"`,
    "- Use simple A1 language.",
    "- You MUST output parts as EXACTLY 3 elements: text, blank, text.",
    '- The blank MUST have id "b1".',
    `- conceptIds MUST be [${conceptId}]`,
    `- The blank accepted list MUST be exactly 4 options and MUST include "${target}".`,
    "",
    "Output MUST match this JSON template exactly (fill in values):",
    "{",
    '  "type": "cloze_v1.free_fill",',
    '  "mode": "reception",',
    '  "skills": ["reading"],',
    `  "conceptIds": [${conceptId}],`,
    '  "parts": [',
    '    { "type": "text", "value": "…" },',
    `    { "type": "blank", "id": "b1", "accepted": ${JSON.stringify(accepted)}, "conceptId": ${conceptId} },`,
    '    { "type": "text", "value": "…" }',
    "  ]",
    "}",
    "",
    "Constraints for the sentence:",
    "- Total sentence should be <= 10 words.",
    "- The sentence must clearly fit the missing word.",
    "",
    "Now output ONLY the JSON.",
  ].join("\n");

  return { system, user };
}
