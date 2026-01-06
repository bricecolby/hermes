import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAppState } from "@/state/AppState";

export default function Profile() {
  const router = useRouter();
  const { languages, setActiveLanguage } = useAppState();

  const onSelect = async (id: string) => {
    await setActiveLanguage(id);
    router.replace("/(app)/home");
  };

  return (
    <LinearGradient colors={["#0B1220", "#0B1220"]} style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require("@/assets/images/1x/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>Hermes</Text>
        </View>

        <Text style={styles.tagline}>Pick a language to continue.</Text>

        {/* Language list */}
        <View style={styles.form}>
          {languages.length === 0 ? (
            <Text style={styles.empty}>No languages yet. Add one to get started.</Text>
          ) : (
            <FlatList
              data={languages}
              keyExtractor={(x) => x.id}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.card} onPress={() => onSelect(item.id)} activeOpacity={0.9}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity
            onPress={() => router.push("/(modals)/add-language")}
            activeOpacity={0.9}
            style={{ marginTop: 18 }}
          >
            <LinearGradient
              colors={["#1971FF", "#1EE6A8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Add Language</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} Hermes</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 24,
  },
  logoWrap: { alignItems: "center" },
  logo: { width: 128, height: 128, marginBottom: 8 },
  brand: { color: "#E6EBFF", fontSize: 28, fontWeight: "700", letterSpacing: 0.5 },
  tagline: { color: "#9BA3B4", fontSize: 14, marginTop: -32, textAlign: "center" },

  form: { width: "100%", marginTop: 8, flex: 1 },

  empty: { color: "#7A8194", textAlign: "center", marginTop: 20 },

  card: {
    backgroundColor: "#121A2A",
    borderWidth: 1,
    borderColor: "#1E2A44",
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: { color: "#E6EBFF", fontSize: 16, fontWeight: "700" },
  cardMeta: { color: "#7A8194", marginTop: 4 },

  cta: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1EE6A8",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaText: { color: "#06101C", fontSize: 16, fontWeight: "700" },

  footer: { color: "#5E6C8A", fontSize: 12 },
});
