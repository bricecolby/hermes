import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator } from "react-native";
import { Text, YStack } from "tamagui";
import { useSQLiteContext } from "expo-sqlite";

import { Screen } from "@/components/ui/Screen";
import { GlassCard } from "@/components/ui/GlassCard";
import { H1, Sub, SectionTitle, Muted } from "@/components/ui/Typography";
import { VocabRow, StackRow } from "@/components/ui/ListRow";
import { HermesButton } from "@/components/ui/HermesButton";
import { useAppState } from "@/state/AppState";

import { getConceptRefsByConceptIds, type ConceptRefRow } from "@/db/queries/concepts";
import {
  ensureLearnQueueForKind,
  getLearnSettings,
  listLearnQueueRows,
} from "@/db/queries/learn";

type VocabVM = {
  conceptId: number;
  vocabItemId: number;
  target: string;
  native: string;
};

type GrammarVM = {
  conceptId: number;
  grammarItemId: number;
  title: string;
  summary: string;
};

export default function LearnConcept() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { activeLanguageId, activeProfileId } = useAppState();

  const languageId = activeLanguageId ?? (() => { throw new Error("No active language"); })();
  const userId = activeProfileId ?? (() => { throw new Error("No active profile"); })();

  const [loading, setLoading] = useState(true);
  const [conceptIds, setConceptIds] = useState<number[]>([]);
  const [conceptRefs, setConceptRefs] = useState<ConceptRefRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const settings = await getLearnSettings(db, { userId, languageId });

        await ensureLearnQueueForKind(db, {
          userId,
          languageId,
          kind: "vocab_item",
          chunkSize: settings.vocabChunkSize,
          modelKey: "ema_v1",
        });

        await ensureLearnQueueForKind(db, {
          userId,
          languageId,
          kind: "grammar_point",
          chunkSize: settings.grammarChunkSize,
          modelKey: "ema_v1",
        });

        const queue = await listLearnQueueRows(db, { userId, languageId });
        const pending = queue.filter((r) => r.correctOnce === 0);
        const ids = Array.from(new Set(pending.map((r) => r.conceptId)));

        const refs = await getConceptRefsByConceptIds(db, ids);
        if (cancelled) return;

        setConceptIds(ids);
        setConceptRefs(refs);
      } catch (e) {
        console.warn("[learn concept] load failed", e);
        if (!cancelled) {
          setConceptIds([]);
          setConceptRefs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [db, languageId, userId]);

  const vocab = useMemo<VocabVM[]>(() => {
    return conceptRefs
      .filter((r) => r.kind === "vocab_item")
      .map((r) => ({
        conceptId: r.conceptId,
        vocabItemId: r.refId,
        target: r.title ?? "",
        native: r.description ?? "",
      }));
  }, [conceptRefs]);

  const grammar = useMemo<GrammarVM[]>(() => {
    return conceptRefs
      .filter((r) => r.kind === "grammar_point")
      .map((r) => ({
        conceptId: r.conceptId,
        grammarItemId: r.refId,
        title: r.title ?? "",
        summary: r.description ?? "",
      }));
  }, [conceptRefs]);

  if (loading) {
    return (
      <Screen>
        <H1>Learn Preview</H1>
        <Sub>Preparing your learn queue…</Sub>
        <YStack marginTop={14} alignItems="center">
          <ActivityIndicator />
        </YStack>
      </Screen>
    );
  }

  if (conceptIds.length === 0) {
    return (
      <Screen>
        <H1>Learn Preview</H1>
        <Sub>No new concepts available right now.</Sub>
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>Learn Preview</H1>
      <Sub>Here’s what you’ll see in this learn session.</Sub>

      <YStack marginTop={14} gap={14}>
        <GlassCard>
          <SectionTitle>Vocabulary</SectionTitle>

          {vocab.length === 0 ? (
            <Muted>No new vocabulary in this session.</Muted>
          ) : (
            vocab.map((v) => (
              <VocabRow
                key={v.conceptId}
                onPress={() =>
                  router.push({
                    pathname: "/(modals)/vocab/[id]",
                    params: { id: String(v.vocabItemId), returnTo: "/(app)/learn/concept" },
                  })
                }
                left={
                  <Text color="$color" fontWeight="900">
                    {v.target}
                  </Text>
                }
                right={
                  <Text color="$color11" fontWeight="700">
                    {v.native}
                  </Text>
                }
              />
            ))
          )}
        </GlassCard>

        <GlassCard>
          <SectionTitle>Grammar</SectionTitle>

          {grammar.length === 0 ? (
            <Muted>No grammar focus in this session.</Muted>
          ) : (
            grammar.map((g) => (
              <StackRow
                key={g.conceptId}
                onPress={() =>
                  router.push({
                    pathname: "/(modals)/grammar/[id]",
                    params: { id: String(g.grammarItemId), returnTo: "/(app)/learn/concept" },
                  })
                }
                title={
                  <Text color="$color" fontWeight="900">
                    {g.title}
                  </Text>
                }
                subtitle={<Text color="$color11">{g.summary}</Text>}
              />
            ))
          )}
        </GlassCard>

        <HermesButton
          label="Start Learning"
          variant="primary"
          onPress={() =>
            router.replace({
              pathname: "/(app)/learn",
              params: { run: String(Date.now()) },
            })
          }
        />
      </YStack>
    </Screen>
  );
}
