import React, { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Text, YStack } from "tamagui";

import { Screen } from "../../../components/ui/Screen";
import { GlassCard } from "../../../components/ui/GlassCard";
import { H1, Sub, Muted } from "../../../components/ui/Typography";
import { HermesButton } from "../../../components/ui/HermesButton";
import { useAppState } from "../../../state/AppState";

import { practiceItemRegistry } from "shared/domain/practice/practiceItemRegistry";
import { McqBasicSchema } from "shared/domain/practice/items/mcqPracticeItem";
import { McqCard, type McqViewModel } from "../../../components/practice/McqCard";

type FeedbackVM = { isCorrect: boolean; correctChoiceId: string; message: string } | null;

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
    return { prompt: parsed.prompt, choices: parsed.choices, correctChoiceId: parsed.correctChoiceId };
  }, [currentJson]);

  async function handleSubmit(payload: { choiceId: string }) {
    if (locked) return;
    setLocked(true);

    const evaluation = currentItem.evaluate(payload);
    const isCorrect = evaluation.isCorrect === true;

    setFeedback({
      isCorrect,
      correctChoiceId: mcqVm.correctChoiceId,
      message: evaluation.feedback ?? (isCorrect ? "Correct." : "Incorrect."),
    });
  }

  function onContinue() {
    setFeedback(null);
    setLocked(false);

    const next = idx + 1;
    advancePractice();

    if (next >= total) router.replace("/(app)/session/results");
  }

  if (!session) {
    return (
      <Screen>
        <H1>Practice</H1>
        <Sub>No active session.</Sub>
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>Practice</H1>
      <Sub>
        Item {idx + 1} / {Math.max(total, idx + 1)}
      </Sub>

      <YStack marginTop={14}>
        <McqCard key={`${idx}-${mcqVm.prompt}`} item={mcqVm} locked={locked} feedback={feedback} onSubmit={handleSubmit} />
      </YStack>

      {feedback ? (
        <GlassCard marginTop={14}>
          <Muted marginBottom={10}>Ready?</Muted>
          <HermesButton label="Continue →" variant="primary" marginTop={0} onPress={onContinue} />
        </GlassCard>
      ) : null}
    </Screen>
  );
}
