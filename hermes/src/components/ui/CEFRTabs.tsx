// src/components/ui/CEFRTabs.tsx
import React, { useMemo } from "react";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { XStack, YStack, Text, ScrollView, useTheme } from "tamagui";

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

type Props = {
  value: CefrLevel;
  onChange: (lvl: CefrLevel) => void;
};

const TAB_W = 60;
const TAB_H = 52;
const RADIUS = 12;
const SELECTED_BORDER_W = 1;

export function CEFRTabs({ value, onChange }: Props) {
  const theme = useTheme();

  const gradA = theme.gradA?.val;
  const gradB = theme.gradB?.val;

  const selectedIdx = useMemo(() => LEVELS.indexOf(value), [value]);

  const spread = 60;
  const underlineLeft = Math.max(0, selectedIdx * (TAB_W - 1) - spread);
  const underlineWidth = TAB_W + spread * 2;

  return (
    <YStack>
      <YStack position="relative">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          <XStack gap={0} alignItems="flex-end">
            {LEVELS.map((lvl, idx) => {
              const isSelected = lvl === value;

              return (
                <TouchableOpacity
                  key={lvl}
                  onPress={() => onChange(lvl)}
                  activeOpacity={0.9}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={[gradA, gradB]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: TAB_W,
                        height: TAB_H,
                        borderTopLeftRadius: RADIUS,
                        borderTopRightRadius: RADIUS,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                        padding: SELECTED_BORDER_W,
                        marginLeft: idx === 0 ? 0 : -1,
                      }}
                    >
                      <XStack
                        flex={1}
                        alignItems="center"
                        justifyContent="center"
                        backgroundColor={"$glassFill"}
                        borderTopLeftRadius={RADIUS - SELECTED_BORDER_W}
                        borderTopRightRadius={RADIUS - SELECTED_BORDER_W}
                        borderBottomLeftRadius={0}
                        borderBottomRightRadius={0}

                        borderWidth={1}
                        borderColor={"$glassOutline"}
                      >
                        <Text fontSize="$4" fontWeight="800" color={"$active"}>
                          {lvl}
                        </Text>
                      </XStack>
                    </LinearGradient>
                  ) : (
                    <XStack
                      width={TAB_W}
                      height={TAB_H}
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor="transparent"
                      borderColor={"$glassOutline"}
                      borderWidth={1}
                      borderBottomWidth={1}
                      borderTopLeftRadius={RADIUS}
                      borderTopRightRadius={RADIUS}
                      marginLeft={idx === 0 ? 0 : -1}
                    >
                      <Text fontSize="$4" fontWeight="600" color={"$muted"}>
                        {lvl}
                      </Text>
                    </XStack>
                  )}
                </TouchableOpacity>
              );
            })}
          </XStack>
        </ScrollView>

        <XStack height={1} backgroundColor={"$outline"} />

        <YStack
          pointerEvents="none"
          position="absolute"
          left={12 + underlineLeft}
          bottom={0}
          width={underlineWidth}
          height={1}
        >
          <LinearGradient
            colors={["transparent", gradA, gradB, "transparent"]}
            locations={[0, 0.25, 0.75, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: "100%", height: "100%" }}
          />
        </YStack>
      </YStack>
    </YStack>
  );
}
