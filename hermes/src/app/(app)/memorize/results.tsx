import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { YStack, Text, XStack } from "tamagui";

import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { HermesButton } from "@/components/ui/HermesButton";

import { finalizePracticeSession } from "@/analytics/finalize";
import { useAppState } from "@/state/AppState";

type SessionStats = {
  attempts: number;
  correct: number;
  avgMs: number | null;
};

export default function MemorizeResults() {
  const router = useRouter();
  const db = useSQLiteContext();

  const { sessionDbId } = useAppState();

  const finalizedRef = useRef(false);

  const [stats, setStats] = useState<SessionStats>({
    attempts: 0,
    correct: 0,
    avgMs: null,
  });

  useEffect(() => {
    if (!sessionDbId) return;
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    finalizePracticeSession(db, sessionDbId).catch((e) => {
      console.warn("[memorize results] finalizePracticeSession failed", e);
    });
  }, [db, sessionDbId]);

  useEffect(() => {
    if (!sessionDbId) return;

    (async () => {
      // Attempts in this session
      const a = await db.getFirstAsync<{ attempts: number }>(
        `SELECT COUNT(*) AS attempts
         FROM practice_attempts
         WHERE session_id = ?;`,
        [sessionDbId]
      );

      const c = await db.getFirstAsync<{ correct: number }>(
        `SELECT COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct
         FROM practice_attempt_concepts pac
         JOIN practice_attempts pa ON pa.id = pac.attempt_id
         WHERE pa.session_id = ?;`,
        [sessionDbId]
      );

      const ms = await db.getFirstAsync<{ avgMs: number | null }>(
        `
        SELECT
          AVG(
            CAST(
              json_extract(pa.user_response_json, '$.ms')
              AS REAL
            )
          ) AS avgMs
        FROM practice_attempts pa
        WHERE pa.session_id = ?
          AND pa.user_response_json IS NOT NULL;
        `,
        [sessionDbId]
      );

      setStats({
        attempts: Number(a?.attempts ?? 0),
        correct: Number(c?.correct ?? 0),
        avgMs: ms?.avgMs == null ? null : Number(ms.avgMs),
      });
    })().catch((e) => {
      console.warn("[memorize results] stats load failed", e);
    });
  }, [db, sessionDbId]);

  const percentCorrect = useMemo(() => {
    if (stats.attempts <= 0) return 0;
    return Math.round((stats.correct / stats.attempts) * 100);
  }, [stats.correct, stats.attempts]);

  const avgMs = stats.avgMs ?? 0;

  const fluencyLabel = useMemo(() => {
    if (stats.avgMs == null) return "—";
    if (avgMs < 1200) return "Fast";
    if (avgMs < 2000) return "Good";
    return "Developing";
  }, [avgMs, stats.avgMs]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack paddingTop={6} gap={14}>
        <AppHeader title="Results" />

        <YStack gap={10} marginTop={10}>
          <Text fontSize={22} fontWeight="900">
            Flashcards Complete
          </Text>

          <YStack
            borderWidth={1}
            borderColor="rgba(255,255,255,0.08)"
            borderRadius={16}
            padding={14}
            gap={10}
          >
            <XStack justifyContent="space-between">
              <Text color="$textMuted">Percent correct</Text>
              <Text fontWeight="900">{percentCorrect}%</Text>
            </XStack>

            <XStack justifyContent="space-between">
              <Text color="$textMuted">Fluency</Text>
              <Text fontWeight="900">
                {fluencyLabel}
                {stats.avgMs == null ? "" : ` (${Math.round(avgMs)}ms avg)`}
              </Text>
            </XStack>

            <XStack justifyContent="space-between">
              <Text color="$textMuted">Attempts</Text>
              <Text fontWeight="900">{stats.attempts}</Text>
            </XStack>
          </YStack>

          <YStack
            borderWidth={1}
            borderColor="rgba(255,255,255,0.08)"
            borderRadius={16}
            padding={14}
            gap={8}
          >
            <Text fontWeight="900">Next reviews</Text>
            <Text color="$textMuted">• Today: (todo)</Text>
            <Text color="$textMuted">• Tomorrow: (todo)</Text>
            <Text color="$textMuted">• In 3 days: (todo)</Text>
            <Text color="$textMuted">• In 7 days: (todo)</Text>
          </YStack>

          <HermesButton
            marginTop={6}
            label="Back to Home"
            onPress={() => router.replace("/(app)/home")}
          />
        </YStack>
      </YStack>
    </Screen>
  );
}
