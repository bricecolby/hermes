import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/ui/Screen";
import { useAppState } from "../../../state/AppState";

import { practiceItemRegistry } from "shared/domain/practice/practiceItemRegistry";
import { McqBasicSchema } from "shared/domain/practice/items/mcqPracticeItem"; 
import { McqCard, type McqViewModel } from "../../../components/practice/McqCard";

type FeedbackVM = { isCorrect: boolean; correctChoiceId: string; message: string } | null;

// MVP dummy generator: later replaced by LLM queue/prefetcher
function getDummyMcqByIndex(i: number) {
  const bank = [
    {
      type: "mcq_v1.basic",
      mode: "reception",
      skills: ["reading"],
      conceptIds: [123],
      prompt: "Где метро?",
      choices: [
        { id: "A", text: "Там" },
        { id: "B", text: "Здесь" },
        { id: "C", text: "Сейчас" },
        { id: "D", text: "Потом" },
      ],
      correctChoiceId: "B",
    },
    {
      type: "mcq_v1.basic",
      mode: "reception",
      skills: ["reading"],
      conceptIds: [123],
      prompt: "Как тебя зовут?",
      choices: [
        { id: "A", text: "Спасибо" },
        { id: "B", text: "Меня зовут Анна" },
        { id: "C", text: "Пожалуйста" },
        { id: "D", text: "До свидания" },
      ],
      correctChoiceId: "B",
    },
    {
      type: "mcq_v1.basic",
      mode: "reception",
      skills: ["reading"],
      conceptIds: [123],
      prompt: "Где ты живёшь?",
      choices: [
        { id: "A", text: "В Москве" },
        { id: "B", text: "Сейчас" },
        { id: "C", text: "Потом" },
        { id: "D", text: "Спасибо" },
      ],
      correctChoiceId: "A",
    },
  ];

  return bank[i % bank.length];
}

export default function Practice() {
  const router = useRouter();
  const { session, advancePractice } = useAppState();

  const idx = session?.practiceIndex ?? 0;
  const total = session?.practiceItemIds.length ?? 0;

  const [feedback, setFeedback] = useState<FeedbackVM>(null);
  const [locked, setLocked] = useState(false);

  const currentJson = useMemo(() => getDummyMcqByIndex(idx), [idx]);

  const currentItem = useMemo(() => {
    return practiceItemRegistry.create(currentJson);
  }, [currentJson]);

  const mcqVm: McqViewModel = useMemo(() => {
    const parsed = McqBasicSchema.parse(currentJson);
    return {
      prompt: parsed.prompt,
      choices: parsed.choices,
      correctChoiceId: parsed.correctChoiceId,
    };
  }, [currentJson]);

  async function handleSubmit(payload: { choiceId: string }) {
    if (locked) return;
    setLocked(true);

    const evaluation = currentItem.evaluate(payload);

    const isCorrect = evaluation.isCorrect === true;
    setFeedback({
      isCorrect,
      correctChoiceId: mcqVm.correctChoiceId,
      message: evaluation.feedback ?? (evaluation.isCorrect ? "Correct." : "Incorrect."),
    });

    // TODO (next step): persist attempt using PracticeSessionRepository or db/queries
    // - practice_attempts row: question_json, user_response_json, evaluation_json
    // - practice_attempt_concepts rows: evaluation.conceptResults

    // Keep it on screen for a moment then allow continue
    // (You can also require the user tap “Continue” explicitly later.)
  }

  function onContinue() {
    setFeedback(null);
    setLocked(false);

    const next = idx + 1;
    advancePractice();

    if (next >= total) {
      router.replace("/(app)/session/results");
    }
  }

  if (!session) {
    return (
      <Screen>
        <Text style={styles.h1}>Practice</Text>
        <Text style={styles.sub}>No active session.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.h1}>Practice</Text>
      <Text style={styles.sub}>
        Item {idx + 1} / {Math.max(total, idx + 1)}
      </Text>

      <View style={{ height: 14 }} />

      <McqCard
        key={`${idx}-${mcqVm.prompt}`}
        item={mcqVm}
        locked={locked}
        feedback={feedback}
        onSubmit={handleSubmit}
      />


      <View style={{ height: 14 }} />

      {feedback ? (
        <View style={styles.continueWrap}>
          <Text style={styles.continueHint}>Ready?</Text>
          <Text style={styles.continueBtn} onPress={onContinue}>
            Continue →
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#E6EBFF", fontSize: 24, fontWeight: "900" },
  sub: { color: "#9BA3B4", marginTop: 6 },

  continueWrap: {
    marginTop: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  continueHint: { color: "#9BA3B4", marginBottom: 6 },
  continueBtn: { color: "#1EE6A8", fontWeight: "900", fontSize: 16 },
});
