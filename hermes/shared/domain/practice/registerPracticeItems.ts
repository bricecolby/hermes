// shared/domain/practice/registerPracticeItems.ts
import { z } from "zod";
import { practiceItemRegistry } from "./practiceItemRegistry";

// Reception
import { McqBasicPracticeItem, McqBasicSchema } from "./items/mcqPracticeItem";
import { MatchingPairwisePracticeItem } from "./items/matchingPairwisePracticeItem";
import { MatchingAudioToTextPracticeItem } from "./items/matchingAudioToTextPracticeItem";
import { FlashcardBasicPracticeItem, FlashcardBasicSchema } from "./items/flashcardBasicPracticeItem";

// Production
import { ClozeFreeFillPracticeItem, ClozeFreeFillSchema } from "./items/clozeFreeFillPracticeItem";
import { OrderingWordOrderPracticeItem } from "./items/orderingWordOrderPracticeItem";
import { ShortAnswerBasicPracticeItem } from "./items/shortAnswerBasicPracticeItem";
import { ShortAnswerSpokenStubPracticeItem } from "./items/shortAnswerSpokenStubPracticeItem";

// Interaction (schemas not added yet here)
import { InteractionFreeReplyTurnPracticeItem } from "./items/interactionFreeReplyTurnPracticeItem";
import { InteractionRespondToPromptPracticeItem } from "./items/interactionRespondToPromptPracticeItem";

// Mediation (schemas not added yet here)
import { MediationSummarizeTextPracticeItem } from "./items/mediationSummarizeTextPracticeItem";
import { MediationSummarizeAudioPracticeItem } from "./items/mediationSummarizeAudioPracticeItem";
import { MediationTranslateSentencePracticeItem } from "./items/mediationTranslateSentencePracticeItem";

let didRegister = false;

const AnySchema = z.any();

export function registerPracticeItems() {
  if (didRegister) return;
  didRegister = true;

  // Reception
  practiceItemRegistry.register("mcq_v1.basic", McqBasicSchema, (json) => new McqBasicPracticeItem(json));
  practiceItemRegistry.register("matching_v1.pairwise", AnySchema, (json) => new MatchingPairwisePracticeItem(json));
  practiceItemRegistry.register("matching_v1.audio_to_text", AnySchema, (json) => new MatchingAudioToTextPracticeItem(json));
  practiceItemRegistry.register("flashcard_v1.basic", FlashcardBasicSchema, (json) => new FlashcardBasicPracticeItem(json));

  // Production
  practiceItemRegistry.register("cloze_v1.free_fill", ClozeFreeFillSchema, (json) => new ClozeFreeFillPracticeItem(json));
  practiceItemRegistry.register("ordering_v1.word_order", AnySchema, (json) => new OrderingWordOrderPracticeItem(json));
  practiceItemRegistry.register("short_answer_v1.basic", AnySchema, (json) => new ShortAnswerBasicPracticeItem(json));
  practiceItemRegistry.register("short_answer_v1.spoken_stub", AnySchema, (json) => new ShortAnswerSpokenStubPracticeItem(json));

  // Interaction (#TODO: add schemas + remove AnySchema)
  practiceItemRegistry.register("interaction_v1.free_reply_turn", AnySchema, (json) => new InteractionFreeReplyTurnPracticeItem(json as any));
  practiceItemRegistry.register("interaction_v1.respond_to_prompt", AnySchema, (json) => new InteractionRespondToPromptPracticeItem(json as any));

  // Mediation (#TODO: add schemas + remove AnySchema)
  practiceItemRegistry.register("mediation_v1.summarize_text", AnySchema, (json) => new MediationSummarizeTextPracticeItem(json as any));
  practiceItemRegistry.register("mediation_v1.summarize_audio", AnySchema, (json) => new MediationSummarizeAudioPracticeItem(json as any));
  practiceItemRegistry.register("mediation_v1.translate_sentence", AnySchema, (json) => new MediationTranslateSentencePracticeItem(json as any));
}
