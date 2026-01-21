import React, { useEffect, useRef } from "react";
import { Pressable } from "react-native";
import { XStack, Input } from "tamagui";
import { Search, X } from "@tamagui/lucide-icons";
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from "react-native-reanimated";

type Props = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HeaderSearchOverlay({
  value,
  onChange,
  placeholder,
  open,
  onOpenChange,
}: Props) {
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus?.());
  }, [open]);

  if (!open) {
    return (
      <Pressable onPress={() => onOpenChange(true)} hitSlop={12}>
        <Search size={20} color="$color4" />
      </Pressable>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
        <XStack
          alignItems="center"
          justifyContent="center"
          height={44}
          width="100%"
        >
          <XStack
            alignItems="center"
            gap="$2"
            paddingHorizontal="$3"
            height={34}              
            borderRadius="$6"
            backgroundColor="$background" 
            borderWidth={1}
            borderColor="$glassOutline"
            width="82%"
            maxWidth={320}
          >
            <Search size={14} color="$color4" />

            <Input
              ref={inputRef}
              flex={1}
              value={value}
              onChangeText={onChange}
              placeholder={placeholder ?? "Search"}
              autoCorrect={false}
              autoCapitalize="none"
              backgroundColor="transparent"
              borderWidth={0}
              padding={0}
              fontSize="$4"
              color="$color"
              onBlur={() => onOpenChange(false)}
            />

            <Pressable
              onPress={() => {
                if (value) onChange("");
                else onOpenChange(false);
              }}
              hitSlop={8}
            >
              <X size={16} color="$color4" />
            </Pressable>
          </XStack>
        </XStack>
    </Animated.View>
  );
}
