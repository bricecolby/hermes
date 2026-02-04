import React, { useMemo, useState } from "react";
import { YStack, Text, XStack } from "tamagui";

import { HermesTextField } from "@/components/ui/HermesTextField.tsx";
import { HermesButton } from "@/components/ui/HermesButton";
import type { LearnSettings } from "@/db/queries/learn";

function parseIntSafe(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

export function LearnSettingsEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: LearnSettings;
  onSave: (next: LearnSettings) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [vocabDailyTarget, setVocabDailyTarget] = useState(String(initial.vocabDailyTarget));
  const [vocabChunkSize, setVocabChunkSize] = useState(String(initial.vocabChunkSize));
  const [grammarDailyTarget, setGrammarDailyTarget] = useState(String(initial.grammarDailyTarget));
  const [grammarChunkSize, setGrammarChunkSize] = useState(String(initial.grammarChunkSize));

  const parsed = useMemo<LearnSettings>(() => {
    return {
      vocabDailyTarget: parseIntSafe(vocabDailyTarget, initial.vocabDailyTarget),
      vocabChunkSize: parseIntSafe(vocabChunkSize, initial.vocabChunkSize),
      grammarDailyTarget: parseIntSafe(grammarDailyTarget, initial.grammarDailyTarget),
      grammarChunkSize: parseIntSafe(grammarChunkSize, initial.grammarChunkSize),
    };
  }, [
    vocabDailyTarget,
    vocabChunkSize,
    grammarDailyTarget,
    grammarChunkSize,
    initial,
  ]);

  return (
    <YStack gap={14}>
      <Text fontSize={16} fontWeight="800" color="$color">
        Learn Queue
      </Text>

      <YStack gap={10}>
        <Text fontSize={13} color="$textMuted">
          Vocab
        </Text>
        <XStack gap={10} flexWrap="wrap">
          <YStack flex={1} minWidth={140}>
            <HermesTextField
              label="Daily target"
              value={vocabDailyTarget}
              onChangeText={setVocabDailyTarget}
              placeholder="20"
            />
          </YStack>
          <YStack flex={1} minWidth={140}>
            <HermesTextField
              label="Chunk size"
              value={vocabChunkSize}
              onChangeText={setVocabChunkSize}
              placeholder="5"
            />
          </YStack>
        </XStack>
        <Text fontSize={11} color="$textMuted">
          Targets are in concepts (20 vocab = 40 cards).
        </Text>
      </YStack>

      <YStack gap={10}>
        <Text fontSize={13} color="$textMuted">
          Grammar
        </Text>
        <XStack gap={10} flexWrap="wrap">
          <YStack flex={1} minWidth={140}>
            <HermesTextField
              label="Daily target"
              value={grammarDailyTarget}
              onChangeText={setGrammarDailyTarget}
              placeholder="5"
            />
          </YStack>
          <YStack flex={1} minWidth={140}>
            <HermesTextField
              label="Chunk size"
              value={grammarChunkSize}
              onChangeText={setGrammarChunkSize}
              placeholder="2"
            />
          </YStack>
        </XStack>
      </YStack>

      <XStack gap={10} justifyContent="flex-end" marginTop={6}>
        {onCancel ? (
          <HermesButton label="Cancel" variant="secondary" onPress={onCancel} />
        ) : null}
        <HermesButton
          label="Save"
          variant="primary"
          onPress={() => onSave(parsed)}
        />
      </XStack>
    </YStack>
  );
}
