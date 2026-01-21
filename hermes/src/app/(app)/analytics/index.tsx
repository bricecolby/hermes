// src/app/(analytics)/index.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { Text, XStack, YStack } from "tamagui";

import { Screen } from "../../../components/ui/Screen";
import { GlassCard } from "../../../components/ui/GlassCard";
import { H1, SectionTitle, Muted, Sub } from "../../../components/ui/Typography";
import { HermesButton } from "../../../components/ui/HermesButton";
import { useAppState } from "../../../state/AppState";
import { Stack } from "expo-router";
import { AppHeader } from "@/components/ui/AppHeader";

import {
  getPracticeReportSummary,
  listPracticeSessionsInRange,
  type PracticeSessionReportRow,
} from "@/db/queries/sessions";

function isoStartOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function isoEndOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function Analytics() {
  const db = useSQLiteContext();
  const { activeProfileId, activeLanguageId } = useAppState();

  // default = last 7 days
  const [start, setStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [end, setEnd] = useState<Date>(() => new Date());

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PracticeSessionReportRow[]>([]);
  const [summary, setSummary] = useState<{ sessions: number; attempts: number; correct: number }>({
    sessions: 0,
    attempts: 0,
    correct: 0,
  });

  const startIso = useMemo(() => isoStartOfDay(start), [start]);
  const endIso = useMemo(() => isoEndOfDay(end), [end]);

  const accuracyPct = useMemo(() => {
    if (summary.attempts <= 0) return 0;
    return Math.round((summary.correct / summary.attempts) * 100);
  }, [summary]);

  const load = useCallback(async () => {
    if (!activeProfileId) return;

    setLoading(true);
    try {
      const s = await getPracticeReportSummary(db, {
        userId: activeProfileId,
        startIso,
        endIso,
        languageId: activeLanguageId ?? null,
      });

      const list = await listPracticeSessionsInRange(db, {
        userId: activeProfileId,
        startIso,
        endIso,
        languageId: activeLanguageId ?? null,
      });

      setSummary(s);
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [db, activeProfileId, activeLanguageId, startIso, endIso]);

  useEffect(() => {
    load();
  }, [load]);

  const rangeLabel = useMemo(() => {
    const a = start.toLocaleDateString();
    const b = end.toLocaleDateString();
    return `${a} → ${b}`;
  }, [start, end]);

  if (!activeProfileId) {
    return (
      <Screen>
        <AppHeader title="Analytics" />
        <Sub>No active profile selected.</Sub>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Analytics" subtitle={rangeLabel} />

      <YStack marginTop={14} gap={14}>
        <GlassCard>
          <SectionTitle>Summary</SectionTitle>

          <XStack justifyContent="space-between" marginTop={6}>
            <Muted>Sessions</Muted>
            <Text color="$color" fontWeight="900">
              {summary.sessions}
            </Text>
          </XStack>

          <XStack justifyContent="space-between" marginTop={6}>
            <Muted>Attempts</Muted>
            <Text color="$color" fontWeight="900">
              {summary.attempts}
            </Text>
          </XStack>

          <XStack justifyContent="space-between" marginTop={6}>
            <Muted>Accuracy</Muted>
            <Text color="$color" fontWeight="900">
              {accuracyPct}%
            </Text>
          </XStack>
        </GlassCard>

        <GlassCard>
          <SectionTitle>Sessions</SectionTitle>

          {loading ? (
            <YStack alignItems="center" paddingVertical={12}>
              <ActivityIndicator />
            </YStack>
          ) : rows.length === 0 ? (
            <Muted>No completed sessions in this range.</Muted>
          ) : (
            <YStack gap={10} marginTop={10}>
              {rows.map((r) => (
                <GlassCard key={r.id}>
                  <XStack justifyContent="space-between">
                    <Text color="$color" fontWeight="900">
                      #{r.id}
                    </Text>
                    <Muted>{r.modality ?? r.source ?? "practice"}</Muted>
                  </XStack>

                  <Muted marginTop={6}>Completed</Muted>
                  <Text color="$color">{fmtDateTime(r.completed_at)}</Text>

                  <XStack justifyContent="space-between" marginTop={10}>
                    <Muted>Attempts</Muted>
                    <Text color="$color" fontWeight="900">
                      {r.attempts}
                    </Text>
                  </XStack>

                  <XStack justifyContent="space-between" marginTop={6}>
                    <Muted>Correct</Muted>
                    <Text color="$color" fontWeight="900">
                      {r.correct}
                    </Text>
                  </XStack>
                </GlassCard>
              ))}
            </YStack>
          )}
        </GlassCard>

        <HermesButton
          label="Refresh"
          variant="secondary"
          onPress={load}
        />
      </YStack>
    </Screen>
  );
}
