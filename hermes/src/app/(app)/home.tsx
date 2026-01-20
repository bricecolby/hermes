import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { Stack, useRouter, Link } from "expo-router";
import * as SQLite from "expo-sqlite";

import { YStack, Text } from "tamagui";

import { Screen } from "../../components/ui/Screen";
import { AppHeader } from "../../components/ui/AppHeader";
import { ActionCard } from "../../components/ui/ActionCard";
import { useAppState } from "../../state/AppState";
import { listLanguageProfilesForUsername, type LanguageProfileRow } from "../../db/queries/users";

const MVP_USERNAME = "default";

export default function Home() {
  const router = useRouter();
  const { activeProfileId, activeLanguageId, session, startSession } = useAppState();

  const [profiles, setProfiles] = useState<LanguageProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const db = SQLite.useSQLiteContext();

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

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profiles.find((p) => p.userId === activeProfileId) ?? null;
  }, [profiles, activeProfileId]);

  useEffect(() => {
    if (!activeProfileId) router.replace("/(onboarding)/profile");
  }, [activeProfileId, router]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <YStack paddingTop={6}>
        <AppHeader title="Home" />

        {loading ? (
          <YStack marginTop={10} alignItems="center" justifyContent="center">
            <ActivityIndicator />
          </YStack>
        ) : (
          <Text color="$textMuted" marginTop={6}>
            Active Profile:{" "}
            {activeProfile ? `${activeProfile.learningName} (${activeProfile.learningCode})` : "None"}
          </Text>
        )}

        {!!activeLanguageId && (
          <Text color="$textFaint" marginTop={8} fontSize={12}>
            activeLanguageId: {activeLanguageId}
          </Text>
        )}

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
                disabled={true}
                onPress={() => {
                  startSession("review");
                  router.push("/(app)/session/setup");
                }}
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
    </Screen>
  );
}
