import React from "react";
import { Stack, useRouter } from "expo-router";
import { YStack, Text, XStack, Button } from "tamagui";
import { Screen } from "@/components/ui/Screen";
import { AppHeader } from "@/components/ui/AppHeader";
import { HermesButton } from "@/components/ui/HermesButton";

export default function MemorizeResults() {
  const router = useRouter();

  // TODO: Replace with real stats passed from the run
  const percentCorrect = 82;
  const avgMs = 1450;
  const fluencyLabel = avgMs < 1200 ? "Fast" : avgMs < 2000 ? "Good" : "Developing";

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
                {fluencyLabel} ({Math.round(avgMs)}ms avg)
              </Text>
            </XStack>

            <XStack justifyContent="space-between">
              <Text color="$textMuted">Mastery shift</Text>
              <Text fontWeight="900">+0.2 (stub)</Text>
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
            <Text color="$textMuted">• Today: 10 cards</Text>
            <Text color="$textMuted">• Tomorrow: 8 cards</Text>
            <Text color="$textMuted">• In 3 days: 6 cards</Text>
            <Text color="$textMuted">• In 7 days: 4 cards</Text>
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
