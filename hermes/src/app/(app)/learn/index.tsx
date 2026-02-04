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
import { getConceptRefsByConceptIds } from "@/db/queries/concepts";
import {
  ensureLearnQueueForKind,
  getLearnSettings,
  listLearnQueueRows,
  markLearnQueueCorrect,
} from "@/db/queries/learn";

type RunStats = {
  correct: number;
  total: number;
  ms: number[];
};

type LearnCardVM = FlashcardViewModel & {
  kind: "vocab_item" | "grammar_point";
  mode: "reception" | "production";
  skill: "reading" | "writing";
  itemType: "flashcard_v1.basic";
};

async function loadLearnFlashcards(
  db: SQLite.SQLiteDatabase,
  args: {
    userId: number;
    languageId: number;
    modelKey: string;
    vocabChunkSize: number;
    grammarChunkSize: number;
  }
): Promise<LearnCardVM[]> {
  const { userId, languageId, modelKey, vocabChunkSize, grammarChunkSize } = args;

  await ensureLearnQueueForKind(db, {
    userId,
    languageId,
    kind: "vocab_item",
    chunkSize: vocabChunkSize,
    modelKey,
  });

  await ensureLearnQueueForKind(db, {
    userId,
    languageId,
    kind: "grammar_point",
    chunkSize: grammarChunkSize,
    modelKey,
  });

  const queueRows = await listLearnQueueRows(db, { userId, languageId });
  const pending = queueRows.filter((r) => r.correctOnce === 0);

  const conceptIds = Array.from(new Set(pending.map((r) => r.conceptId)));
  const refs = await getConceptRefsByConceptIds(db, conceptIds);
  const byId = new Map(refs.map((r) => [r.conceptId, r]));

  const cards: LearnCardVM[] = [];
  for (const r of pending) {
    const ref = byId.get(r.conceptId);
    if (!ref) continue;

    const l2 = (ref.title ?? "").trim();
    const l1 = (ref.description ?? "").trim();

    if (!l2 || !l1) continue;

    if (ref.kind === "vocab_item") {
      const mode = r.modality === "production" ? "production" : "reception";
      cards.push({
        conceptId: ref.conceptId,
        kind: "vocab_item",
        front: mode === "reception" ? l2 : l1,
        back: mode === "reception" ? l1 : l2,
        mode,
        skill: mode === "production" ? "writing" : "reading",
        itemType: "flashcard_v1.basic",
      });
    } else {
      cards.push({
        conceptId: ref.conceptId,
        kind: "grammar_point",
        front: l2,
        back: l1,
        mode: "reception",
        skill: "reading",
        itemType: "flashcard_v1.basic",
      });
    }
  }

  // Shuffle so the user doesn't always see the same ordering.
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

export default function Learn() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();
  const { activeLanguageId, activeProfileId, setSessionDbId, sessionDbId } = useAppState();
  const { run } = useLocalSearchParams<{ run?: string }>();

  const languageId = activeLanguageId ?? (() => { throw new Error("No active language"); })();
  const userId = activeProfileId ?? (() => { throw new Error("No active profile"); })();

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<LearnCardVM[]>([]);
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);

  const [stats, setStats] = useState<RunStats>({ correct: 0, total: 0, ms: [] });
  const current = useMemo(() => cards[idx] ?? null, [cards, idx]);

  const [localSessionId, setLocalSessionId] = useState<number | null>(null);

  useEffect(() => {
    console.log("[Learn] mount");
    return () => console.log("[Learn] unmount");
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
          source: "learn",
        });

        setSessionDbId(newSessionId);
        setLocalSessionId(newSessionId);

        const settings = await getLearnSettings(db, { userId, languageId });

        const nextCards = await loadLearnFlashcards(db, {
          userId,
          languageId,
          modelKey: "ema_v1",
          vocabChunkSize: settings.vocabChunkSize,
          grammarChunkSize: settings.grammarChunkSize,
        });

        if (cancelled) return;

        setCards(nextCards);
        setStats({ correct: 0, total: nextCards.length, ms: [] });
        setIdx(0);
        setLocked(false);
      } catch (e) {
        console.error("[learn] load failed", e);
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

    console.log("[learn] logging attempt", { sessionDbId, localSessionId, current, payload });

    const sid = localSessionId ?? sessionDbId;
    if (!sid) {
      console.warn("[learn] missing session id; cannot log attempt");
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
            evidence: { source: "learn" },
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
      console.error("[learn] attempt logging failed", e);
    }

    setStats((s) => ({
      ...s,
      correct: s.correct + (isCorrect ? 1 : 0),
      ms: [...s.ms, responseMs],
    }));

    if (isCorrect) {
      try {
        await markLearnQueueCorrect(db, {
          userId,
          languageId,
          conceptId: current.conceptId,
          modality: current.mode,
        });
      } catch (e) {
        console.warn("[learn] failed to mark learn queue correct", e);
      }
    }

    if (!isCorrect) {
      setCards((prev) => {
        const next = prev.slice();
        const item = next.splice(idx, 1)[0];
        next.push(item);
        return next;
      });
      setLocked(false);
      return;
    }

    const remaining = cards.filter((_, i) => i !== idx);
    if (remaining.length === 0) {
      router.replace("/learn/results");
      return;
    }

    setCards(remaining);
    setIdx((prevIdx) => Math.min(prevIdx, remaining.length - 1));
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
