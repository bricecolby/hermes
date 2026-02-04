import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { Stack, useRouter, Link } from "expo-router";
import * as SQLite from "expo-sqlite";

import { YStack, Text, ScrollView } from "tamagui";

import { Screen } from "../../components/ui/Screen";
import { AppHeader } from "../../components/ui/AppHeader";
import { ActionCard } from "../../components/ui/ActionCard";
import { useAppState } from "../../state/AppState";
import { listLanguageProfilesForUsername, type LanguageProfileRow } from "../../db/queries/users";
import { CefrProgressWidget } from "@/components/ui/CefrProgressWidget";
import { useFocusEffect } from "@react-navigation/native";
import { ReviewForecast } from "@/components/ui/ReviewForecast";

const MVP_USERNAME = "default";

export default function Home() {
  const router = useRouter();
  const { activeProfileId, activeLanguageId, session, startSession } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const db = SQLite.useSQLiteContext();

  const [cefrNonce, setCefrNonce] = useState(0);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await listLanguageProfilesForUsername(db, MVP_USERNAME);
      setProfiles(rows);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useFocusEffect(
    useCallback(() => {
      setCefrNonce((n) => n + 1);
      loadProfiles();
    }, [loadProfiles])
  );


  useEffect(() => {
    if (!activeProfileId) router.replace("/(onboarding)/profile");
  }, [activeProfileId, router]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView>
        <YStack paddingTop={6}>
          <AppHeader title="Home" />

          {!loading && activeProfileId ? (
            <>
              <YStack gap={16} marginTop={6}>
                <CefrProgressWidget
                  db={db}
                  userId={activeProfileId}
                  languageId={activeLanguageId ?? null}
                  modelKey="ema_v1"
                  refreshNonce={cefrNonce}
                />

                <ReviewForecast
                  userId={activeProfileId}
                  daysToShow={14}
                  modelKey="ema_v1"
                />
              </YStack>

            </>
          ) : null}

          <YStack marginTop={18} gap={12}>
            {session ? (
              <ActionCard
                title="Continue Session"
                subtitle={`${session.type} • step ${session.practiceIndex + 1}`}
                onPress={() => router.push("/(app)/session/concept")}
              />
            ) : (
              <>
                <ActionCard
                  title="Memorize"
                  subtitle="Vocab and Grammar"
                  disabled={!activeLanguageId}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/memorize",
                      params: { run: String(Date.now()) },
                    })
                  }
                />

                <ActionCard
                  title="Practice"
                  subtitle="New concepts"
                  disabled={!activeLanguageId}
                  onPress={() => {
                    startSession("learn");
                    router.push("/(app)/session/setup");
                  }}
                />

                <ActionCard
                  title="Review"
                  subtitle="Spaced repetition"
                  disabled={!activeLanguageId}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/review",
                      params: { run: String(Date.now()) },
                    })
                  }
                />

                <ActionCard
                  title="Switch Profile"
                  subtitle="Choose a different language pack"
                  onPress={() => router.push("/(onboarding)/profile")}
                />
              </>
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </Screen>
  );
}
