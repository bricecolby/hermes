import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { useAppState } from "../../state/AppState";

export default function Settings() {
  const router = useRouter();
  const { setActiveLanguage } = useAppState();

  return (
    <Screen>
      <Text style={{ color: "#E6EBFF", fontSize: 22, fontWeight: "900" }}>Settings (stub)</Text>

      <TouchableOpacity
        style={{ marginTop: 18 }}
        onPress={async () => {
          await setActiveLanguage(null);
          router.replace("./(onboarding)/profile");
        }}
      >
        <Text style={{ color: "#9BA3B4" }}>Switch language (back to profile)</Text>
      </TouchableOpacity>
    </Screen>
  );
}
