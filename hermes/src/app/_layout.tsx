// ✅ corrected RootLayout: provider always mounts, UI gates on dbReady/dbError

import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Slot, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { Alert, View, Text, Button, Appearance } from "react-native";

import { TamaguiProvider, Theme } from "tamagui";
import tamaguiConfig from "../../tamagui.config";

import { registerPracticeItems } from "../../shared/domain/practice/registerPracticeItems";
import { AppStateProvider } from "@/state/AppState";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SQLiteProvider } from "expo-sqlite";
import { initDb } from "@/db/index";

SplashScreen.preventAutoHideAsync().catch(() => {});

const DB_NAME = "hermes.db";

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [dbInitAttempt, setDbInitAttempt] = useState(0);

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

  useEffect(() => {
    if (!dbError) return;

    Alert.alert(
      "Database initialization failed",
      dbError,
      [
        {
          text: "Retry",
          onPress: () => {
            setDbError(null);
            setDbReady(false);
            SplashScreen.preventAutoHideAsync().catch(() => {});
            setDbInitAttempt((x) => x + 1); 
          },
        },
      ],
      { cancelable: false }
    );
  }, [dbError]);

  const showApp = dbReady && !dbError;

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig}>
        <Theme name="dark">
          <ThemeProvider value={DarkTheme}>
            <SQLiteProvider
              key={`sqlite-${dbInitAttempt}`}
              databaseName={DB_NAME}
              onInit={async (db) => {
                try {
                  registerPracticeItems();
                  await initDb(db);
                  console.log("DB init successful");
                  setDbReady(true);
                } catch (err: any) {
                  console.error("DB init failed", err);
                  const msg =
                    err?.message ??
                    (typeof err === "string"
                      ? err
                      : "Unknown DB initialization error");
                  setDbError(msg);
                }
              }}
            >
              {showApp ? (
                <AppStateProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(app)" />
                    <Stack.Screen name="(modals)" options={{ presentation: "modal" }} />
                  </Stack>
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
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    marginBottom: 12,
                  }}
                >
                  Can’t start the app
                </Text>
                <Text style={{ textAlign: "center", marginBottom: 16 }}>
                  The local database failed to initialize.
                </Text>
                <Button
                  title="Retry DB init"
                  onPress={() => {
                    setDbError(null);
                    setDbReady(false);
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
