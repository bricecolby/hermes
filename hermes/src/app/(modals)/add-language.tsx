import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/screen";
import { useAppState } from "../../state/AppState";

export default function AddLanguage() {
  const router = useRouter();
  const { addLanguage } = useAppState();
  const [name, setName] = useState("Russian");
  const [code, setCode] = useState("ru");

  const onSave = async () => {
    await addLanguage({ name, code });
    router.back();
  };

  return (
    <Screen>
      <Text style={styles.title}>Add Language</Text>

      <Text style={styles.label}>Language Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Russian" placeholderTextColor="#7A8194" />

      <Text style={styles.label}>Language Code</Text>
      <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="ru" placeholderTextColor="#7A8194" />

      <TouchableOpacity style={styles.cta} onPress={onSave}>
        <Text style={styles.ctaText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.cancel}>Cancel</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: "#E6EBFF", fontSize: 22, fontWeight: "900", marginBottom: 18 },
  label: { color: "#C5CCDB", fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#121A2A",
    borderWidth: 1,
    borderColor: "#1E2A44",
    color: "#E6EBFF",
  },
  cta: { marginTop: 18, backgroundColor: "#1971FF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#06101C", fontWeight: "900" },
  cancel: { color: "#7A8194", textAlign: "center", marginTop: 14 },
});
