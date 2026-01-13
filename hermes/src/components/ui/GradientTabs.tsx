// src/components/ui/GradientTabs.tsx
import React from "react";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { XStack, YStack, Text, useTheme } from "tamagui";

type TabKey = string;

type Tab = {
  key: TabKey;
  label: string;
};

type Props = {
  tabs: Tab[];
  value: TabKey;
  onChange: (key: TabKey) => void;
};

const RADIUS = 12;
const BORDER_W = 1;

export function GradientTabs({ tabs, value, onChange }: Props) {
  const theme = useTheme();
  const gradA = theme.gradA?.val;
  const gradB = theme.gradB?.val;

  return (
    <XStack gap="$2">
      {tabs.map((t) => {
        const isSelected = t.key === value;

        return (
          <TouchableOpacity key={t.key} onPress={() => onChange(t.key)} activeOpacity={0.9}>
            {isSelected ? (
              <LinearGradient
                colors={[gradA, gradB]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: RADIUS,
                  padding: BORDER_W,
                }}
              >
                <YStack
                  paddingHorizontal="$4"
                  paddingVertical="$2"
                  borderRadius={RADIUS - BORDER_W}
                  backgroundColor="$glassFill"
                  borderWidth={1}
                  borderColor="$glassOutline"
                >
                  <Text fontWeight="800" color="$active">
                    {t.label}
                  </Text>
                </YStack>
              </LinearGradient>
            ) : (
              <YStack
                paddingHorizontal="$4"
                paddingVertical="$2"
                borderRadius={RADIUS}
                backgroundColor="transparent"
                borderWidth={1}
                borderColor="$glassOutline"
              >
                <Text fontWeight="700" color="$muted">
                  {t.label}
                </Text>
              </YStack>
            )}
          </TouchableOpacity>
        );
      })}
    </XStack>
  );
}
