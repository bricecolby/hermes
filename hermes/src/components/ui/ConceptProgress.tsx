import React, { useEffect, useMemo, useState } from "react";
import { XStack, YStack, Text } from "tamagui";
import type { SQLiteDatabase } from "expo-sqlite";

import { listMasteryForConcept, type ConceptMasteryRow } from "@/db/queries/mastery";
import { DEFAULT_TIER_RULES } from "@/db/queries/concepts";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function pct(correct: number, total: number) {
  if (total <= 0) return null;
  return Math.round((correct / total) * 100);
}

function stageLabel(mastery: number | null, rtNorm: number | null, attempts: number) {
  if (attempts <= 0 || mastery == null) return "Unseen";

  const rules = DEFAULT_TIER_RULES;

  if (
    mastery >= rules.autoMin &&
    rtNorm != null &&
    rtNorm <= rules.autoRtNormMax
  ) {
    return "Automatic";
  }

  if (
    mastery >= rules.fluencyMin &&
    rtNorm != null &&
    rtNorm <= rules.fluencyRtNormMax
  ) {
    return "Fluent";
  }

  if (mastery >= rules.masteryMin) return "Mastered";
  return "Exposed";
}

function formatModalityLabel(m: string) {
  if (m === "reception") return "Reception";
  if (m === "production") return "Production";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

type Props = {
  db: SQLiteDatabase;
  userId: number;
  conceptId: number;
  addedOn?: string | null;
};

export function ConceptProgress({ db, userId, conceptId, addedOn }: Props) {
  const [rows, setRows] = useState<ConceptMasteryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const r = await listMasteryForConcept(db, { userId, conceptId });
        if (!cancelled) setRows(r);
      } catch (e) {
        console.warn("[concept progress] load failed", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, userId, conceptId]);

  const byModality = useMemo(() => {
    const map = new Map<string, ConceptMasteryRow>();
    for (const r of rows) map.set(r.modality, r);
    return map;
  }, [rows]);

  const overall = useMemo(() => {
    let attempts = 0;
    let correct = 0;
    let lastAttempt: string | null = null;

    for (const r of rows) {
      attempts += Number(r.attempts_count ?? 0);
      correct += Number(r.correct_count ?? 0);
      if (!lastAttempt || (r.last_attempt_at && r.last_attempt_at > lastAttempt)) {
        lastAttempt = r.last_attempt_at ?? lastAttempt;
      }
    }

    return { attempts, correct, accuracy: pct(correct, attempts), lastAttempt };
  }, [rows]);

  const modalities = ["reception", "production"] as const;

  return (
    <YStack gap="$2">
      <Text fontSize="$7" fontWeight="900" color="$color">
        Progress
      </Text>

      <YStack
        padding="$3"
        borderRadius="$5"
        backgroundColor="$glassFill"
        borderWidth={1}
        borderColor="$borderColor"
        gap="$2"
      >
        <XStack justifyContent="space-between">
          <Text color="$color11">Added On</Text>
          <Text color="$color11">{fmtDate(addedOn)}</Text>
        </XStack>

        <XStack justifyContent="space-between">
          <Text color="$color11">Attempts</Text>
          <Text color="$color11">{overall.attempts}</Text>
        </XStack>

        <XStack justifyContent="space-between">
          <Text color="$color11">Accuracy</Text>
          <Text color="$color11">{overall.accuracy == null ? "—" : `${overall.accuracy}%`}</Text>
        </XStack>

        <XStack justifyContent="space-between">
          <Text color="$color11">Last Attempt</Text>
          <Text color="$color11">{fmtDate(overall.lastAttempt)}</Text>
        </XStack>
      </YStack>

      {loading ? (
        <Text color="$color11">Loading mastery…</Text>
      ) : (
        modalities.map((m) => {
          const row = byModality.get(m);
          const attempts = Number(row?.attempts_count ?? 0);
          const correct = Number(row?.correct_count ?? 0);
          const accuracy = pct(correct, attempts);
          const mastery = row?.mastery ?? null;
          const rtNorm = row?.rt_norm ?? null;

          return (
            <YStack
              key={m}
              padding="$3"
              borderRadius="$5"
              backgroundColor="$glassFill"
              borderWidth={1}
              borderColor="$borderColor"
              gap="$2"
            >
              <Text fontWeight="800" color="$color">
                {formatModalityLabel(m)}
              </Text>

              <XStack justifyContent="space-between">
                <Text color="$color11">Attempts</Text>
                <Text color="$color11">{attempts}</Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$color11">Accuracy</Text>
                <Text color="$color11">{accuracy == null ? "—" : `${accuracy}%`}</Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$color11">Level</Text>
                <Text color="$color11">
                  {stageLabel(mastery, rtNorm, attempts)}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$color11">Mastery</Text>
                <Text color="$color11">
                  {mastery == null ? "—" : mastery.toFixed(2)}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$color11">RT Avg</Text>
                <Text color="$color11">
                  {row?.rt_avg_ms == null ? "—" : `${Math.round(row.rt_avg_ms)}ms`}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$color11">RT Norm</Text>
                <Text color="$color11">
                  {row?.rt_norm == null ? "—" : row.rt_norm.toFixed(2)}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$color11">Half-life</Text>
                <Text color="$color11">
                  {row?.half_life_days == null
                    ? "—"
                    : `${row.half_life_days.toFixed(2)}d`}
                </Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$color11">Due</Text>
                <Text color="$color11">{fmtDate(row?.due_at)}</Text>
              </XStack>

              <XStack justifyContent="space-between">
                <Text color="$color11">Last Attempt</Text>
                <Text color="$color11">{fmtDate(row?.last_attempt_at)}</Text>
              </XStack>
            </YStack>
          );
        })
      )}
    </YStack>
  );
}
