// shared/services/practiceGeneration/specs/registerPracticeItemSpecs.ts
import { registerPracticeItemSpec } from "./practiceItemSpecs";
import { mcqBasicSpec } from "./mcqBasicSpec";
import { clozeFreeFillSpec } from "./clozeFreeFillSpec";

export function registerPracticeItemSpecs() {
  registerPracticeItemSpec(mcqBasicSpec);
  registerPracticeItemSpec(clozeFreeFillSpec);
  // later: cloze, flashcard, ordering, etc.
}
