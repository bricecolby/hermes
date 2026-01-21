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
import { insertPracticeAttempt, insertAttemptConceptResults } from "@/db/queries/practice";
import { getRandomVocabConceptRefs } from "@/db/queries/concepts";

type RunStats = {
  correct: number;
  total: number;
  ms: number[];
};

async function loadRandomFlashcards(
  db: SQLite.SQLiteDatabase,
  languageId: number,
  limit = 20
): Promise<FlashcardViewModel[]> {
  const refs = await getRandomVocabConceptRefs(db, languageId, limit);

  return refs.map((r) => ({
    conceptId: r.conceptId,
    front: r.title ?? "",
    back: r.description ?? "",
  }));
}

export default function Memorize() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeLanguageId, activeProfileId, setSessionDbId, sessionDbId } = useAppState();
  const { run } = useLocalSearchParams<{ run?: string }>();

  const languageId =
    activeLanguageId ?? (() => { throw new Error("No active language"); })();
  const userId =
    activeProfileId ?? (() => { throw new Error("No active profile"); })();

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<FlashcardViewModel[]>([]);
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);

  const [stats, setStats] = useState<RunStats>({ correct: 0, total: 0, ms: [] });
  const current = useMemo(() => cards[idx] ?? null, [cards, idx]);
  const [cardStartMs, setCardStartMs] = useState<number>(() => Date.now());

  const [localSessionId, setLocalSessionId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const newSessionId = await startPracticeSession(db, {
          languageId,
          userId,
          startedAtIso: new Date().toISOString(),
          modality: "memorize",
          source: "memorize",
        });

        setSessionDbId(newSessionId);
        setLocalSessionId(newSessionId);

        const nextCards = await loadRandomFlashcards(db, languageId, 20);
        if (cancelled) return;

        setCards(nextCards);
        setStats({ correct: 0, total: nextCards.length, ms: [] });
        setIdx(0);
        setCardStartMs(Date.now());
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

  async function handleSubmit(payload: { isCorrect: boolean }) {
    if (!current) return;

    const sid = localSessionId ?? sessionDbId;
    if (!sid) {
      console.warn("[memorize] missing session id; cannot log attempt");
      return;
    }

    setLocked(true);
    const elapsed = Date.now() - cardStartMs;

    try {
      const attemptId = await insertPracticeAttempt({
        db,
        sessionId: sid,
        userId,
        modality: "memorize",
        type: "flashcard_v1.basic",
        promptText: current.front,
        questionJson: {
          front: current.front,
          back: current.back,
          conceptId: current.conceptId,
        },
        userResponseJson: { isCorrect: payload.isCorrect, ms: elapsed },
        evaluationJson: { isCorrect: payload.isCorrect },
      });

      await insertAttemptConceptResults({
        db,
        attemptId,
        conceptResults: [
          {
            conceptId: current.conceptId,
            isCorrect: payload.isCorrect,
            score: payload.isCorrect ? 1 : 0,
            maxScore: 1,
            evidence: { source: "memorize", ms: elapsed },
          },
        ],
      });
    } catch (e) {
      console.error("[memorize] attempt logging failed", e);
    }

    setStats((s) => ({
      ...s,
      correct: s.correct + (payload.isCorrect ? 1 : 0),
      ms: [...s.ms, elapsed],
    }));

    const nextIdx = idx + 1;
    if (nextIdx >= cards.length) {
      router.replace("/memorize/results");
      return;
    }

    setIdx(nextIdx);
    setCardStartMs(Date.now());
    setLocked(false);
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} paddingTop={6}>
        <AppHeader title="Memorize" />

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
              <FlashcardCard key={idx} item={current} locked={locked} onSubmit={handleSubmit} fullScreen />
            </YStack>
          </YStack>
        )}
      </YStack>
    </Screen>
  );
}
