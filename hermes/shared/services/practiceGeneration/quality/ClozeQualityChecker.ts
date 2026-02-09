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

  const parts: (PartText | PartBlank)[] = Array.isArray(parsed?.parts) ? parsed.parts : [];
  if (parts.length < 3) issues.push("parts too short (need text + blank + text)");

  const blanks = parts.filter((p: any) => p?.type === "blank") as PartBlank[];
  if (blanks.length !== 1) issues.push("must contain exactly one blank");

  const blank = blanks[0];
  let acceptedNorm: string[] = [];
  if (blank) {
    const id = String(blank.id ?? "");
    if (id !== "b1") issues.push('blank id must be "b1"');

    const accepted = Array.isArray(blank.accepted) ? blank.accepted.map(String) : [];
    acceptedNorm = accepted.map((s) => normalizeWhitespace(s)).filter((s) => s.length > 0);

    if (acceptedNorm.length < 1) issues.push("blank accepted must have at least one valid answer");
    if (acceptedNorm.length > 4) issues.push("blank accepted should have no more than 4 variants");
    const uniq = new Set(acceptedNorm.map((s) => s.toLowerCase()));
    if (uniq.size !== acceptedNorm.length) issues.push("blank accepted contains duplicates");

    for (const opt of acceptedNorm) {
      if (!hasCyrillic(opt)) issues.push("blank accepted option missing Cyrillic");
      if (hasLatin(opt)) issues.push("blank accepted option contains Latin letters");
      if (opt.split(" ").length > 4) issues.push("blank accepted option too long (prefer 1–4 words)");
    }

    if (typeof focusConceptId === "number") {
      const cid = Number(blank.conceptId);
      if (Number.isNaN(cid)) issues.push("blank conceptId must be a number");
      else if (cid !== focusConceptId) issues.push("blank conceptId must match focus conceptId");
    }
  }

  const textParts = parts.filter((p: any) => p?.type === "text") as PartText[];
  const textValues = textParts.map((p) => String(p.value ?? ""));
  const combined = normalizeWhitespace(
    textValues.join("")
  );

  if (combined.length < 4) issues.push("sentence too short");
  if (!hasCyrillic(combined)) issues.push("sentence missing Cyrillic");
  if (hasLatin(combined)) issues.push("sentence contains Latin letters");
  if (combined.split(" ").length > 12) issues.push("sentence too long for A1");
  if (/[()]/.test(combined)) issues.push("sentence should not contain parenthetical hints");

  // The answer form should appear only in the blank, not duplicated in text.
  const combinedNorm = normalizeWhitespace(combined).toLowerCase().replace(/ё/g, "е");
  for (const raw of acceptedNorm) {
    const form = normalizeWhitespace(raw).toLowerCase().replace(/ё/g, "е");
    if (!form) continue;
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|\\s)${escaped}($|\\s|[.,!?;:])`, "i");
    if (re.test(combinedNorm)) {
      issues.push("sentence text repeats the blank answer form");
      break;
    }
  }

  if (textParts.length >= 2) {
    const left = normalizeWhitespace(String(textValues[0] ?? ""));
    const right = normalizeWhitespace(String(textValues[textValues.length - 1] ?? ""));
    if (!left) issues.push("text before blank must be non-empty");
    if (!right) issues.push("text after blank must be non-empty");
  }

  if (focusWord && blank) {
    const focusNorm = normalizeWhitespace(String(focusWord))
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^а-я0-9 -]/g, "");
    const accepted = Array.isArray(blank.accepted) ? blank.accepted.map(String) : [];
    const related = accepted.some((raw) => {
      const a = normalizeWhitespace(raw)
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^а-я0-9 -]/g, "");
      if (!a || !focusNorm) return false;
      if (a.includes(focusNorm) || focusNorm.includes(a)) return true;
      return a.slice(0, 3).length >= 3 && focusNorm.startsWith(a.slice(0, 3));
    });
    if (!related) issues.push("accepted forms do not look related to focus target");
  }

  return issues;
}
