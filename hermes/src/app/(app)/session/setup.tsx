import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";

import { Screen } from "../../../components/ui/Screen";
import { useAppState } from "../../../state/AppState";
import { listLanguageProfilesForUsername, type LanguageProfileRow } from "../../../db/queries/users";

const DB_NAME = "hermes.db";
const MVP_USERNAME = "default";

export default function SessionSetup() {
  const router = useRouter();
  const { session, activeProfileId, activeLanguageId } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      const rows = await listLanguageProfilesForUsername(db, MVP_USERNAME);
      setProfiles(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.userId === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  const canStart = !!session && !!activeLanguageId;

  return (
    <Screen>
      <Text style={styles.h1}>Ready to Practice?</Text>

      {loading ? (
        <View style={{ marginTop: 14, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Profile</Text>
          <Text style={styles.value}>
            {activeProfile ? `${activeProfile.learningName} (${activeProfile.learningCode})` : "None"}
          </Text>

          <Text style={styles.label}>Mode</Text>
          <Text style={styles.value}>{session?.type ?? "none"}</Text>

          <Text style={styles.label}>Session length</Text>
          <Text style={styles.value}>~{session?.practiceItemIds.length ?? 0} questions</Text>

          {!!activeLanguageId ? (
            <Text style={styles.debug}>activeLanguageId: {activeLanguageId}</Text>
          ) : null}
        </View>
      )}

      <TouchableOpacity
        style={[styles.cta, !canStart && { opacity: 0.5 }]}
        disabled={!canStart}
        onPress={() => router.replace("/(app)/session/concept")}
      >
        <Text style={styles.ctaText}>Start Session</Text>
      </TouchableOpacity>

      {!activeLanguageId ? <Text style={styles.sub}>Pick a language first on Home.</Text> : null}
      {!session ? <Text style={styles.sub}>No active session. Go back and tap Start Learning/Review.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#E6EBFF", fontSize: 24, fontWeight: "900" },
  sub: { color: "#9BA3B4", marginTop: 10 },

  card: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },

  label: { color: "#9BA3B4", fontSize: 13 },
  value: { color: "#E6EBFF", fontSize: 16, fontWeight: "700" },
  debug: { color: "#6B7280", marginTop: 6, fontSize: 12 },

  cta: {
    marginTop: 18,
    backgroundColor: "#1971FF",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaText: { color: "#06101C", fontWeight: "900", fontSize: 15 },
});
