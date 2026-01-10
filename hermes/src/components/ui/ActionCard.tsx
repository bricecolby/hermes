import React from "react";
import { TouchableOpacity } from "react-native";
import { YStack, Text } from "tamagui";

type Props = {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onPress?: () => void;
};

export function ActionCard({ title, subtitle, disabled, onPress }: Props) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={disabled}>
      <YStack
        backgroundColor="#121A2A"
        borderWidth={1}
        borderColor="#1E2A44"
        borderRadius={14}
        padding={14}
        opacity={disabled ? 0.55 : 1}
      >
        <Text fontSize={16} fontWeight="800" color="$color">
          {title}
        </Text>

        {!!subtitle && (
          <Text marginTop={4} color="$textMuted">
            {subtitle}
          </Text>
        )}
      </YStack>
    </TouchableOpacity>
  );
}
