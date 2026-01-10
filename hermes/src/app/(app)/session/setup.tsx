import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/ui/Screen";
import { useAppState } from "../../../state/AppState";

export default function SessionSetup() {
  const router = useRouter();
  const { session } = useAppState();

  return (
    <Screen>
      <Text style={styles.h1}>Session Setup</Text>
      <Text style={styles.sub}>Type: {session?.type ?? "none"}</Text>

      <TouchableOpacity style={styles.cta} onPress={() => router.replace("/(app)/session/concept")}>
        <Text style={styles.ctaText}>Start</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#E6EBFF", fontSize: 24, fontWeight: "900" },
  sub: { color: "#9BA3B4", marginTop: 6 },
  cta: { marginTop: 18, backgroundColor: "#1971FF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#06101C", fontWeight: "900" },
});
