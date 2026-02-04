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
import { getDueConceptRefsForReview } from "@/db/queries/concepts";

type RunStats = {
  correct: number;
  total: number;
  ms: number[];
};

type ReviewCardVM = FlashcardViewModel & {
  mode: "reception" | "production";
  skill: "reading" | "writing";
  itemType: "flashcard_v1.basic";
};

function modalityToMode(modality: string | null | undefined): ReviewCardVM["mode"] {
  return modality === "production" ? "production" : "reception";
}

function modeToSkill(mode: ReviewCardVM["mode"]): ReviewCardVM["skill"] {
  return mode === "production" ? "writing" : "reading";
}

async function loadReviewFlashcards(
  db: SQLite.SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    totalCards: number;
  }
): Promise<ReviewCardVM[]> {
  const { userId, languageId, modelKey, totalCards } = args;

  const dueRows = await getDueConceptRefsForReview(db, {
    userId,
    languageId,
    modelKey,
    limit: totalCards,
    dueBeforeIso: new Date().toISOString(),
  });

  const cards: ReviewCardVM[] = [];

  for (const r of dueRows) {
    const l2 = (r.title ?? "").trim();
    const l1 = (r.description ?? "").trim();
    const mode = modalityToMode(r.modality);
    const skill = modeToSkill(mode);

    if (!l2 || !l1) continue;

    cards.push({
      conceptId: r.conceptId,
      front: mode === "reception" ? l2 : l1,
      back: mode === "reception" ? l1 : l2,
      mode,
      skill,
      itemType: "flashcard_v1.basic",
    });
  }

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards.slice(0, totalCards);
}

export default function Review() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeLanguageId, activeProfileId, setSessionDbId, sessionDbId } = useAppState();
  const { run } = useLocalSearchParams<{ run?: string }>();

  const languageId = activeLanguageId ?? (() => { throw new Error("No active language"); })();
  const userId = activeProfileId ?? (() => { throw new Error("No active profile"); })();

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<ReviewCardVM[]>([]);
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);

  const [stats, setStats] = useState<RunStats>({ correct: 0, total: 0, ms: [] });
  const current = useMemo(() => cards[idx] ?? null, [cards, idx]);

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
          modality: null,
          source: "review",
        });

        setSessionDbId(newSessionId);
        setLocalSessionId(newSessionId);

        const nextCards = await loadReviewFlashcards(db, {
          userId,
          languageId,
          modelKey: "ema_v1",
          totalCards: 20,
        });

        if (cancelled) return;

        setCards(nextCards);
        setStats({ correct: 0, total: nextCards.length, ms: [] });
        setIdx(0);
        setLocked(false);
      } catch (e) {
        console.error("[review] load failed", e);
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

    const sid = localSessionId ?? sessionDbId;
    if (!sid) {
      console.warn("[review] missing session id; cannot log attempt");
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
            evidence: { source: "review" },
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
      console.error("[review] attempt logging failed", e);
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
        <AppHeader title="Review" />

        {loading ? (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <ActivityIndicator />
          </YStack>
        ) : !current ? (
          <YStack flex={1} alignItems="center" justifyContent="center" gap={8}>
            <Text color="$textMuted">No cards due right now.</Text>
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
