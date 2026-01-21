import React from "react";
import { TouchableOpacity } from "react-native";
import { Text, YStack, useTheme } from "tamagui";
import { GradientBorderCard } from "./GradientBorderCard";

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  marginTop?: number;
};

export function HermesButton({
  label,
  onPress,
  disabled,
  variant = "primary",
  marginTop = 18,
}: Props) {
  const theme = useTheme();
  const fill = String(theme.glassFill?.val ?? "rgba(70, 90, 129, 0.55)");
  const outline = String(theme.glassOutline?.val ?? "rgba(230, 235, 255, 0.12)");

  const opacity = disabled ? 0.55 : 1;

  if (variant === "primary") {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        disabled={disabled}
        style={{ marginTop, opacity }}
      >
        <GradientBorderCard borderRadius={14} borderWidth={1.6} padding={0}>
          <YStack
            paddingVertical={8}
            paddingHorizontal={16}
            borderRadius={12}
            alignItems="center"
            justifyContent="center"
          >
            <Text color="$color" fontWeight="900" fontSize={15}>
              {label}
            </Text>
          </YStack>
        </GradientBorderCard>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      style={{ marginTop, opacity }}
    >
      <YStack
        backgroundColor={fill}
        borderWidth={1}
        borderColor={outline}
        borderRadius={14}
        paddingVertical={10}
        paddingHorizontal={16}
        alignItems="center"
      >
        <Text color="$color" fontWeight="900" fontSize={15}>
          {label}
        </Text>
      </YStack>
    </TouchableOpacity>
  );
}
