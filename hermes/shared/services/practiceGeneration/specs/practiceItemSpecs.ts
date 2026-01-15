// shared/services/practiceGeneration/specs/practiceItemSpecs.ts
import type { PracticeItemSpec } from "./types";

const specs = new Map<string, PracticeItemSpec<any>>();

export function registerPracticeItemSpec(spec: PracticeItemSpec<any>) {
  specs.set(spec.type, spec);
}

export function getPracticeItemSpec(type: string) {
  const s = specs.get(type);
  if (!s) throw new Error(`No PracticeItemSpec registered for type="${type}"`);
  return s;
}
