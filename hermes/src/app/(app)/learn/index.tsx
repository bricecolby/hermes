import React, { useEffect, useMemo, useState } from "react";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { ActivityIndicator } from "react-native";
import { YStack, Text, XStack } from "tamagui";
import * as SQLite from "expo-sqlite";

import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { FlashcardCard, type FlashcardViewModel } from "@/components/practice/FlashcardCard";
import { useAppState } from "@/state/AppState";

import { startPracticeSession } from "@/db/queries/sessions";
import { recordPracticeAttemptTx } from "@/db/queries/practice";
import { getFreshVocabConceptRefsForLearn } from "@/db/queries/concepts";

type RunStats = {
  correct: number;
  total: number;
  ms: number[];
};

type MemorizeCardVM = FlashcardViewModel & {
  mode: "reception" | "production";
  skill: "reading" | "writing";
  itemType: "flashcard_v1.basic";
};

async function loadMemorizeFlashcards(
  db: SQLite.SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    totalCards: number;
    allowedCefr?: ("A1" | "A2" | "B1" | "B2")[];
  }
): Promise<MemorizeCardVM[]> {
  const { userId, languageId, modelKey, totalCards, allowedCefr } = args;

  // Each vocab concept becomes TWO cards (reception + production)
  const conceptLimit = Math.ceil(totalCards / 2);

  const refs = await getFreshVocabConceptRefsForLearn(db, {
    userId,
    languageId,
    modelKey,
    limit: conceptLimit,
  });

  // Assumption (based on your existing behavior):
  // - title is the L2 string
  // - description is the L1 gloss/meaning
  // If your real “meaning” lives elsewhere, we can swap this mapping later.
  const cards: MemorizeCardVM[] = [];
  for (const r of refs) {
    const l2 = (r.title ?? "").trim();
    const l1 = (r.description ?? "").trim();

    if (!l2 || !l1) continue;

    // Reception: L2 -> L1
    cards.push({
      conceptId: r.conceptId,
      front: l2,
      back: l1,
      mode: "reception",
      skill: "reading",
      itemType: "flashcard_v1.basic",
    });

    // Production: L1 -> L2
    cards.push({
      conceptId: r.conceptId,
      front: l1,
      back: l2,
      mode: "production",
      skill: "writing",
      itemType: "flashcard_v1.basic",
    });
  }

  // Shuffle so the user doesn't always see reception then production back-to-back.
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards.slice(0, totalCards);
}

export default function Memorize() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeLanguageId, activeProfileId, setSessionDbId, sessionDbId } = useAppState();
  const { run } = useLocalSearchParams<{ run?: string }>();

  const languageId = activeLanguageId ?? (() => { throw new Error("No active language"); })();
  const userId = activeProfileId ?? (() => { throw new Error("No active profile"); })();

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<MemorizeCardVM[]>([]);
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);

  const [stats, setStats] = useState<RunStats>({ correct: 0, total: 0, ms: [] });
  const current = useMemo(() => cards[idx] ?? null, [cards, idx]);

  const [localSessionId, setLocalSessionId] = useState<number | null>(null);

  useEffect(() => {
    console.log("[Memorize] mount");
    return () => console.log("[Memorize] unmount");
  }, []);


  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const newSessionId = await startPracticeSession(db, {
          languageId,
          userId,
          startedAtIso: new Date().toISOString(),
          modality: null,
          source: "memorize",
        });

        setSessionDbId(newSessionId);
        setLocalSessionId(newSessionId);

        const nextCards = await loadMemorizeFlashcards(db, {
          userId,
          languageId,
          modelKey: "ema_v1",
          totalCards: 20,
          allowedCefr: ["A1"],
        });

        if (cancelled) return;

        setCards(nextCards);
        setStats({ correct: 0, total: nextCards.length, ms: [] });
        setIdx(0);
        setLocked(false);
      } catch (e) {
        console.error("[memorize] load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [db, languageId, userId, run, setSessionDbId]);

  async function handleSubmit(payload: { isCorrect: boolean; responseMs: number }) {
    if (!current) return;

    console.log("[memorize] logging attempt", { sessionDbId, localSessionId, current, payload });

    const sid = localSessionId ?? sessionDbId;
    if (!sid) {
      console.warn("[memorize] missing session id; cannot log attempt");
      return;
    }

    setLocked(true);

    const isCorrect = payload.isCorrect === true;
    const responseMs = payload.responseMs;

    try {
      const questionJson = {
        type: current.itemType,
        mode: current.mode,
        skills: [current.skill],
        conceptIds: [current.conceptId],
        front: current.front,
        back: current.back,
      };

      const evaluation = {
        type: current.itemType,
        mode: current.mode,
        skills: [current.skill],
        isCorrect,
        score: isCorrect ? 1 : 0,
        conceptResults: [
          {
            conceptId: current.conceptId,
            score: isCorrect ? 1 : 0,
            maxScore: 1,
            isCorrect,
            evidence: { source: "memorize" },
          },
        ],
        feedback: isCorrect ? "Correct." : "Incorrect.",
      };

      await recordPracticeAttemptTx({
        db,
        sessionId: sid,
        userId,
        modality: current.mode,
        skill: current.skill,
        itemType: current.itemType,
        promptText: current.front,
        questionJson,
        userResponseJson: { isCorrect },
        evaluation,
        responseMs,
      });
    } catch (e) {
      console.error("[memorize] attempt logging failed", e);
    }

    setStats((s) => ({
      ...s,
      correct: s.correct + (isCorrect ? 1 : 0),
      ms: [...s.ms, responseMs],
    }));

    const nextIdx = idx + 1;
    if (nextIdx >= cards.length) {
      router.replace("/learn/results");
      return;
    }

    setIdx(nextIdx);
    setLocked(false);
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} paddingTop={6}>
        <AppHeader title="Learn" />

        {loading ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <ActivityIndicator />
          </YStack>
        ) : !current ? (
          <YStack flex={1} alignItems="center" justifyContent="center" gap={8}>
            <Text color="$textMuted">No cards available.</Text>
          </YStack>
        ) : (
          <YStack flex={1} marginTop={10} gap={12}>
            <XStack justifyContent="space-between" paddingHorizontal={4}>
              <Text color="$textMuted">
                {idx + 1}/{cards.length}
              </Text>
              <Text color="$textMuted">Correct: {stats.correct}</Text>
            </XStack>

            <YStack flex={1}>
              <FlashcardCard
                key={`${idx}-${current.front}`}
                item={current}
                locked={locked}
                onSubmit={handleSubmit}
                showTimer
                fullScreen
              />
            </YStack>
          </YStack>
        )}
      </YStack>
    </Screen>
  );
}
