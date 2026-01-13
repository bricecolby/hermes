// components/ui/Accordion.tsx
import React from "react";
import { TouchableOpacity } from "react-native";
import { ChevronDown } from "@tamagui/lucide-icons";
import { XStack, YStack, Text } from "tamagui";

type Props = {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;

  // Optional overrides (handy later)
  headerBg?: string;
  contentBg?: string;
};

export function HermesAccordion({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
  headerBg = "$glassFill",
  contentBg = "$background",
}: Props) {
  return (
    <YStack
      borderBottomWidth={1}
      borderColor="$borderColor"
    >
      {/* Header */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          alignItems="center"
          justifyContent="space-between"
          gap="$3"
          backgroundColor={headerBg}
        >
          <YStack flex={1} gap="$1">
            <Text fontSize="$7" fontWeight="800" color="$color">
              {title}
            </Text>
            {subtitle ? (
              <Text fontSize="$3" color="$color11">
                {subtitle}
              </Text>
            ) : null}
          </YStack>

          <YStack
            width={28}
            height={28}
            alignItems="center"
            justifyContent="center"
            borderRadius="$2"
          >
            <ChevronDown
              size={18}
              color={"#9BA3B4" as any}
              style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
            />
          </YStack>
        </XStack>
      </TouchableOpacity>

      {/* Content */}
      {expanded ? (
        <YStack backgroundColor={contentBg} paddingLeft="$3">
          {children}
        </YStack>
      ) : null}
    </YStack>
  );
}
