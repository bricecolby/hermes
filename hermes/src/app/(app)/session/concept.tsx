import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { Text, YStack } from "tamagui";

import { Screen } from "../../../components/ui/Screen";
import { GlassCard } from "../../../components/ui/GlassCard";
import { H1, Sub, SectionTitle, Muted } from "../../../components/ui/Typography";
import { VocabRow, StackRow } from "../../../components/ui/ListRow";
import { HermesButton } from "../../../components/ui/HermesButton";
import { useAppState } from "../../../state/AppState";

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

export default function Concept() {
  const router = useRouter();
  const { session } = useAppState();

  const vocab = useMemo<VocabVM[]>(() => {
    const refs = session?.conceptRefs ?? [];
    return refs
      .filter((r) => r.kind === "vocab_item")
      .map((r) => ({
        conceptId: r.conceptId,
        vocabItemId: r.refId,
        target: r.title ?? "",
        native: r.description ?? "",
      }));
  }, [session?.conceptRefs]);

  const grammar = useMemo<GrammarVM[]>(() => {
    const refs = session?.conceptRefs ?? [];
    return refs
      .filter((r) => r.kind === "grammar_item")
      .map((r) => ({
        conceptId: r.conceptId,
        grammarItemId: r.refId,
        title: r.title ?? "",
        summary: r.description ?? "",
      }));
  }, [session?.conceptRefs]);

  if (!session) {
    return (
      <Screen>
        <H1>Session Prep</H1>
        <Sub>No active session.</Sub>
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>Quick Review</H1>
      <Sub>Here’s what you’ll see in this session. Tap anything to review in more detail.</Sub>

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
                    params: { id: String(v.vocabItemId), returnTo: "/(app)/session/concept" },
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
                    params: { id: String(g.grammarItemId), returnTo: "/(app)/session/concept" },
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
          label="Start Practice"
          variant="primary"
          onPress={() => router.replace("/(app)/session/practice")}
        />
      </YStack>
    </Screen>
  );
}
