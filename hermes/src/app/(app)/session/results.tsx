import React, { useEffect, useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useSQLiteContext } from "expo-sqlite";

import { Screen } from "../../../components/ui/Screen";
import { AppHeader } from "../../../components/ui/AppHeader";
import { HermesButton } from "../../../components/ui/HermesButton";
import { GlassCard } from "../../../components/ui/GlassCard";
import { Muted } from "../../../components/ui/Typography";
import { useAppState } from "../../../state/AppState";

type Summary = {
  totalAttempts: number;
  totalConceptGraded: number;
  correctConcept: number;
  percentCorrect: number; // concept-level
  avgMs: number | null;
  xpEarned: number;
};

function safeParseJson<T = any>(raw: unknown): T | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function Results() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { activeProfileId, activeLanguageId, endSession } = useAppState();

  const userId = activeProfileId ?? null;
  const languageId = activeLanguageId ?? null;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        if (!userId || !languageId) {
          if (!cancelled) setSummary(null);
          return;
        }

        // Most recent practice session for this user + language
        const sess = await db.getFirstAsync<{ id: number }>(
          `
          SELECT id
          FROM practice_sessions
          WHERE user_id = ?
            AND language_id = ?
            AND (modality = 'practice' OR source = 'practice' OR source = 'session')
          ORDER BY id DESC
          LIMIT 1;
          `,
          [userId, languageId]
        );

        if (!sess?.id) {
          if (!cancelled) setSummary(null);
          return;
        }

        const sessionId = sess.id;

        // Attempt count
        const attemptsCount = await db.getFirstAsync<{ n: number }>(
          `SELECT COUNT(*) AS n FROM practice_attempts WHERE session_id = ?;`,
          [sessionId]
        );

        // Concept correctness count (concept-level grading)
        const conceptAgg = await db.getFirstAsync<{ total: number; correct: number }>(
          `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct
          FROM practice_attempt_concepts pac
          JOIN practice_attempts pa ON pa.id = pac.attempt_id
          WHERE pa.session_id = ?;
          `,
          [sessionId]
        );

        const msRows = await db.getAllAsync<{ user_response_json: string | null }>(
          `SELECT user_response_json FROM practice_attempts WHERE session_id = ?;`,
          [sessionId]
        );

        const msValues = msRows
          .map((r) => safeParseJson<{ ms?: number }>(r.user_response_json)?.ms)
          .filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0);

        const avgMs =
          msValues.length > 0
            ? Math.round(msValues.reduce((a, b) => a + b, 0) / msValues.length)
            : null;

        const totalConcept = Number(conceptAgg?.total ?? 0);
        const correctConcept = Number(conceptAgg?.correct ?? 0);
        const percentCorrect = totalConcept > 0 ? Math.round((correctConcept / totalConcept) * 100) : 0;

        // Simple XP rule for now (MVP): 2 XP per correct concept
        const xpEarned = correctConcept * 2;

        const nextSummary: Summary = {
          totalAttempts: Number(attemptsCount?.n ?? 0),
          totalConceptGraded: totalConcept,
          correctConcept,
          percentCorrect,
          avgMs,
          xpEarned,
        };

        if (!cancelled) setSummary(nextSummary);
      } catch (e) {
        console.error("[results] load failed", e);
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [db, userId, languageId]);

  const fluencyLabel = useMemo(() => {
    if (summary?.avgMs == null) return "—";
    const ms = summary.avgMs;
    return ms < 1200 ? "Fast" : ms < 2000 ? "Good" : "Developing";
  }, [summary?.avgMs]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <YStack paddingTop={6} gap={14}>
        <AppHeader title="Results" />

        {loading ? (
          <YStack paddingTop={40} alignItems="center" justifyContent="center">
            <ActivityIndicator />
          </YStack>
        ) : !summary ? (
          <GlassCard>
            <Text fontSize={18} fontWeight="900">
              Session Complete
            </Text>
            <Muted marginTop={6}>
              No results found yet for this session.
            </Muted>

            <HermesButton
              marginTop={12}
              label="Back to Home"
              onPress={() => {
                endSession();
                router.replace("/(app)/home");
              }}
            />
          </GlassCard>
        ) : (
          <YStack gap={10} marginTop={10}>
            <Text fontSize={22} fontWeight="900">
              Practice Complete
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
                <Text fontWeight="900">{summary.percentCorrect}%</Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$textMuted">Items attempted</Text>
                <Text fontWeight="900">{summary.totalAttempts}</Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$textMuted">Concept accuracy</Text>
                <Text fontWeight="900">
                  {summary.correctConcept}/{summary.totalConceptGraded}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$textMuted">Fluency</Text>
                <Text fontWeight="900">
                  {fluencyLabel}
                  {summary.avgMs != null ? ` (${summary.avgMs}ms avg)` : ""}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$textMuted">XP earned</Text>
                <Text fontWeight="900">+{summary.xpEarned}</Text>
              </XStack>
            </YStack>

            <YStack
              borderWidth={1}
              borderColor="rgba(255,255,255,0.08)"
              borderRadius={16}
              padding={14}
              gap={8}
            >
              <Text fontWeight="900">Next steps</Text>
              <Text color="$textMuted">• Re-run Practice to tighten weak spots</Text>
              <Text color="$textMuted">• Jump to Learn for fast reps</Text>
              <Text color="$textMuted">• Check Analytics for session history</Text>
            </YStack>

            <HermesButton
              marginTop={6}
              label="Back to Home"
              onPress={() => {
                endSession();
                router.replace("/(app)/home");
              }}
            />
          </YStack>
        )}
      </YStack>
    </Screen>
  );
}
