import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/screen";
import { useAppState } from "../../state/AppState";

export default function Home() {
  const router = useRouter();
  const { languages, activeLanguageId, session, startSession } = useAppState();
  const lang = languages.find((l) => l.id === activeLanguageId);

  return (
    <Screen>
      <Text style={styles.h1}>Home</Text>
      <Text style={styles.sub}>Active Language: {lang ? lang.name : "None"}</Text>

      <View style={{ gap: 12, marginTop: 18 }}>
        {session ? (
          <TouchableOpacity style={styles.card} onPress={() => router.push("/(app)/session/concept")}>
            <Text style={styles.cardTitle}>Continue Session</Text>
            <Text style={styles.cardMeta}>{session.type} • step {session.practiceIndex + 1}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                startSession("learn");
                router.push("/(app)/session/setup");
              }}
            >
              <Text style={styles.cardTitle}>Start Learning</Text>
              <Text style={styles.cardMeta}>New concepts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                startSession("review");
                router.push("/(app)/session/setup");
              }}
            >
              <Text style={styles.cardTitle}>Review</Text>
              <Text style={styles.cardMeta}>Spaced repetition</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#E6EBFF", fontSize: 26, fontWeight: "900" },
  sub: { color: "#9BA3B4", marginTop: 6 },
  card: { backgroundColor: "#121A2A", borderWidth: 1, borderColor: "#1E2A44", borderRadius: 14, padding: 14 },
  cardTitle: { color: "#E6EBFF", fontSize: 16, fontWeight: "800" },
  cardMeta: { color: "#7A8194", marginTop: 4 },
});
