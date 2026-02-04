import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator } from "react-native";
import { YStack, Text } from "tamagui";
import { useSQLiteContext } from "expo-sqlite";

import { Screen } from "@/components/ui/Screen";
import { LearnSettingsEditor } from "@/components/ui/LearnSettingsEditor";
import { useAppState } from "@/state/AppState";
import { getLearnSettings, upsertLearnSettings, type LearnSettings } from "@/db/queries/learn";

export default function LearnSettingsModal() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { activeProfileId, activeLanguageId } = useAppState();

  const userId = activeProfileId ?? (() => { throw new Error("No active profile"); })();
  const languageId = activeLanguageId ?? (() => { throw new Error("No active language"); })();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<LearnSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const s = await getLearnSettings(db, { userId, languageId });
        if (!cancelled) setSettings(s);
      } catch (e) {
        console.warn("[learn settings] load failed", e);
        if (!cancelled) setSettings(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [db, userId, languageId]);

  return (
    <Screen>
      <YStack gap={14} paddingTop={6}>
        <Text fontSize={20} fontWeight="900" color="$color">
          Learn Settings
        </Text>

        {loading || !settings ? (
          <YStack alignItems="center" paddingTop={20}>
            <ActivityIndicator />
          </YStack>
        ) : (
          <LearnSettingsEditor
            initial={settings}
            onCancel={() => router.back()}
            onSave={async (next) => {
              await upsertLearnSettings(db, { userId, languageId, ...next });
              router.back();
            }}
          />
        )}
      </YStack>
    </Screen>
  );
}
