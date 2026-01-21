import React from "react";
import { XStack, Input } from "tamagui";
import { Search } from "@tamagui/lucide-icons";

type Props = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
};

export function SearchInput({ value, onChange, placeholder }: Props) {
  return (
    <XStack
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$4"
      backgroundColor="$color2"
      borderWidth={1}
      borderColor="$borderColor"
    >
      <Search size={16} color="$color10" />
      <Input
        flex={1}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? "Search"}
        autoCorrect={false}
        autoCapitalize="none"
        backgroundColor="transparent"
        borderWidth={0}
      />
    </XStack>
  );
}
