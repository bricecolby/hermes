// src/app/(app)/vocab/_layout.tsx
import React from "react";
import { Stack } from "expo-router";

export default function VocabStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
