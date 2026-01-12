// src/components/ui/HermesAccordion.tsx
import React from "react";
import { TouchableOpacity } from "react-native";
import { XStack, YStack, Text } from "tamagui";

export function HermesAccordion({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <YStack
      borderBottomWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
    >
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
        >
          <YStack flex={1} gap="$1">
            <Text fontSize="$6" fontWeight="800" color="$color">
              {title}
            </Text>
            {subtitle ? (
              <Text fontSize="$3" color="$color11">
                {subtitle}
              </Text>
            ) : null}
          </YStack>

          <Text color="$color11" fontSize="$6">
            {expanded ? "▾" : "▸"}
          </Text>
        </XStack>
      </TouchableOpacity>

      {expanded ? <YStack paddingBottom="$2">{children}</YStack> : null}
    </YStack>
  );
}
