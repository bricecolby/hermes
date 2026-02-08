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

  return (
    <YStack gap="$1.5">
      <Text fontSize="$6" fontWeight="900" color="$color">
        Progress
      </Text>

      {loading ? (
        <Text color="$color11">Loading mastery…</Text>
      ) : (
        <ProgressTable
          reception={byModality.get("reception") ?? null}
          production={byModality.get("production") ?? null}
        />
      )}
    </YStack>
  );
}

function ProgressTable({
  reception,
  production,
}: {
  reception: ConceptMasteryRow | null;
  production: ConceptMasteryRow | null;
}) {
  const recAttempts = Number(reception?.attempts_count ?? 0);
  const recCorrect = Number(reception?.correct_count ?? 0);
  const recAccuracy = pct(recCorrect, recAttempts);
  const recMastery = reception?.mastery ?? null;
  const recRtNorm = reception?.rt_norm ?? null;

  const prodAttempts = Number(production?.attempts_count ?? 0);
  const prodCorrect = Number(production?.correct_count ?? 0);
  const prodAccuracy = pct(prodCorrect, prodAttempts);
  const prodMastery = production?.mastery ?? null;
  const prodRtNorm = production?.rt_norm ?? null;

  const rows: Array<[string, string, string]> = [
    ["Attempts", String(recAttempts), String(prodAttempts)],
    ["Accuracy", recAccuracy == null ? "—" : `${recAccuracy}%`, prodAccuracy == null ? "—" : `${prodAccuracy}%`],
    [
      "Level",
      stageLabel(recMastery, recRtNorm, recAttempts),
      stageLabel(prodMastery, prodRtNorm, prodAttempts),
    ],
    [
      "Mastery",
      recMastery == null ? "—" : recMastery.toFixed(2),
      prodMastery == null ? "—" : prodMastery.toFixed(2),
    ],
    ["Due", fmtDate(reception?.due_at), fmtDate(production?.due_at)],
    ["Last Attempt", fmtDate(reception?.last_attempt_at), fmtDate(production?.last_attempt_at)],
  ];

  return (
    <YStack
      padding="$2"
      borderRadius="$4"
      backgroundColor="$glassFill"
      borderWidth={1}
      borderColor="$borderColor"
      gap="$1"
    >
      <XStack borderBottomWidth={1} borderColor="$borderColor">
        <YStack flex={1} paddingVertical="$1" paddingHorizontal="$1">
          <Text color="$color11" fontWeight="800" fontSize="$2">
            Metric
          </Text>
        </YStack>
        <YStack flex={1} paddingVertical="$1" paddingHorizontal="$1">
          <Text color="$color11" fontWeight="800" fontSize="$2">
            Reception
          </Text>
        </YStack>
        <YStack flex={1} paddingVertical="$1" paddingHorizontal="$1">
          <Text color="$color11" fontWeight="800" fontSize="$2">
            Production
          </Text>
        </YStack>
      </XStack>

      {rows.map((r, idx) => (
        <XStack
          key={r[0]}
          borderBottomWidth={idx === rows.length - 1 ? 0 : 1}
          borderColor="$borderColor"
        >
          <YStack flex={1} paddingVertical="$1" paddingHorizontal="$1">
            <Text color="$color11" fontSize="$2">
              {r[0]}
            </Text>
          </YStack>
          <YStack flex={1} paddingVertical="$1" paddingHorizontal="$1">
            <Text color="$color11" fontSize="$2">
              {r[1]}
            </Text>
          </YStack>
          <YStack flex={1} paddingVertical="$1" paddingHorizontal="$1">
            <Text color="$color11" fontSize="$2">
              {r[2]}
            </Text>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}
