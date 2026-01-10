import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { Alert, View, Text, Button, Appearance } from 'react-native';

import { TamaguiProvider, Theme } from 'tamagui';
import tamaguiConfig from '../../tamagui.config'; // adjust path if needed

import { registerPracticeItems } from '../../shared/domain/practice/registerPracticeItems';
import { initDb } from '@/db';
import { AppStateProvider } from '@/state/AppState';

import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Force dark mode globally
  useEffect(() => {
    try {
      // Some RN versions support this; if not, it just won't exist / won't apply.
      Appearance.setColorScheme?.('dark');
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        registerPracticeItems();
        await initDb();
        console.log('DB init successful');
        setDbReady(true);
      } catch (err: any) {
        console.error('DB init failed', err);
        const msg =
          err?.message ??
          (typeof err === 'string' ? err : 'Unknown DB initialization error');
        setDbError(msg);
      }
    })();
  }, []);

  useEffect(() => {
    if (dbReady || dbError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [dbReady, dbError]);

  useEffect(() => {
    if (!dbError) return;

    Alert.alert(
      'Database initialization failed',
      dbError,
      [
        {
          text: 'Retry',
          onPress: async () => {
            setDbError(null);
            SplashScreen.preventAutoHideAsync().catch(() => {});
            try {
              registerPracticeItems();
              await initDb();
              setDbReady(true);
            } catch (err: any) {
              const msg =
                err?.message ??
                (typeof err === 'string'
                  ? err
                  : 'Unknown DB initialization error');
              setDbError(msg);
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, [dbError]);

  if (!dbReady && !dbError) return null;

  if (dbError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
          Can’t start the app
        </Text>
        <Text style={{ textAlign: 'center', marginBottom: 16 }}>
          The local database failed to initialize.
        </Text>
        <Button
          title="Retry DB init"
          onPress={async () => {
            setDbError(null);
            SplashScreen.preventAutoHideAsync().catch(() => {});
            try {
              registerPracticeItems();
              await initDb();
              setDbReady(true);
            } catch (err: any) {
              const msg =
                err?.message ??
                (typeof err === 'string'
                  ? err
                  : 'Unknown DB initialization error');
              setDbError(msg);
            }
          }}
        />
      </View>
    );
  }

  // ✅ Always dark mode
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={tamaguiConfig}>
        <Theme name="dark">
          <ThemeProvider value={DarkTheme}>
            <AppStateProvider>
              <Slot />
            </AppStateProvider>
            <StatusBar style="light" />
          </ThemeProvider>
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
