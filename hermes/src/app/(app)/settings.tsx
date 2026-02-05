import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Button, Text, YStack, XStack } from "tamagui";
import { useSQLiteContext } from "expo-sqlite";

import { Screen } from "../../components/ui/Screen";
import { useAppState } from "../../state/AppState";
import { LearnSettingsEditor } from "@/components/ui/LearnSettingsEditor";
import { getLearnSettings, upsertLearnSettings, type LearnSettings } from "@/db/queries/learn";
import { HermesButton } from "@/components/ui/HermesButton";

import {
  getActiveModelUri,
  getModelFileUri,
  modelFileExists,
} from "shared/services/llm/modelStore";
import { MODEL_CATALOG } from "shared/services/llm/modelCatalog";
import { AppHeader } from "@/components/ui/AppHeader";

export default function Settings() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { setActiveLanguage, activeProfileId, activeLanguageId } = useAppState();

  const [activeUri, setActiveUri] = useState<string | null>(null);
  const [activeUriExists, setActiveUriExists] = useState<boolean | null>(null);
  const [learnSettings, setLearnSettings] = useState<LearnSettings | null>(null);
  const [learnSettingsLoading, setLearnSettingsLoading] = useState(false);

  const refresh = useCallback(async () => {
    const uri = await getActiveModelUri();
    setActiveUri(uri);

    if (uri) {
      const exists = await modelFileExists(uri);
      setActiveUriExists(exists);
    } else {
      setActiveUriExists(null);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    if (!activeProfileId || !activeLanguageId) return;
    let cancelled = false;

    (async () => {
      try {
        setLearnSettingsLoading(true);
        const s = await getLearnSettings(db, {
          userId: activeProfileId,
          languageId: activeLanguageId,
        });
        if (!cancelled) setLearnSettings(s);
      } catch (e) {
        console.warn("[settings] learn settings load failed", e);
        if (!cancelled) setLearnSettings(null);
      } finally {
        if (!cancelled) setLearnSettingsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, activeProfileId, activeLanguageId]);

  const activeChatModel = useMemo(() => {
    if (!activeUri) return null;
    return MODEL_CATALOG.find((m) => getModelFileUri(m.filename) === activeUri) ?? null;
  }, [activeUri]);

  const openModelPicker = (purpose: "chat" | "tts" | "stt" | "all") => {
    router.push({
      pathname: "/(modals)/models",
      params: { purpose },
    });
  };

  return (
    <Screen>
      <YStack gap="$4">
        <AppHeader title="Settings" />

        {/* Learn settings */}
        <YStack
          gap="$2"
          padding="$3"
          borderRadius="$5"
          backgroundColor="$glassFill"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Text color="$textMuted">Learn</Text>

          {learnSettingsLoading || !learnSettings ? (
            <Text color="$textMuted" fontSize={12}>
              {learnSettingsLoading ? "Loading learn settings…" : "No learn settings yet."}
            </Text>
          ) : (
            <LearnSettingsEditor
              initial={learnSettings}
              onSave={async (next) => {
                if (!activeProfileId || !activeLanguageId) return;
                await upsertLearnSettings(db, {
                  userId: activeProfileId,
                  languageId: activeLanguageId,
                  ...next,
                });
                setLearnSettings(next);
                Alert.alert("Learn settings saved");
              }}
            />
          )}
        </YStack>

        {/* Models */}
        <YStack
          gap="$3"
          padding="$3"
          borderRadius="$5"
          backgroundColor="$glassFill"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <XStack alignItems="center" justifyContent="space-between">
            <YStack>
              <Text color="$textMuted">Models</Text>
              <Text color="$textMuted" fontSize={12}>
                Manage downloads and active models.
              </Text>
            </YStack>
            <HermesButton
              label="Manage models"
              variant="primary"
              marginTop={0}
              size="sm"
              onPress={() => openModelPicker("all")}
            />
          </XStack>

          <YStack
            borderWidth={1}
            borderColor="$borderColor"
            borderRadius="$5"
            overflow="hidden"
          >
            {[
              {
                label: "Chat model",
                value: activeChatModel?.name ?? (activeUri ? "Custom model" : "Not set"),
                action: () => openModelPicker("chat"),
              },
              { label: "TTS model", value: "Not set", action: () => openModelPicker("tts") },
              { label: "STT model", value: "Not set", action: () => openModelPicker("stt") },
            ].map((row, idx) => (
              <XStack
                key={row.label}
                alignItems="center"
                justifyContent="space-between"
                padding="$3"
                borderBottomWidth={idx === 2 ? 0 : 1}
                borderColor="$borderColor"
                backgroundColor="rgba(255,255,255,0.03)"
              >
                <YStack>
                  <Text color="$color" fontWeight="600">
                    {row.label}
                  </Text>
                  <Text color="$textMuted" fontSize={12}>
                    {row.value}
                  </Text>
                </YStack>
                <TouchableOpacity onPress={row.action} activeOpacity={0.7}>
                  <Text color="$color" fontWeight={900}>
                    Change
                  </Text>
                </TouchableOpacity>
              </XStack>
            ))}
          </YStack>
        </YStack>
      </YStack>
    </Screen>
  );
}
