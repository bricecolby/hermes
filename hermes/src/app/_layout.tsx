import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useRef } from "react";
import "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { View, Text, Button, Appearance } from "react-native";

import { TamaguiProvider, Theme } from "tamagui";
import tamaguiConfig from "../../tamagui.config";

import { registerPracticeItems } from "../../shared/domain/practice/registerPracticeItems";
import { AppStateProvider } from "@/state/AppState";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SQLiteProvider } from "expo-sqlite";
import { initDb } from "@/db/index";

import { LlmClient } from "shared/services/llm/LlmClient";

SplashScreen.preventAutoHideAsync().catch(() => {});

const DB_NAME = "hermes.db";

LlmClient.configureBundledModel(
  require("../assets/llm/qwen2.5-0.5b-instruct-q5_k_m.gguf")
);

registerPracticeItems();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbInitAttempt, setDbInitAttempt] = useState(0);

  const initStartedRef = useRef(false);

  useEffect(() => {
    try {
      Appearance.setColorScheme?.("dark");
    } catch {}
  }, []);

  useEffect(() => {
    if (dbReady || dbError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [dbReady, dbError]);

  const showRoutes = dbReady && !dbError;

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig}>
        <Theme name="dark">
          <ThemeProvider value={DarkTheme}>
            <SQLiteProvider
              key={`sqlite-${dbInitAttempt}`}
              databaseName={DB_NAME}
              onInit={async (db) => {
                if (initStartedRef.current) return;
                initStartedRef.current = true;

                try {
                  await initDb(db);
                  console.log("DB init successful");
                  setDbReady(true);
                  setDbError(null);
                } catch (err: any) {
                  console.error("DB init failed", err);
                  initStartedRef.current = false; // allow retry
                  const msg =
                    err?.message ??
                    (typeof err === "string" ? err : "Unknown DB initialization error");
                  setDbError(msg);
                  setDbReady(false);
                }
              }}
            >
              {showRoutes ? (
                <AppStateProvider>
                  {/* IMPORTANT: let expo-router include index + onboarding */}
                  <Stack screenOptions={{ headerShown: false }} />
                </AppStateProvider>
              ) : null}
            </SQLiteProvider>

            {dbError ? (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
                  Can’t start the app
                </Text>
                <Text style={{ textAlign: "center", marginBottom: 16 }}>
                  The local database failed to initialize.
                  {"\n\n"}
                  {dbError}
                </Text>
                <Button
                  title="Retry DB init"
                  onPress={() => {
                    setDbError(null);
                    setDbReady(false);
                    initStartedRef.current = false;
                    SplashScreen.preventAutoHideAsync().catch(() => {});
                    setDbInitAttempt((x) => x + 1);
                  }}
                />
              </View>
            ) : null}

            <StatusBar style="light" />
          </ThemeProvider>
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
