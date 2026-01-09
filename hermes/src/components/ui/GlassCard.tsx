import React from "react";
import { YStack, type YStackProps, useTheme } from "tamagui";

type GlassCardProps = YStackProps & {
  strong?: boolean;
};

export function GlassCard({ strong, children, ...props }: GlassCardProps) {
  const theme = useTheme();

  const fill = String(
    (strong ? theme.glassFillStrong?.val : theme.glassFill?.val) ??
      "rgba(70, 90, 129, 0.55)"
  );

  const outline = String(theme.glassOutline?.val ?? "rgba(230, 235, 255, 0.12)");

  return (
    <YStack
      borderRadius={16}
      padding={14}
      backgroundColor={fill}
      borderWidth={1}
      borderColor={outline}
      {...props}
    >
      {children}
    </YStack>
  );
}
