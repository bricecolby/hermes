import { getVariableValue } from "tamagui";

export function resolveThemeColor(value: any, fallback: string) {
  try {
    const resolved = getVariableValue(value);
    if (typeof resolved === "string") return resolved;
    if (resolved != null) return String(resolved);
  } catch {}

  if (value?.val != null) return String(value.val);
  if (value?.get) return String(value.get());
  if (typeof value === "string") return value;

  return fallback;
}
