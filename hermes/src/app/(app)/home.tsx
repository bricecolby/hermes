import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";

import { Screen } from "../../components/ui/screen";
import { useAppState } from "../../state/AppState";
import { listLanguageProfilesForUsername, type LanguageProfileRow } from "../../db/queries/users";

const DB_NAME = "hermes.db";
const MVP_USERNAME = "default";

export default function Home() {
  const router = useRouter();
  const { activeProfileId, activeLanguageId, session, startSession } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load profiles so we can display the selected one (name/code)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const db = await SQLite.openDatabaseAsync(DB_NAME);
        const rows = await listLanguageProfilesForUsername(db, MVP_USERNAME);
        setProfiles(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.userId === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  // If nothing selected, send them back to profile screen
  useEffect(() => {
    if (!activeProfileId) router.replace("/(onboarding)/profile");
  }, [activeProfileId, router]);

  return (
    <Screen>
      <Text style={styles.h1}>Home</Text>

      {loading ? (
        <View style={{ marginTop: 10 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <Text style={styles.sub}>
          Active Profile:{" "}
          {activeProfile ? `${activeProfile.learningName} (${activeProfile.learningCode})` : "None"}
        </Text>
      )}

      {/* This can stay for debugging if you want */}
      {!!activeLanguageId && <Text style={styles.debug}>activeLanguageId: {activeLanguageId}</Text>}

      <View style={{ gap: 12, marginTop: 18 }}>
        {session ? (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push("/(app)/session/concept")}
          >
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
              disabled={!activeLanguageId}
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
              disabled={!activeLanguageId}
            >
              <Text style={styles.cardTitle}>Review</Text>
              <Text style={styles.cardMeta}>Spaced repetition</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, { opacity: 0.95 }]}
              onPress={() => router.push("/(onboarding)/profile")}
            >
              <Text style={styles.cardTitle}>Switch Profile</Text>
              <Text style={styles.cardMeta}>Choose a different language pack</Text>
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
  debug: { color: "#5E6C8A", marginTop: 8, fontSize: 12 },
  card: {
    backgroundColor: "#121A2A",
    borderWidth: 1,
    borderColor: "#1E2A44",
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: { color: "#E6EBFF", fontSize: 16, fontWeight: "800" },
  cardMeta: { color: "#7A8194", marginTop: 4 },
});
