import React, { useEffect, useMemo, useState } from "react";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { ActivityIndicator } from "react-native";
import { YStack, Text, XStack } from "tamagui";

import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { FlashcardCard, type FlashcardViewModel } from "@/components/practice/FlashcardCard";
import { useAppState } from "@/state/AppState";
import * as SQLite from "expo-sqlite";
import { getRandomVocab } from "@/db/queries/vocab";


type RunStats = {
  correct: number;
  total: number;
  ms: number[];
};

async function loadRandomFlashcards(
    db: SQLite.SQLiteDatabase,
    languageId: number,
    limit = 20
) {
  const rows = await getRandomVocab(db, languageId, limit);

  return rows.map((r) => ({
    front: r.base_form,
    back: r.translation,
  }));
}


export default function Memorize() {
  const router = useRouter();
  const { activeLanguageId } = useAppState();
  const { run } = useLocalSearchParams<{ run?: string }>();

  if (activeLanguageId == null) {
    throw new Error("No active language");
  }

  const languageId = activeLanguageId;

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<FlashcardViewModel[]>([]);
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);

  const [stats, setStats] = useState<RunStats>({ correct: 0, total: 0, ms: [] });

  const current = useMemo(() => cards[idx] ?? null, [cards, idx]);
  const [cardStartMs, setCardStartMs] = useState<number>(() => Date.now());
  const db = SQLite.useSQLiteContext();

    useEffect(() => {
    let cancelled = false;

    async function load() {
        try {
        setLoading(true);
        const cards = await loadRandomFlashcards(db, languageId, 20);
        if (cancelled) return;

        setCards(cards);
        setStats({ correct: 0, total: cards.length, ms: [] });
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
    }, [db, languageId, run]);


  async function handleSubmit(payload: { isCorrect: boolean }) {
    if (!current) return;

    setLocked(true);

    const elapsed = Date.now() - cardStartMs;
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
            <Text color="$textFaint" fontSize={12}>
              (Once DB query is wired, this will pull unlearned items.)
            </Text>
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
