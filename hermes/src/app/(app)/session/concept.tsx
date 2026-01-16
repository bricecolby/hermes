import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { Text, YStack } from "tamagui";

import { Screen } from "../../../components/ui/Screen";
import { GlassCard } from "../../../components/ui/GlassCard";
import { H1, Sub, SectionTitle, Muted } from "../../../components/ui/Typography";
import { VocabRow, StackRow } from "../../../components/ui/ListRow";
import { HermesButton } from "../../../components/ui/HermesButton";
import { useAppState } from "../../../state/AppState";

type VocabVM = { id: number; target: string; native: string };
type GrammarVM = { id: number; title: string; summary: string };

// MVP stub — replace with real DB queries
async function fetchSessionConceptsStub(conceptIds: number[]) {
  const vocab: VocabVM[] = [];
  const grammar: GrammarVM[] = [];

  conceptIds.forEach((id, i) => {
    if (i % 2 === 0) {
      vocab.push({ id, target: "метро", native: "subway" });
    } else {
      grammar.push({
        id,
        title: "Word order in Russian",
        summary: "Word order is flexible and emphasis changes meaning.",
      });
    }
  });

  return { vocab, grammar };
}

export default function Concept() {
  const router = useRouter();
  const { session } = useAppState();

  const conceptIds = useMemo(() => session?.conceptIds ?? [], [session?.conceptIds]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      setVocab([]);
      setGrammar([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { vocab, grammar } = await fetchSessionConceptsStub(conceptIds);
        if (cancelled) return;
        setVocab(vocab);
        setGrammar(grammar);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.id, conceptIds]);


  const [loading, setLoading] = useState(true);
  const [vocab, setVocab] = useState<VocabVM[]>([]);
  const [grammar, setGrammar] = useState<GrammarVM[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { vocab, grammar } = await fetchSessionConceptsStub(conceptIds);
        setVocab(vocab);
        setGrammar(grammar);
      } finally {
        setLoading(false);
      }
    })();
  }, [conceptIds]);

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

      {loading ? (
        <View style={{ marginTop: 20, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <YStack marginTop={14} gap={14}>
          <GlassCard>
            <SectionTitle>Vocabulary</SectionTitle>

            {vocab.length === 0 ? (
              <Muted>No new vocabulary in this session.</Muted>
            ) : (
              vocab.map((v) => (
                <VocabRow
                  key={v.id}
                  onPress={() =>
                    router.push({
                      pathname: "/(modals)/vocab/[id]",
                      params: { id: String(v.id), returnTo: "/(app)/session/concept" },
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
                  key={g.id}
                  onPress={() =>
                    router.push({
                      pathname: "/(modals)/grammar/[id]",
                      params: { id: String(g.id), returnTo: "/(app)/session/concept" },
                    })
                  }
                  title={
                    <Text color="$color" fontWeight="900">
                      {g.title}
                    </Text>
                  }
                  subtitle={
                    <Text color="$color11">
                      {g.summary}
                    </Text>
                  }
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
      )}
    </Screen>
  );
}
