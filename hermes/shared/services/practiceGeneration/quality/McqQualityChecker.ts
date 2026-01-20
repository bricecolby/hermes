// shared/services/practiceGeneration/quality/McqQualityChecker.ts
import { hasCyrillic, hasLatin, normalizeWhitespace } from "./textQualityUtils";

export type McqChoiceLoose = { id?: unknown; text?: unknown };

export function qualityCheckMcq(parsed: any, focusWord?: string): string[] {
  const issues: string[] = [];

  const prompt = normalizeWhitespace(String(parsed?.prompt ?? ""));
  if (prompt.length < 6) issues.push("prompt too short");
  if (!hasCyrillic(prompt)) issues.push("prompt missing Cyrillic");
  if (hasLatin(prompt)) issues.push("prompt contains Latin letters");
  if (prompt.split(" ").length > 10) issues.push("prompt too long for A1");

  const choices: McqChoiceLoose[] = Array.isArray(parsed?.choices)
    ? (parsed.choices as McqChoiceLoose[])
    : [];
  if (choices.length !== 4) issues.push("choices must be exactly 4");

  const ids = choices.map((c: McqChoiceLoose) => String(c?.id ?? ""));
  const texts = choices.map((c: McqChoiceLoose) =>
    normalizeWhitespace(String(c?.text ?? ""))
  );

  const expectedIds = ["A", "B", "C", "D"];

  for (const id of expectedIds) {
    if (!ids.includes(id)) issues.push(`missing choice id "${id}"`);
  }
  for (const id of ids) {
    if (!expectedIds.includes(id)) issues.push(`unexpected choice id "${id}"`);
  }

  const uniqueTexts = new Set(texts.map((t: string) => t.toLowerCase()));
  if (uniqueTexts.size !== texts.length) issues.push("choices contain duplicates");

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    const id = ids[i] || String(i);

    if (t.length < 1) issues.push(`choice ${id} is empty`);
    if (!hasCyrillic(t)) issues.push(`choice ${id} missing Cyrillic`);
    if (hasLatin(t)) issues.push(`choice ${id} contains Latin letters`);
    if (t.split(" ").length > 8) issues.push(`choice ${id} too long for A1`);
  }

  const correct = String(parsed?.correctChoiceId ?? "");
  if (!expectedIds.includes(correct)) issues.push("correctChoiceId must be A/B/C/D");

  const correctChoice = choices.find(
    (c: McqChoiceLoose) => String(c?.id ?? "") === correct
  );
  if (!correctChoice) issues.push("correctChoiceId does not match any choice id");

  const correctText = normalizeWhitespace(String(correctChoice?.text ?? "")).toLowerCase();
  const distractors = choices
    .filter((c: McqChoiceLoose) => String(c?.id ?? "") !== correct)
    .map((c: McqChoiceLoose) => normalizeWhitespace(String(c?.text ?? "")).toLowerCase());

  if (correctChoice && distractors.some((d: string) => d === correctText)) {
    issues.push("a distractor matches the correct answer text");
  }

  if (focusWord && focusWord.trim().length > 0) {
    const fw = normalizeWhitespace(focusWord).toLowerCase();
    if (correctText !== fw) {
      issues.push(`correct choice must be the focus word "${focusWord}"`);
    }
  }

  return issues;
}
