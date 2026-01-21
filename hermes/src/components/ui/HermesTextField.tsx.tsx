import React, { forwardRef } from "react";
import { Input, Text, XStack, YStack } from "tamagui";
import { Platform } from "react-native";

type Props = {
  label?: string;
  required?: boolean;

  value: string;
  onChangeText: (v: string) => void;

  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;

  multiline?: boolean;
  minHeight?: number;

  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;

  onBlur?: () => void;
};

export const HermesTextField = forwardRef<any, Props>(function HermesTextField(
  {
    label,
    required,
    value,
    onChangeText,
    placeholder,
    autoCapitalize = "none",
    autoCorrect = false,
    multiline = false,
    minHeight,
    leftIcon,
    rightIcon,
    onBlur,
  },
  ref
) {
  const height = multiline ? minHeight ?? 96 : 44;

  return (
    <YStack gap="$2">
      {label ? (
        <Text color="$color11">
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}

      <XStack
        alignItems={multiline ? "flex-start" : "center"}
        gap="$2"
        paddingHorizontal="$3"
        paddingVertical={multiline ? "$2" : 0}
        height={height}
        borderRadius="$6"
        backgroundColor="$background"
        borderWidth={1}
        borderColor="$glassOutline"
      >
        {leftIcon ? <XStack alignItems="center">{leftIcon}</XStack> : null}

        <Input
          ref={ref}
          flex={1}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          autoCorrect={autoCorrect}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          backgroundColor="transparent"
          borderWidth={0}
          padding={0}
          fontSize="$4"
          color="$color"
          onBlur={onBlur}
          // Android sometimes needs this to feel consistent with your header search
          lineHeight={Platform.OS === "android" ? 20 : undefined}
        />

        {rightIcon ? <XStack alignItems="center">{rightIcon}</XStack> : null}
      </XStack>
    </YStack>
  );
});
