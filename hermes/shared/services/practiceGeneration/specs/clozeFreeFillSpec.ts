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
      "You generate cloze items for a language-learning app.",
      "Return ONLY valid compact JSON on one line.",
      "No markdown, no code fences, no commentary.",
      "Use double quotes for all keys and strings.",
    ].join(" ");

    const example =
      '{"type":"cloze_v1.free_fill","mode":"production","skills":["writing"],"conceptIds":[123],"parts":[{"type":"text","value":"Мы идем в "},{"type":"blank","id":"b1","accepted":["вокзал"],"conceptId":123},{"type":"text","value":" после работы."}]}';

    const familiarVocab = (ctx.targets.vocab ?? [])
      .slice(0, 12)
      .map((v) => `${v.lemma} (${v.mastery.toFixed(2)})`);

    const constraints: string[] = [
      `- Target language: ${ctx.learner.targetLanguage}`,
      `- Learner level: ${ctx.learner.cefr}`,
      `- conceptIds must be ${JSON.stringify(ctx.targets.conceptIds)}`,
      `- Mode must be "${ctx.session.mode}".`,
      `- Skills must be ${JSON.stringify(ctx.session.skills)}.`,
      "- Keep it short (<= 12 words total).",
      "- Keep total JSON output concise (target <= 420 characters).",
      "- parts must be EXACTLY 3 elements: text, blank, text.",
      "- blank can be anywhere in the sentence, but text before and after must both be non-empty.",
      '- Use exactly ONE blank with id "b1".',
      "- accepted must be an inflected/conjugated form set of the SAME target lemma (word family), not a different word.",
      "- The blank accepted list must include all valid answer forms for this exact sentence context.",
      "- Do not use the blank answer form anywhere else in the sentence text.",
      "- Do not include distractors in accepted.",
      "- If there is only one valid form, accepted should have exactly one value.",
      "- If multiple forms are valid (e.g., gender variants), include each valid form.",
      "- Keep accepted to 1-4 concise forms.",
      "- The blank conceptId must be one of conceptIds.",
      "- Do NOT include glosses, translations, or lemma hints in parentheses in the sentence.",
      "- The sentence itself must stay entirely in the target language/script.",
    ];

    const scriptLine = scriptConstraintLine(ctx);
    if (scriptLine) constraints.splice(2, 0, scriptLine);

    const user = [
      "Generate ONE cloze JSON object.",
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
      "Preferred familiarity guidance (soft constraint):",
      familiarVocab.length > 0
        ? `- Prefer using familiar vocabulary for non-blank words when natural: ${familiarVocab.join(", ")}`
        : "- No familiarity list available. Use level-appropriate words.",
      "- This is guidance, not a hard rule.",
      `- Focus target lemma: ${String((ctx as any)?.focus?.resolved ?? (ctx as any)?.focus?.target ?? "").trim()}`,
      "",
      "Example valid output:",
      example,
      "",
      "Return ONLY one compact JSON object.",
    ].join("\n");

    return { system, user };
  },
};
