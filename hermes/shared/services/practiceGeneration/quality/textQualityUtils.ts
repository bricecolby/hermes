// shared/services/practiceGeneration/quality/textQualityUtils.ts
export function hasCyrillic(s: string) {
  return /[\u0400-\u04FF]/.test(s);
}

export function hasLatin(s: string) {
  return /[A-Za-z]/.test(s);
}

export function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function formatBulletIssues(issues: string[]) {
  return issues.map((s) => `- ${s}`).join("\n");
}
