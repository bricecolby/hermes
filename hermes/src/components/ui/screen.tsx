// src/components/ui/Screen.tsx
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({
  children,
  noPad = false,
  backgroundColor = "#06101C",
}: {
  children: React.ReactNode;
  noPad?: boolean;
  backgroundColor?: string;
}) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <View style={[styles.inner, noPad && styles.noPad]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 20 },
  noPad: { paddingHorizontal: 0 },
});