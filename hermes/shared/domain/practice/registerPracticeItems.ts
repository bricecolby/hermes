import { practiceItemRegistry } from "./practiceItemRegistry";
import { MultipleChoicePracticeItem } from "./items/mcqPracticeItem";

let didRegister = false;

export function registerPracticeItems() {
    if (didRegister) return;
    didRegister = true;

    practiceItemRegistry.register("multiple_choice_v1", (json) => {
        return new MultipleChoicePracticeItem(json as any);
    });
}