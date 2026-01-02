import { practiceItemRegistry } from "./practiceItemRegistry";

// Reception
import { McqBasicPracticeItem } from "./items/mcqPracticeItem";
import { MatchingPairwisePracticeItem } from "./items/matchingPairwisePracticeItem";
import { MatchingAudioToTextPracticeItem } from "./items/matchingAudioToTextPracticeItem";

// Production
import { ClozeFreeFillPracticeItem } from "./items/clozeFreeFillPracticeItem";
import { OrderingWordOrderPracticeItem } from "./items/orderingWordOrderPracticeItem";
import { ShortAnswerBasicPracticeItem } from "./items/shortAnswerBasicPracticeItem";
import { ShortAnswerSpokenStubPracticeItem } from "./items/shortAnswerSpokenStubPracticeItem";

// Interaction
import { InteractionFreeReplyTurnPracticeItem } from "./items/interactionFreeReplyTurnPracticeItem";
import { InteractionRespondToPromptPracticeItem } from "./items/interactionRespondToPromptPracticeItem";

// Mediation
import { MediationSummarizeTextPracticeItem } from "./items/mediationSummarizeTextPracticeItem";
import { MediationSummarizeAudioPracticeItem } from "./items/mediationSummarizeAudioPracticeItem";
import { MediationTranslateSentencePracticeItem } from "./items/mediationTranslateSentencePracticeItem";

let didRegister = false;

export function registerPracticeItems() {
  if (didRegister) return;
  didRegister = true;

  // Reception
  practiceItemRegistry.register("mcq_v1.basic", (json) => new McqBasicPracticeItem(json as any));
  practiceItemRegistry.register("matching_v1.pairwise", (json) => new MatchingPairwisePracticeItem(json as any));
  practiceItemRegistry.register("matching_v1.audio_to_text", (json) => new MatchingAudioToTextPracticeItem(json as any));

  // Production
  practiceItemRegistry.register("cloze_v1.free_fill", (json) => new ClozeFreeFillPracticeItem(json as any));
  practiceItemRegistry.register("ordering_v1.word_order", (json) => new OrderingWordOrderPracticeItem(json as any));
  practiceItemRegistry.register("short_answer_v1.basic", (json) => new ShortAnswerBasicPracticeItem(json as any));
  practiceItemRegistry.register("short_answer_v1.spoken_stub", (json) => new ShortAnswerSpokenStubPracticeItem(json as any));

  // Interaction
  practiceItemRegistry.register("interaction_v1.free_reply_turn", (json) => new InteractionFreeReplyTurnPracticeItem(json as any));
  practiceItemRegistry.register("interaction_v1.respond_to_prompt", (json) => new InteractionRespondToPromptPracticeItem(json as any));

  // Mediation
  practiceItemRegistry.register("mediation_v1.summarize_text", (json) => new MediationSummarizeTextPracticeItem(json as any));
  practiceItemRegistry.register("mediation_v1.summarize_audio", (json) => new MediationSummarizeAudioPracticeItem(json as any));
  practiceItemRegistry.register("mediation_v1.translate_sentence", (json) => new MediationTranslateSentencePracticeItem(json as any));
}
