import React, { useMemo, useState } from "react";
import { Pressable } from "react-native";
import { Input, Text, XStack, YStack, useTheme } from "tamagui";
import { X } from "@tamagui/lucide-icons";

type Props = {
  label?: string;
  tags: string[];
  onTagsChange: (next: string[]) => void;
  placeholder?: string;
};

function normalizeTag(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export function HermesTagInput({ label, tags, onTagsChange, placeholder }: Props) {
  const theme = useTheme();
  const fill = String(theme.glassFill?.val ?? "rgba(70, 90, 129, 0.55)");
  const outline = String(theme.glassOutline?.val ?? "rgba(230, 235, 255, 0.12)");

  const [draft, setDraft] = useState("");

  const tagSet = useMemo(() => new Set(tags.map((t) => t.toLowerCase())), [tags]);

  const commit = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return;
    if (tagSet.has(t.toLowerCase())) return;
    onTagsChange([...tags, t]);
  };

  const commitFromDraft = () => {
    if (!draft.trim()) return;
    commit(draft);
    setDraft("");
  };

  const handleChange = (text: string) => {
    const parts = text.split(/[\s,\n]+/g);
    if (parts.length <= 1) {
      setDraft(text);
      return;
    }

    const toCommit = parts.slice(0, -1).map(normalizeTag).filter(Boolean);
    const remainder = parts[parts.length - 1]; 

    if (toCommit.length) {
      let next = tags;
      const nextSet = new Set(next.map((t) => t.toLowerCase()));
      for (const t of toCommit) {
        if (!nextSet.has(t.toLowerCase())) {
          next = [...next, t];
          nextSet.add(t.toLowerCase());
        }
      }
      onTagsChange(next);
    }

    setDraft(remainder);
  };

  const removeAt = (idx: number) => {
    const next = tags.slice(0, idx).concat(tags.slice(idx + 1));
    onTagsChange(next);
  };

  const onKeyPress = (e: any) => {
    const key = e?.nativeEvent?.key;
    if (key === "Backspace" && !draft) {
      // remove last chip
      if (tags.length) onTagsChange(tags.slice(0, -1));
    }
    if (key === "Enter") {
      commitFromDraft();
    }
  };

  return (
    <YStack gap="$2">
      {label ? <Text color="$color11">{label}</Text> : null}

      <XStack
        flexWrap="wrap"
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius="$6"
        backgroundColor="$background"
        borderWidth={1}
        borderColor="$glassOutline"
      >
        {tags.map((t, idx) => (
          <XStack
            key={`${t}-${idx}`}
            alignItems="center"
            gap="$1"
            paddingVertical="$1"
            paddingHorizontal="$2"
            borderRadius="$10"
            backgroundColor={fill}
            borderWidth={1}
            borderColor={outline}
          >
            <Text color="$color" fontSize="$3" numberOfLines={1}>
              {t}
            </Text>
            <Pressable onPress={() => removeAt(idx)} hitSlop={8}>
              <X size={14} color="$color11" />
            </Pressable>
          </XStack>
        ))}

        <Input
          value={draft}
          onChangeText={handleChange}
          onKeyPress={onKeyPress}
          onSubmitEditing={commitFromDraft}
          placeholder={placeholder ?? "Add tags…"}
          autoCorrect={false}
          autoCapitalize="none"
          backgroundColor="transparent"
          borderWidth={0}
          padding={0}
          fontSize="$4"
          color="$color"
          flexGrow={1}
          flexShrink={1}
          minWidth={120}
          returnKeyType="done"
          blurOnSubmit={false}
        />
      </XStack>
    </YStack>
  );
}
