import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

export default function Index() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const handleSignIn = () => {
    console.log({ email, pw });
    alert("Signed in (stub)!");
  };

  return (
    <LinearGradient colors={["#0B1220", "#0B1220"]} style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.inner}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require("@/assets/images/1x/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>Hermes</Text>
        </View>

        <Text style={styles.tagline}>Learn faster, speak smarter.</Text>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#7A8194"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#7A8194"
            secureTextEntry
            value={pw}
            onChangeText={setPw}
          />

          <TouchableOpacity onPress={handleSignIn} activeOpacity={0.9} style={{ marginTop: 18 }}>
            <LinearGradient
              colors={["#1971FF", "#1EE6A8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.secondary}>Forgot password?</Text>
            <Text style={styles.bullet}> • </Text>
            <Text style={styles.secondary}>Create account</Text>
          </View>
        </View>

        <Text style={styles.footer}>© {new Date().getFullYear()} Hermes</Text>
      </KeyboardAvoidingView>
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
    paddingBottom: 24
  },
  logoWrap: { alignItems: "center" },
  logo: { width: 128, height: 128, marginBottom: 8 },
  brand: {
    color: "#E6EBFF",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  tagline: {
    color: "#9BA3B4",
    fontSize: 14,
    marginTop: -32,
    textAlign: "center"
  },
  form: { width: "100%", marginTop: 8 },
  label: { color: "#C5CCDB", fontSize: 12, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#121A2A",
    borderWidth: 1,
    borderColor: "#1E2A44",
    color: "#E6EBFF"
  },
  cta: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1EE6A8",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }
  },
  ctaText: { color: "#06101C", fontSize: 16, fontWeight: "700" },
  row: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  secondary: { color: "#7A8194" },
  bullet: { color: "#2C354E" },
  footer: { color: "#5E6C8A", fontSize: 12 }
});
