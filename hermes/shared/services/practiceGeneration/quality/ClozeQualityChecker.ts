// shared/services/practiceGeneration/quality/ClozeQualityChecker.ts
import { hasCyrillic, hasLatin, normalizeWhitespace } from "./textQualityUtils";

type PartText = { type: "text"; value: unknown };
type PartBlank = { type: "blank"; id?: unknown; accepted?: unknown; conceptId?: unknown };

export function qualityCheckCloze(
  parsed: any,
  focusWord?: string,
  focusConceptId?: number
): string[] {
  const issues: string[] = [];

  const parts: Array<PartText | PartBlank> = Array.isArray(parsed?.parts) ? parsed.parts : [];
  if (parts.length < 3) issues.push("parts too short (need text + blank + text)");

  const blanks = parts.filter((p: any) => p?.type === "blank") as PartBlank[];
  if (blanks.length !== 1) issues.push("must contain exactly one blank");

  const blank = blanks[0];
  if (blank) {
    const id = String(blank.id ?? "");
    if (id !== "b1") issues.push('blank id must be "b1"');

    const accepted = Array.isArray(blank.accepted) ? blank.accepted.map(String) : [];
    const acceptedNorm = accepted.map((s) => normalizeWhitespace(s)).filter((s) => s.length > 0);

    if (acceptedNorm.length < 4) issues.push("blank accepted must have at least 4 options (target + distractors)");
    const uniq = new Set(acceptedNorm.map((s) => s.toLowerCase()));
    if (uniq.size !== acceptedNorm.length) issues.push("blank accepted contains duplicates");

    for (const opt of acceptedNorm) {
      if (!hasCyrillic(opt)) issues.push("blank accepted option missing Cyrillic");
      if (hasLatin(opt)) issues.push("blank accepted option contains Latin letters");
      if (opt.split(" ").length > 3) issues.push("blank accepted option too long (prefer 1–3 words)");
    }

    if (focusWord && focusWord.trim().length > 0) {
      const fw = normalizeWhitespace(focusWord).toLowerCase();
      if (!acceptedNorm.some((s) => s.toLowerCase() === fw)) {
        issues.push(`blank accepted must include focus word "${focusWord}"`);
      }
    }

    if (typeof focusConceptId === "number") {
      const cid = Number(blank.conceptId);
      if (Number.isNaN(cid)) issues.push("blank conceptId must be a number");
      else if (cid !== focusConceptId) issues.push("blank conceptId must match focus conceptId");
    }
  }

  const textParts = parts.filter((p: any) => p?.type === "text") as PartText[];
  const combined = normalizeWhitespace(
    textParts.map((p) => String(p.value ?? "")).join("")
  );

  if (combined.length < 4) issues.push("sentence too short");
  if (!hasCyrillic(combined)) issues.push("sentence missing Cyrillic");
  if (hasLatin(combined)) issues.push("sentence contains Latin letters");
  if (combined.split(" ").length > 12) issues.push("sentence too long for A1");

  return issues;
}
