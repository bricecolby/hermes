import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";
import { LinearGradient } from "expo-linear-gradient";

import { Screen } from "../../components/ui/Screen";
import {
  listLanguagePacksNotOwnedByUsername,
  type LanguagePackRow,
} from "../../db/queries/languages";
import { createUserProfileForLanguagePack } from "../../db/queries/users";

const DB_NAME = "hermes.db";
const MVP_USERNAME = "default";

export default function AddLanguage() {
  const router = useRouter();

  const [packs, setPacks] = useState<LanguagePackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const db = await SQLite.openDatabaseAsync(DB_NAME);
      const rows = await listLanguagePacksNotOwnedByUsername(db, MVP_USERNAME);

      setPacks(rows);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load language packs");
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onPick = async (packId: number) => {
    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await createUserProfileForLanguagePack(db, MVP_USERNAME, packId);
      router.back();
    } catch (e: any) {
      // If it already exists (race condition), just go back.
      const msg = String(e?.message ?? "").toLowerCase();
      if (msg.includes("unique")) {
        router.back();
        return;
      }
      setErr(e?.message ?? "Failed to add language");
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Add Language</Text>
        <Text style={styles.sub}>Pick a supported language pack.</Text>
      </View>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator />
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      ) : err ? (
        <View style={styles.centerBlock}>
          <Text style={styles.mutedText}>{err}</Text>
        </View>
      ) : (
        <FlatList
          data={packs}
          keyExtractor={(x) => String(x.packId)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.9} onPress={() => onPick(item.packId)}>
              {/* Gradient border (only used on selectable pack cards here) */}
              <LinearGradient
                colors={["#1971FF", "#1EE6A8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardBorder}
              >
                {/* Muted glass interior */}
                <View style={styles.cardInner}>
                  <Text style={styles.cardTitle}>
                    {item.targetName} ({item.targetCode})
                  </Text>
                  <Text style={styles.cardMeta}>
                    Native: {item.nativeName} ({item.nativeCode})
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.centerBlock}>
              <Text style={styles.mutedText}>
                No additional language packs available.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.9} style={styles.cancelWrap}>
        <Text style={styles.cancel}>Cancel</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  title: {
    color: "#E6EBFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  sub: {
    color: "#7A8194",
  },

  listContent: {
    paddingTop: 10,
    paddingBottom: 10,
    gap: 12,
  },

  centerBlock: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  mutedText: {
    color: "#7A8194",
    marginTop: 10,
    textAlign: "center",
  },

  cardBorder: {
    borderRadius: 16,
    padding: 1.6,
  },

  cardInner: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(18, 26, 42, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(230, 235, 255, 0.10)",
  },

  cardTitle: {
    color: "#E6EBFF",
    fontSize: 16,
    fontWeight: "800",
  },

  cardMeta: {
    color: "rgba(230, 235, 255, 0.55)",
    marginTop: 6,
  },

  cancelWrap: {
    marginTop: 14,
    paddingVertical: 10,
  },

  cancel: {
    color: "#7A8194",
    textAlign: "center",
    fontWeight: "700",
  },
});
