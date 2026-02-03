import React, { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { YStack } from "tamagui";

import { Screen } from "../../../components/ui/Screen";
import { GlassCard } from "../../../components/ui/GlassCard";
import { H1, Sub, Muted } from "../../../components/ui/Typography";
import { HermesButton } from "../../../components/ui/HermesButton";
import { useAppState } from "../../../state/AppState";

import { practiceItemRegistry } from "shared/domain/practice/practiceItemRegistry";

import { McqBasicSchema } from "shared/domain/practice/items/mcqPracticeItem";
import { FlashcardBasicSchema } from "shared/domain/practice/items/flashcardBasicPracticeItem";
import { ClozeFreeFillSchema } from "shared/domain/practice/items/clozeFreeFillPracticeItem";

import { McqCard, type McqViewModel } from "../../../components/practice/McqCard";
import { FlashcardCard, type FlashcardViewModel } from "../../../components/practice/FlashcardCard";
import { ClozeCard, type ClozeFreeFillViewModel as ClozeViewModel } from "../../../components/practice/ClozeCard";

import { useSQLiteContext } from "expo-sqlite";
import { recordPracticeAttemptTx } from "@/db/queries/practice";
import { finalizePracticeSession } from "@/analytics/finalize";


type FeedbackVM = { isCorrect: boolean; correctChoiceId: string; message: string } | null;

export default function Practice() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { session, advancePractice, activeProfileId, sessionDbId } = useAppState();

  const idx = session?.practiceIndex ?? 0;
  const total = session?.practiceBank?.length ?? 0;

  const [feedback, setFeedback] = useState<FeedbackVM>(null);
  const [locked, setLocked] = useState(false);

  const currentJson = useMemo(() => {
    return session?.practiceBank?.[idx] ?? null;
  }, [session?.practiceBank, idx]);

  const currentItem = useMemo(() => {
    if (!currentJson) return null;
    return practiceItemRegistry.create(currentJson);
  }, [currentJson]);

  const mcqVm = useMemo<McqViewModel | null>(() => {
    if (!currentJson || currentJson.type !== "mcq_v1.basic") return null;
    const parsed = McqBasicSchema.parse(currentJson);
    return { prompt: parsed.prompt, choices: parsed.choices, correctChoiceId: parsed.correctChoiceId };
  }, [currentJson]);

  const flashcardVm = useMemo<FlashcardViewModel | null>(() => {
    if (!currentJson || currentJson.type !== "flashcard_v1.basic") return null;

    const parsed = FlashcardBasicSchema.parse(currentJson);

    const conceptIds = (currentJson as any).conceptIds;
    if (!Array.isArray(conceptIds) || conceptIds.length === 0) {
      throw new Error("Flashcard item missing conceptIds");
    }

    return {
      conceptId: conceptIds[0],
      front: parsed.front,
      back: parsed.back,
    };
  }, [currentJson]);


  const clozeVm = useMemo<ClozeViewModel | null>(() => {
    if (!currentJson || currentJson.type !== "cloze_v1.free_fill") return null;
    const parsed = ClozeFreeFillSchema.parse(currentJson);
    return { parts: parsed.parts };
  }, [currentJson]);


  if (!session || !currentJson || !currentItem) {
    return (
      <Screen>
        <H1>Practice</H1>
        <Sub>{!session ? "No active session." : "No practice items generated yet."}</Sub>
      </Screen>
    );
  }

  const json = currentJson;
  const item = currentItem;

  async function submitAny(payload: any, correctChoiceIdForFeedback: string, responseMs: number) {
    if (locked) return;
    setLocked(true);

    const evaluation = item.evaluate(payload);
    const isCorrect = evaluation.isCorrect === true;

    try {
      const sid = sessionDbId ?? null;
      const userId = activeProfileId ?? null;

      if (sid && userId) {
        const promptText =
          (json as any).prompt ??
          (json as any).front ??
          (typeof (json as any).promptText === "string" ? (json as any).promptText : null) ??
          null;
        const modality = typeof(json as any).mode === "string" ? (json as any).mode: "reception";
        const skills = (json as any).skills;
        const skill = Array.isArray(skills) && typeof skills[0] === "string" ? skills[0] : null;

        await recordPracticeAttemptTx({
          db,
          sessionId: sid,
          userId,
          modality,
          skill,
          itemType: json.type,
          promptText: promptText ?? "",
          questionJson: json,
          userResponseJson: payload,
          evaluation,
          responseMs,
        });
      } else {
        console.warn("[practice] skipping attempt recording, missing sessionDbId or activeProfileId");
      }
    } catch (e) {
      console.error("[practice] attempt recording failed", e);  
    }

    // --- UI feedback ---
    setFeedback({
      isCorrect,
      correctChoiceId: correctChoiceIdForFeedback,
      message: evaluation.feedback ?? (isCorrect ? "Correct." : "Incorrect."),
    });
  }


  async function handleMcqSubmit(payload: { choiceId: string; responseMs: number }) {
    await submitAny({ choiceId: payload.choiceId }, mcqVm?.correctChoiceId ?? "", payload.responseMs);
  }

  async function handleFlashcardSubmit(payload: { isCorrect: boolean; responseMs: number }) {
    await submitAny({ isCorrect: payload.isCorrect }, "", payload.responseMs);
  }
  
  async function handleClozeSubmit(payload: { responses: Record<string, string>; responseMs: number }) {
    await submitAny({ responses: payload.responses }, "", payload.responseMs);
  }

  async function onContinue() {
    setFeedback(null);
    setLocked(false);

    const next = idx + 1;
    advancePractice();

    if (next >= total) {
      if (sessionDbId) {
        try {
          await finalizePracticeSession(db, sessionDbId);
        } catch (e) {
          console.error("[practice] finalize failed", e);
        }
      }

      router.replace("/(app)/session/results");
    }
  }


  function renderPracticeCard() {
    switch (json.type) {
      case "mcq_v1.basic":
        return mcqVm ? (
          <McqCard
            key={`${idx}-${mcqVm.prompt}`}
            item={mcqVm}
            locked={locked}
            feedback={feedback}
            onSubmit={handleMcqSubmit}
          />
        ) : null;

      case "flashcard_v1.basic":
        return flashcardVm ? (
          <FlashcardCard
            key={`${idx}-${flashcardVm.front}`}
            item={flashcardVm}
            locked={locked}
            onSubmit={handleFlashcardSubmit}
            showTimer={true}
          />
        ) : null;

      case "cloze_v1.free_fill":
        return clozeVm ? (
          <ClozeCard key={`${idx}-cloze`} item={clozeVm} locked={locked} onSubmit={handleClozeSubmit} />
        ) : null;

      default:
        return (
          <GlassCard>
            <Muted>Unsupported item type: {String((json as any).type)}</Muted>
          </GlassCard>
        );
    }
  }

  return (
    <Screen>
      <H1>Practice</H1>
      <Sub>
        Item {idx + 1} / {Math.max(total, idx + 1)}
      </Sub>

      <YStack marginTop={14}>{renderPracticeCard()}</YStack>

      {feedback ? (
        <GlassCard marginTop={14}>
          <Muted marginBottom={10}>Ready?</Muted>
          <HermesButton label="Continue →" variant="primary" marginTop={0} onPress={onContinue} />
        </GlassCard>
      ) : null}
    </Screen>
  );
}
