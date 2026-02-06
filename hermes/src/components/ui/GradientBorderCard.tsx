import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { YStack, type YStackProps, useTheme } from "tamagui";
import { resolveThemeColor } from "./themeColor";

type GradientBorderCardProps = YStackProps & {
  borderRadius?: number;
  borderWidth?: number;
};

export function GradientBorderCard({
  children,
  borderRadius = 16,
  borderWidth = 1.6,
  ...props
}: GradientBorderCardProps) {
  const theme = useTheme();

  const gradA = resolveThemeColor(theme.gradA, "#1971FF");
  const gradB = resolveThemeColor(theme.gradB, "#1EE6A8");

  // tinted inner “glass but gradient”
  const tintA = resolveThemeColor(theme.gradTintA, "rgba(25, 113, 255, 0.14)");
  const tintB = resolveThemeColor(theme.gradTintB, "rgba(30, 230, 168, 0.10)");

  const outline = resolveThemeColor(theme.glassOutline, "rgba(230, 235, 255, 0.12)");

  return (
    <LinearGradient
      colors={[gradA, gradB]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ borderRadius, padding: borderWidth }}
    >
      <LinearGradient
        colors={[tintA, tintB]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: borderRadius - 2,
        }}
      >
        <YStack
          borderRadius={borderRadius - 2}
          padding={14}
          borderWidth={1}
          borderColor={outline}

          backgroundColor="rgba(18, 26, 42, 0.8)"
          {...props}
        >
          {children}
        </YStack>
      </LinearGradient>
    </LinearGradient>
  );
}
