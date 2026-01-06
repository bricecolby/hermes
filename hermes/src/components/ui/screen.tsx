import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1220" },
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
});
