import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button, Text, YStack, XStack } from "tamagui";

import { Screen } from "../../components/ui/Screen";
import { useAppState } from "../../state/AppState";

import { llmClient } from "shared/services/llm/client";

import {
  DEV_MODEL_URL,
  DEV_MODEL_FILENAME,
  DEV_MIN_FREE_BYTES_FOR_MODEL,
  ensureModelOnDevice,
  deleteModel,
  setActiveModelUri,
  getActiveModelUri,
  clearActiveModelUri,
  modelFileExists,
} from "shared/services/llm/modelStore";

export default function Settings() {
  const router = useRouter();
  const { setActiveLanguage } = useAppState();

  const [activeUri, setActiveUri] = useState<string | null>(null);
  const [activeUriExists, setActiveUriExists] = useState<boolean | null>(null);

  const [busy, setBusy] = useState<
    null | "init" | "download" | "delete" | "clear"
  >(null);

  const [llmError, setLlmError] = useState<string | null>(null);

  const llmStatus = llmClient.getStatus();

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

  const canInit = busy === null;
  const canDownload = busy === null;
  const canDelete = busy === null;
  const canClear = busy === null;

  const statusLine = useMemo(() => {
    if (llmClient.isReady()) return "ready ✅";
    if (llmStatus.state === "initializing") return "initializing…";
    if (llmStatus.state === "resolving_model") return "resolving model…";
    if (llmStatus.state === "error") return `error ❌: ${llmStatus.message}`;
    return "idle";
  }, [llmStatus, llmClient]);

  async function onInitLlm() {
    if (!canInit) return;
    setBusy("init");
    setLlmError(null);

    try {
      await llmClient.ensureReady();
      await refresh();
      Alert.alert("LLM Ready", "Local LLM initialized successfully.");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setLlmError(msg);
      Alert.alert("LLM init failed", msg);
    } finally {
      setBusy(null);
    }
  }

  async function onDownloadDevModel() {
    if (!canDownload) return;
    setBusy("download");
    setLlmError(null);

    try {
      const uri = await ensureModelOnDevice(
        DEV_MODEL_URL,
        DEV_MODEL_FILENAME,
        DEV_MIN_FREE_BYTES_FOR_MODEL
      );

      await setActiveModelUri(uri);
      await refresh();

      Alert.alert("Model downloaded", `Saved model and set active.\n\nURI:\n${uri}`);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setLlmError(msg);
      Alert.alert("Download failed", msg);
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteDevModel() {
    if (!canDelete) return;

    Alert.alert("Delete dev model?", "This deletes the dev model file from local storage.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          setLlmError(null);

          try {
            await deleteModel(DEV_MODEL_FILENAME);

            // if active uri was the dev model path, clear it
            const uri = await getActiveModelUri();
            if (uri && uri.includes(DEV_MODEL_FILENAME)) {
              await clearActiveModelUri();
            }

            llmClient.reset();
            await refresh();

            Alert.alert("Deleted", "Dev model deleted and LLM reset.");
          } catch (e: any) {
            const msg = e?.message ?? String(e);
            setLlmError(msg);
            Alert.alert("Delete failed", msg);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  async function onClearActiveModel() {
    if (!canClear) return;
    setBusy("clear");
    setLlmError(null);

    try {
      await clearActiveModelUri();
      llmClient.reset();
      await refresh();
      Alert.alert("Cleared", "Active model cleared and LLM reset.");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setLlmError(msg);
      Alert.alert("Clear failed", msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <YStack gap="$4">
        <Text style={{ color: "#E6EBFF", fontSize: 22, fontWeight: "900" }}>
          Settings
        </Text>

        {/* App settings */}
        <YStack gap="$2" paddingTop="$2">
          <Text color="$textMuted">App</Text>

          <Button
            onPress={async () => {
              await setActiveLanguage(null);
              router.replace("./(onboarding)/profile");
            }}
          >
            Switch language (back to profile)
          </Button>
        </YStack>

        {/* LLM settings */}
        <YStack gap="$2" paddingTop="$2">
          <Text color="$textMuted">Local LLM</Text>

          <YStack gap="$1">
            <Text color="$color" fontWeight="800">
              Status: {statusLine}
            </Text>

            <Text fontSize={12} color="$textMuted">
              Active model URI:
            </Text>

            <Text selectable fontSize={12} fontFamily="$mono" color="$color">
              {activeUri ?? "(none set)"}
            </Text>

            {activeUri ? (
              <Text fontSize={12} color="$textMuted">
                File exists:{" "}
                {activeUriExists === null ? "…" : activeUriExists ? "yes ✅" : "no ❌"}
              </Text>
            ) : null}

            {llmError ? (
              <Text fontSize={12} color="$red10">
                {llmError}
              </Text>
            ) : null}
          </YStack>

          <XStack gap="$2" flexWrap="wrap">
            <Button disabled={!canInit} onPress={onInitLlm}>
              {busy === "init" ? "Initializing…" : "Initialize LLM"}
            </Button>

            <Button disabled={!canDownload} onPress={onDownloadDevModel}>
              {busy === "download" ? "Downloading…" : "Download dev model"}
            </Button>
          </XStack>

          <XStack gap="$2" flexWrap="wrap">
            <Button theme="red" disabled={!canDelete} onPress={onDeleteDevModel}>
              {busy === "delete" ? "Deleting…" : "Delete dev model"}
            </Button>

            <Button theme="gray" disabled={!canClear} onPress={onClearActiveModel}>
              {busy === "clear" ? "Clearing…" : "Clear active model"}
            </Button>
          </XStack>
        </YStack>
      </YStack>
    </Screen>
  );
}
