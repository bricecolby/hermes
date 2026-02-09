// shared/services/practiceGeneration/prompts/clozePrompt.ts
export type PromptPair = { system: string; user: string };

type Focus = {
  conceptId: number;
  target: string;
  resolved?: string;
};

function scriptConstraintLine(ctx?: any): string | null {
  if (ctx?.constraints?.requireScript === "cyrillic") {
    return "- Use Cyrillic only (no Latin letters).";
  }
  if (ctx?.constraints?.forbidLatin) {
    return "- Do not use Latin letters.";
  }
  return null;
}

export function buildClozePrompt(ctx?: any): PromptPair {
  const focus: Focus | undefined = ctx?.focus;

  const conceptId = focus?.conceptId ?? 123;
  const target = (focus?.resolved ?? focus?.target ?? "читать").trim();
  const mode = ctx?.session?.mode ?? "production";
  const skills = Array.isArray(ctx?.session?.skills) && ctx.session.skills.length > 0
    ? ctx.session.skills
    : ["writing"];

  const familiarVocab = (Array.isArray(ctx?.targets?.vocab) ? ctx.targets.vocab : [])
    .slice(0, 40)
    .map((v: any) => `${String(v?.lemma ?? "").trim()} (${Number(v?.mastery ?? 0).toFixed(2)})`)
    .filter((s: string) => !s.startsWith(" ("));

  const constraints = [
    `- conceptIds must be [${conceptId}].`,
    `- Mode must be "${mode}".`,
    `- Skills must be ${JSON.stringify(skills)}.`,
    "- Keep it short (<= 12 words total).",
    '- Use exactly ONE blank with id "b1".',
    "- The blank accepted list must include all valid answer forms for this exact sentence context.",
    "- Do not include distractors in accepted.",
    "- If there is only one valid form, accepted should have exactly one value.",
    "- If multiple forms are valid (e.g., gender variants), include each valid form.",
    "- Keep accepted to 1-4 concise forms.",
    "- The blank conceptId must equal the target conceptId.",
    `- The blank should test this target word family when natural: "${target}".`,
  ];
  const scriptLine = scriptConstraintLine(ctx);
  if (scriptLine) constraints.splice(1, 0, scriptLine);

  const system = [
    "You generate content for a language-learning app.",
    "Return ONLY valid JSON.",
    "No markdown. No commentary.",
    "Use double quotes for all strings.",
    "No trailing commas.",
  ].join(" ");

  const user = [
    "Generate ONE practice item JSON for this schema:",
    "{",
    '  "type": "cloze_v1.free_fill",',
    `  "mode": "${mode}",`,
    `  "skills": ${JSON.stringify(skills)},`,
    `  "conceptIds": [${conceptId}],`,
    '  "parts": Array<',
    '    | { "type":"text",  "value": string }',
    '    | { "type":"blank", "id": string, "accepted": string[], "conceptId": number }',
    "  >",
    "}",
    "",
    "Constraints:",
    ...constraints,
    "",
    "Preferred familiarity guidance (soft constraint):",
    familiarVocab.length > 0
      ? `- Prefer using familiar vocabulary for non-blank words when natural: ${familiarVocab.join(", ")}`
      : "- No familiarity list available. Use level-appropriate words.",
    "- This is guidance, not a hard rule.",
    "",
    "Example valid output:",
    "{",
    '  "type": "cloze_v1.free_fill",',
    `  "mode": "${mode}",`,
    `  "skills": ${JSON.stringify(skills)},`,
    `  "conceptIds": [${conceptId}],`,
    '  "parts": [',
    '    { "type": "text", "value": "Ты " },',
    `    { "type": "blank", "id": "b1", "accepted": ["читаешь"], "conceptId": ${conceptId} },`,
    '    { "type": "text", "value": " (читать)." }',
    "  ]",
    "}",
  ].join("\n");

  return { system, user };
}
