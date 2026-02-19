import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as SQLite from "expo-sqlite";

import { Screen } from "../../components/ui/Screen";
import { HermesButton } from "@/components/ui/HermesButton";
import {
  deleteLanguagePack,
  installOrUpdateLanguagePack,
  listManagedLanguagePacks,
  type ManagedLanguagePack,
} from "@/services/languagePackManager";

const MVP_USERNAME = "default";

export default function AddLanguage() {
  const router = useRouter();
  const db = SQLite.useSQLiteContext();

  const [packs, setPacks] = useState<ManagedLanguagePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const rows = await listManagedLanguagePacks(db, MVP_USERNAME);
      setPacks(rows);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load language packs");
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const onDownloadOrUpdate = async (pack: ManagedLanguagePack) => {
    if (busyCode) return;
    setBusyCode(pack.code);
    try {
      await installOrUpdateLanguagePack(db, MVP_USERNAME, pack.code);
      await load();
    } catch (e: any) {
      Alert.alert("Pack operation failed", e?.message ?? "Could not install/update this language pack.");
    } finally {
      setBusyCode(null);
    }
  };

  const onDelete = (pack: ManagedLanguagePack) => {
    if (busyCode) return;
    Alert.alert(
      `Delete ${pack.name} pack?`,
      "This removes downloaded vocab/grammar content and profiles for this language on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusyCode(pack.code);
            try {
              await deleteLanguagePack(db, MVP_USERNAME, pack.code);
              await load();
            } catch (e: any) {
              Alert.alert("Delete failed", e?.message ?? "Could not delete this language pack.");
            } finally {
              setBusyCode(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Add Language</Text>
        <Text style={styles.sub}>Download or update supported language packs.</Text>
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
          keyExtractor={(x) => x.code}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.cardInner}>
              <Text style={styles.cardTitle}>
                {item.name} ({item.code})
              </Text>
              <Text style={styles.cardMeta}>
                Native: {item.nativeName} ({item.nativeCode})
              </Text>
              <Text style={styles.cardMeta}>
                {item.installed ? "Installed" : "Not installed"} • vocab {item.vocabItems} • grammar {item.grammarPoints}
              </Text>
              <Text style={styles.cardMeta}>
                Profile: {item.hasProfile ? "ready" : "not created"}
              </Text>

              <View style={styles.actionsRow}>
                <HermesButton
                  label={busyCode === item.code ? "Working…" : item.installed ? "Update Pack" : "Download Pack"}
                  variant="primary"
                  onPress={() => onDownloadOrUpdate(item)}
                  disabled={busyCode != null}
                  marginTop={0}
                  size="sm"
                />
                {item.installed ? (
                  <HermesButton
                    label="Delete Pack"
                    variant="secondary"
                    onPress={() => onDelete(item)}
                    disabled={busyCode != null}
                    marginTop={0}
                    size="sm"
                  />
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centerBlock}>
              <Text style={styles.mutedText}>
                No language packs available.
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

  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
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
