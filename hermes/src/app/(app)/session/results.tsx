import React, { useMemo } from "react";
import { useRouter } from "expo-router";
import { Text, XStack, YStack } from "tamagui";

import { Screen } from "../../../components/ui/Screen";
import { GlassCard } from "../../../components/ui/GlassCard";
import { H1, SectionTitle, Muted } from "../../../components/ui/Typography";
import { HermesButton } from "../../../components/ui/HermesButton";
import { useAppState } from "../../../state/AppState";

type ConceptResultVM = {
  conceptId: number;
  label: string;
  correct: number;
  total: number;
};

export default function Results() {
  const router = useRouter();
  const { endSession } = useAppState();

  const summary = useMemo(() => {
    return {
      total: 5,
      correct: 4,
      xpEarned: 10,
      concepts: [
        { conceptId: 123, label: "Basic location words", correct: 3, total: 3 },
        { conceptId: 456, label: "Introducing yourself", correct: 1, total: 2 },
      ] as ConceptResultVM[],
    };
  }, []);

  const accuracy = Math.round((summary.correct / summary.total) * 100);
  const strengths = summary.concepts.filter((c) => c.correct === c.total);
  const weaknesses = summary.concepts.filter((c) => c.correct < c.total);

  return (
    <Screen>
      <H1>Session Complete</H1>

      <YStack marginTop={14} gap={14}>
        <GlassCard>
          <SectionTitle>Performance</SectionTitle>

          <XStack justifyContent="space-between">
            <Muted>Accuracy</Muted>
            <Text color="$color" fontWeight="900">
              {accuracy}%
            </Text>
          </XStack>

          <XStack justifyContent="space-between" marginTop={6}>
            <Muted>Questions</Muted>
            <Text color="$color" fontWeight="900">
              {summary.correct} / {summary.total}
            </Text>
          </XStack>

          <XStack justifyContent="space-between" marginTop={6}>
            <Muted>XP earned</Muted>
            <Text color="$color" fontWeight="900">
              +{summary.xpEarned}
            </Text>
          </XStack>
        </GlassCard>

        <GlassCard>
          <SectionTitle>What you did well</SectionTitle>
          {strengths.length === 0 ? (
            <Muted>No concepts mastered yet — keep going.</Muted>
          ) : (
            strengths.map((c) => (
              <Text key={c.conceptId} color="$green10" fontWeight="800">
                ✓ {c.label}
              </Text>
            ))
          )}
        </GlassCard>

        <GlassCard>
          <SectionTitle>Needs a bit more practice</SectionTitle>
          {weaknesses.length === 0 ? (
            <Text color="$green10" fontWeight="800">
              ✓ No weak spots this session
            </Text>
          ) : (
            weaknesses.map((c) => (
              <Text key={c.conceptId} color="$yellow10" fontWeight="800">
                • {c.label} ({c.correct}/{c.total})
              </Text>
            ))
          )}
        </GlassCard>

        <GlassCard>
          <SectionTitle>Suggested next steps</SectionTitle>
          <Text color="$color" lineHeight={20}>
            Nice work overall! You’re clearly comfortable with basic location words. Next, spend a
            little more time practicing short self-introductions so they feel automatic.
          </Text>
          <Muted marginTop={10}>
            (In future sessions, this feedback will be personalized based on your mistakes and goals.)
          </Muted>
        </GlassCard>

        <HermesButton
          label="Back to Home"
          variant="secondary"
          onPress={() => {
            endSession();
            router.replace("/(app)/home");
          }}
        />
      </YStack>
    </Screen>
  );
}
