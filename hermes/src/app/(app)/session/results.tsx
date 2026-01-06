import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/ui/screen";
import { useAppState } from "../../../state/AppState";

export default function Results() {
  const router = useRouter();
  const { endSession } = useAppState();

  return (
    <Screen>
      <Text style={styles.h1}>Results</Text>
      <Text style={styles.sub}>XP: +10 (stub)</Text>

      <TouchableOpacity
        style={styles.cta}
        onPress={() => {
          endSession();
          router.replace("/(app)/home");
        }}
      >
        <Text style={styles.ctaText}>Back to Home</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#E6EBFF", fontSize: 24, fontWeight: "900" },
  sub: { color: "#9BA3B4", marginTop: 6 },
  cta: { marginTop: 18, backgroundColor: "#1E2A44", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#E6EBFF", fontWeight: "900" },
});
