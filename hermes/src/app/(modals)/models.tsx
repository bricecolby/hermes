import React, { useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { YStack, XStack, Text, Button } from "tamagui";

import { Screen } from "@/components/ui/Screen";
import { HermesButton } from "@/components/ui/HermesButton";
import { MODEL_CATALOG, type ModelPurpose } from "shared/services/llm/modelCatalog";
import {
  ensureModelOnDevice,
  deleteModel,
  getActiveModelUri,
  setActiveModelUri,
  getModelFileUri,
  modelIsDownloaded,
  clearActiveModelUri,
} from "shared/services/llm/modelStore";
import { llmClient } from "shared/services/llm/client";

export default function ModelsModal() {
  const router = useRouter();
  const { purpose } = useLocalSearchParams<{ purpose?: ModelPurpose | "all" }>();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [activeUri, setActiveUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filterPurpose = purpose ?? "all";

  const visibleModels = useMemo(() => {
    if (filterPurpose === "all") return MODEL_CATALOG;
    return MODEL_CATALOG.filter((m) => m.purposes.includes(filterPurpose));
  }, [filterPurpose]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const active = await getActiveModelUri();
        const entries = await Promise.all(
          MODEL_CATALOG.map(async (m) => [m.id, await modelIsDownloaded(m.filename)] as const)
        );

        if (cancelled) return;
        const next: Record<string, boolean> = {};
        for (const [id, ok] of entries) next[id] = ok;
        setDownloaded(next);
        setActiveUri(active);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    const active = await getActiveModelUri();
    const entries = await Promise.all(
      MODEL_CATALOG.map(async (m) => [m.id, await modelIsDownloaded(m.filename)] as const)
    );
    const next: Record<string, boolean> = {};
    for (const [id, ok] of entries) next[id] = ok;
    setDownloaded(next);
    setActiveUri(active);
  }

  async function onDownload(modelId: string) {
    const m = MODEL_CATALOG.find((x) => x.id === modelId);
    if (!m) return;
    if (busyId) return;

    setBusyId(m.id);
    try {
      const uri = await ensureModelOnDevice(m.url, m.filename, m.minFreeBytes);
      await setActiveModelUri(uri);
      llmClient.reset();
      await refresh();
      Alert.alert("Model downloaded", `${m.name} is ready and set active.`);
    } catch (e: any) {
      Alert.alert("Download failed", e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(modelId: string) {
    const m = MODEL_CATALOG.find((x) => x.id === modelId);
    if (!m) return;
    if (busyId) return;

    setBusyId(m.id);
    try {
      await deleteModel(m.filename);
      const active = await getActiveModelUri();
      if (active && active === getModelFileUri(m.filename)) {
        await clearActiveModelUri();
      }
      llmClient.reset();
      await refresh();
      Alert.alert("Deleted", `${m.name} was removed.`);
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onSelect(modelId: string) {
    const m = MODEL_CATALOG.find((x) => x.id === modelId);
    if (!m) return;
    if (busyId) return;

    const uri = getModelFileUri(m.filename);
    await setActiveModelUri(uri);
    llmClient.reset();
    await refresh();
    router.back();
  }

  return (
    <Screen>
      <YStack gap="$4">
        <Text style={{ color: "#E6EBFF", fontSize: 20, fontWeight: "900" }}>
          Manage models
        </Text>

        {loading ? (
          <YStack alignItems="center" paddingTop={20}>
            <ActivityIndicator />
          </YStack>
        ) : (
          <ScrollView>
            <YStack gap="$3" paddingBottom={24}>
              {visibleModels.length === 0 ? (
                <Text color="$textMuted">No models available for this category yet.</Text>
              ) : null}
              {visibleModels.map((m) => {
                const isDownloaded = downloaded[m.id] === true;
                const isActive = activeUri === getModelFileUri(m.filename);
                const busy = busyId === m.id;

                return (
                  <YStack
                    key={m.id}
                    padding="$3"
                    borderRadius="$5"
                    backgroundColor="$glassFill"
                    borderWidth={1}
                    borderColor="$borderColor"
                    gap="$2"
                  >
                    <XStack alignItems="center" justifyContent="space-between">
                      <Text color="$color" fontWeight="800">
                        {m.name}
                      </Text>
                      {isActive ? (
                        <Text color="$green11" fontWeight="800">
                          Active
                        </Text>
                      ) : null}
                    </XStack>

                    <Text color="$textMuted" fontSize={12}>
                      {m.description}
                    </Text>

                    <XStack gap="$2" flexWrap="wrap" alignItems="center">
                      {m.purposes.map((p) => (
                        <YStack
                          key={p}
                          paddingHorizontal="$2"
                          paddingVertical="$1"
                          borderRadius="$4"
                          backgroundColor="rgba(255,255,255,0.06)"
                          borderWidth={1}
                          borderColor="$borderColor"
                        >
                          <Text fontSize={11} color="$textMuted">
                            {p.toUpperCase()}
                          </Text>
                        </YStack>
                      ))}
                      <Text fontSize={11} color="$textMuted">
                        {m.sizeLabel}
                      </Text>
                    </XStack>

                    <XStack gap="$2" flexWrap="wrap">
                      {!isDownloaded ? (
                        <HermesButton
                          label={busy ? "Downloading…" : "Download"}
                          variant="primary"
                          onPress={() => onDownload(m.id)}
                        />
                      ) : (
                        <>
                          <HermesButton
                            label={isActive ? "Selected" : "Use for Chat"}
                            variant="secondary"
                            onPress={() => onSelect(m.id)}
                          />
                          <Button
                            theme="red"
                            disabled={busy}
                            onPress={() => onDelete(m.id)}
                          >
                            {busy ? "Deleting…" : "Delete"}
                          </Button>
                        </>
                      )}
                    </XStack>
                  </YStack>
                );
              })}
            </YStack>
          </ScrollView>
        )}
      </YStack>
    </Screen>
  );
}
