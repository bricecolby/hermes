import React from "react";
import { TouchableOpacity } from "react-native";
import { XStack, YStack, Text, useTheme } from "tamagui";
import { resolveThemeColor } from "./themeColor";

type BaseRowProps = {
  onPress?: () => void;
  children: React.ReactNode;
};

function RowShell({ onPress, children }: BaseRowProps) {
  const theme = useTheme();
  const fill = resolveThemeColor(theme.glassFill, "rgba(70, 90, 129, 0.55)");
  const outline = resolveThemeColor(theme.glassOutline, "rgba(230, 235, 255, 0.12)");

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <XStack
        marginTop={10}
        padding={12}
        borderRadius={14}
        backgroundColor={fill}
        borderWidth={1}
        borderColor={outline}
        alignItems="center"
      >
        {children}
      </XStack>
    </TouchableOpacity>
  );
}

export function ArrowRight() {
  return (
    <Text color="$gradB" fontWeight="900">
      →
    </Text>
  );
}

/**
 * Vocab-style row: 3-column layout (left | centered arrow | right)
 */
export function VocabRow(props: {
  onPress?: () => void;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <RowShell onPress={props.onPress}>
      <YStack flex={1}>{props.left}</YStack>

      <YStack width={28} alignItems="center">
        <ArrowRight />
      </YStack>

      <YStack flex={1} alignItems="flex-end">
        {props.right}
      </YStack>
    </RowShell>
  );
}

/**
 * Stacked row: title + subtitle (2-line content)
 * Used for grammar, longer summaries, etc.
 */
export function StackRow(props: {
  onPress?: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <RowShell onPress={props.onPress}>
      <YStack flex={1}>
        {props.title}
        {props.subtitle ? <YStack marginTop={4}>{props.subtitle}</YStack> : null}
      </YStack>
    </RowShell>
  );
}
