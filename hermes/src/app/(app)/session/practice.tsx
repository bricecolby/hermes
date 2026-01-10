import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../../components/ui/Screen";
import { useAppState } from "../../../state/AppState";

export default function Practice() {
  const router = useRouter();
  const { session, advancePractice } = useAppState();

  const idx = session?.practiceIndex ?? 0;
  const total = session?.practiceItemIds.length ?? 0;
  const itemId = session?.practiceItemIds[idx] ?? "item_?";

  const onSubmitStub = () => {
    const next = idx + 1;
    if (!session) return;

    if (next >= total) {
      router.replace("/(app)/session/results");
      return;
    }

    advancePractice();
  };

  return (
    <Screen>
      <Text style={styles.h1}>Practice</Text>
      <Text style={styles.sub}>
        Item: {itemId} ({idx + 1}/{total})
      </Text>

      <View style={{ gap: 10, marginTop: 18 }}>
        <TouchableOpacity style={styles.btn} onPress={onSubmitStub}>
          <Text style={styles.btnText}>Submit (stub)</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { color: "#E6EBFF", fontSize: 24, fontWeight: "900" },
  sub: { color: "#9BA3B4", marginTop: 6 },
  btn: { backgroundColor: "#1971FF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#06101C", fontWeight: "900" },
});
