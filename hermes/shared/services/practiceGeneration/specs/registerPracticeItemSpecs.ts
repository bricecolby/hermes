// shared/services/practiceGeneration/specs/registerPracticeItemSpecs.ts
import { registerPracticeItemSpec } from "./practiceItemSpecs";
import { mcqBasicSpec } from "./mcqBasicSpec";

export function registerPracticeItemSpecs() {
  registerPracticeItemSpec(mcqBasicSpec);
  // later: cloze, flashcard, ordering, etc.
}
