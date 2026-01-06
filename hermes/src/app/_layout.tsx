import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { Alert, View, Text, Button } from 'react-native';

import { registerPracticeItems } from '../../shared/domain/practice/registerPracticeItems';
import { initDb } from '@/db';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { AppStateProvider } from '@/state/AppState';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

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

  // Keep splash while initializing
  if (!dbReady && !dbError) return null;

  // Hard stop UI if DB failed
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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStateProvider>
        <Slot />
      </AppStateProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
