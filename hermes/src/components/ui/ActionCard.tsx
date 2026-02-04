import React from "react";
import { TouchableOpacity } from "react-native";
import { YStack, Text, XStack } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";

type Props = {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
  footer?: React.ReactNode;
  showChevron?: boolean;
  chevronOpen?: boolean;
  onChevronPress?: () => void;
};

export function ActionCard({
  title,
  subtitle,
  disabled,
  onPress,
  rightSlot,
  footer,
  showChevron,
  chevronOpen,
  onChevronPress,
}: Props) {
  const chevronRotation = chevronOpen ? "-90deg" : "90deg";

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
        <XStack alignItems="center" justifyContent="space-between" gap={12}>
          <YStack flex={1}>
            <Text fontSize={16} fontWeight="800" color="$color">
              {title}
            </Text>

            {!!subtitle && (
              <Text marginTop={4} color="$textMuted">
                {subtitle}
              </Text>
            )}
          </YStack>

          {rightSlot || showChevron ? (
            <XStack alignItems="center" gap={10}>
              {rightSlot}
              {showChevron ? (
                <TouchableOpacity
                  onPress={onChevronPress}
                  disabled={!onChevronPress}
                  activeOpacity={0.8}
                >
                  <IconSymbol
                    name="chevron.right"
                    size={18}
                    weight="medium"
                    color="rgba(255,255,255,0.65)"
                    style={{ transform: [{ rotate: chevronRotation }] }}
                  />
                </TouchableOpacity>
              ) : null}
            </XStack>
          ) : null}
        </XStack>

        {footer ? (
          <YStack
            marginTop={12}
            paddingTop={12}
            borderTopWidth={1}
            borderColor="rgba(255,255,255,0.06)"
          >
            {footer}
          </YStack>
        ) : null}
      </YStack>
    </TouchableOpacity>
  );
}
