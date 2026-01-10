import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/ui/Screen";
import { useAppState } from "../../../state/AppState";

export default function Concept() {
  const router = useRouter();
  const { session } = useAppState();

  const conceptId = session?.conceptIds[0] ?? "concept_?";

  return (
    <Screen>
      <Text style={styles.h1}>Concept Overview</Text>
      <Text style={styles.sub}>Concept: {conceptId}</Text>

      <TouchableOpacity style={styles.cta} onPress={() => router.push("/(app)/session/practice")}>
        <Text style={styles.ctaText}>Practice</Text>
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
