import React, { useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { YStack, XStack, Text, Button } from "tamagui";

import { Screen } from "@/components/ui/Screen";
import { HermesButton } from "@/components/ui/HermesButton";
import { HermesTextField } from "@/components/ui/HermesTextField.tsx";
import {
  cloudProviderLabel,
  MODEL_CATALOG,
  isCloudModelCard,
  isLocalModelCard,
  type ModelPurpose,
} from "shared/services/llm/modelCatalog";
import {
  clearActiveModelId,
  getActiveModelId,
  ensureModelOnDevice,
  deleteModel,
  getActiveModelUri,
  setActiveModelId,
  setActiveModelUri,
  getModelFileUri,
  modelIsDownloaded,
  clearActiveModelUri,
} from "shared/services/llm/modelStore";
import {
  hasCloudApiKey,
  removeCloudApiKey,
  setCloudApiKey,
} from "shared/services/llm/cloudCredentials";
import { llmClient } from "shared/services/llm/client";

export default function ModelsModal() {
  const router = useRouter();
  const { purpose } = useLocalSearchParams<{ purpose?: ModelPurpose | "all" }>();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [cloudConfigured, setCloudConfigured] = useState<Record<string, boolean>>({});
  const [cloudApiKeyDrafts, setCloudApiKeyDrafts] = useState<Record<string, string>>({});
  const [activeModelId, setActiveModelIdState] = useState<string | null>(null);
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
        const activeModel = await getActiveModelId();
        const active = await getActiveModelUri();
        const localEntries = await Promise.all(
          MODEL_CATALOG.filter(isLocalModelCard).map(
            async (m) => [m.id, await modelIsDownloaded(m.filename)] as const
          )
        );
        const cloudEntries = await Promise.all(
          MODEL_CATALOG.filter(isCloudModelCard).map(
            async (m) => [m.id, await hasCloudApiKey(m.provider)] as const
          )
        );

        if (cancelled) return;
        const nextLocal: Record<string, boolean> = {};
        for (const [id, ok] of localEntries) nextLocal[id] = ok;
        const nextCloud: Record<string, boolean> = {};
        for (const [id, ok] of cloudEntries) nextCloud[id] = ok;

        setDownloaded(nextLocal);
        setCloudConfigured(nextCloud);
        setActiveModelIdState(activeModel);
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
    const activeModel = await getActiveModelId();
    const active = await getActiveModelUri();
    const localEntries = await Promise.all(
      MODEL_CATALOG.filter(isLocalModelCard).map(
        async (m) => [m.id, await modelIsDownloaded(m.filename)] as const
      )
    );
    const cloudEntries = await Promise.all(
      MODEL_CATALOG.filter(isCloudModelCard).map(
        async (m) => [m.id, await hasCloudApiKey(m.provider)] as const
      )
    );
    const nextLocal: Record<string, boolean> = {};
    for (const [id, ok] of localEntries) nextLocal[id] = ok;
    const nextCloud: Record<string, boolean> = {};
    for (const [id, ok] of cloudEntries) nextCloud[id] = ok;

    setDownloaded(nextLocal);
    setCloudConfigured(nextCloud);
    setActiveModelIdState(activeModel);
    setActiveUri(active);
  }

  async function onDownload(modelId: string) {
    const m = MODEL_CATALOG.find((x) => x.id === modelId);
    if (!m) return;
    if (!isLocalModelCard(m)) return;
    if (busyId) return;

    setBusyId(m.id);
    try {
      const uri = await ensureModelOnDevice(m.url, m.filename, m.minFreeBytes);
      await setActiveModelId(m.id);
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
    if (!isLocalModelCard(m)) return;
    if (busyId) return;

    setBusyId(m.id);
    try {
      await deleteModel(m.filename);
      const active = await getActiveModelUri();
      if (active && active === getModelFileUri(m.filename)) {
        await clearActiveModelUri();
      }
      if (activeModelId === m.id) {
        await clearActiveModelId();
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
    if (!isLocalModelCard(m)) return;
    if (busyId) return;

    const uri = getModelFileUri(m.filename);
    await setActiveModelId(m.id);
    await setActiveModelUri(uri);
    llmClient.reset();
    await refresh();
    router.back();
  }

  async function onSelectCloud(modelId: string) {
    const m = MODEL_CATALOG.find((x) => x.id === modelId);
    if (!m) return;
    if (!isCloudModelCard(m)) return;
    if (busyId) return;

    const hasKey = await hasCloudApiKey(m.provider);
    if (!hasKey) {
      Alert.alert("Missing API key", "Save your API key first.");
      return;
    }

    setBusyId(m.id);
    try {
      await setActiveModelId(m.id);
      await clearActiveModelUri();
      llmClient.reset();
      await refresh();
      router.back();
    } finally {
      setBusyId(null);
    }
  }

  async function onSaveCloudKey(modelId: string) {
    const m = MODEL_CATALOG.find((x) => x.id === modelId);
    if (!m) return;
    if (!isCloudModelCard(m)) return;
    if (busyId) return;

    const key = (cloudApiKeyDrafts[modelId] ?? "").trim();
    if (!key) {
      Alert.alert("Missing API key", "Paste your API key before saving.");
      return;
    }

    setBusyId(m.id);
    try {
      await setCloudApiKey(m.provider, key);
      setCloudApiKeyDrafts((prev) => ({ ...prev, [modelId]: "" }));
      await refresh();
      Alert.alert("Saved", `${m.name} API key is saved on this device.`);
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onRemoveCloudKey(modelId: string) {
    const m = MODEL_CATALOG.find((x) => x.id === modelId);
    if (!m) return;
    if (!isCloudModelCard(m)) return;
    if (busyId) return;

    setBusyId(m.id);
    try {
      await removeCloudApiKey(m.provider);
      setCloudApiKeyDrafts((prev) => ({ ...prev, [modelId]: "" }));
      await refresh();
      Alert.alert("Removed", `${m.name} API key was removed from this device.`);
    } catch (e: any) {
      Alert.alert("Remove failed", e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
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
                const isDownloaded = isLocalModelCard(m) ? downloaded[m.id] === true : false;
                const isCloudReady = isCloudModelCard(m) ? cloudConfigured[m.id] === true : false;
                const isActive = activeModelId
                  ? activeModelId === m.id
                  : isLocalModelCard(m) && activeUri === getModelFileUri(m.filename);
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

                    {isLocalModelCard(m) ? (
                      <XStack gap="$2" flexWrap="wrap">
                        {!isDownloaded ? (
                          <HermesButton
                            label={busy ? "Downloading…" : "Download"}
                            variant="primary"
                            disabled={busy}
                            onPress={() => onDownload(m.id)}
                          />
                        ) : (
                          <>
                            <HermesButton
                              label={isActive ? "Selected" : "Use for Chat"}
                              variant="secondary"
                              disabled={busy}
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
                    ) : (
                      <YStack gap="$2">
                        <Text color="$textMuted" fontSize={12}>
                          {isCloudReady
                            ? "API key is configured on this device."
                            : `Paste your ${cloudProviderLabel(m.provider)} API key to enable this cloud model.`}
                        </Text>
                        <HermesTextField
                          value={cloudApiKeyDrafts[m.id] ?? ""}
                          onChangeText={(next) =>
                            setCloudApiKeyDrafts((prev) => ({ ...prev, [m.id]: next }))
                          }
                          placeholder={`${cloudProviderLabel(m.provider)} API key`}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!busy}
                        />
                        <XStack gap="$2" flexWrap="wrap">
                          {isCloudReady ? (
                            <HermesButton
                              label={isActive ? "Selected" : "Use for Chat"}
                              variant="secondary"
                              marginTop={0}
                              disabled={busy}
                              onPress={() => onSelectCloud(m.id)}
                            />
                          ) : null}
                          <HermesButton
                            label={busy ? "Saving…" : isCloudReady ? "Update key" : "Save key"}
                            variant="primary"
                            marginTop={0}
                            disabled={busy}
                            onPress={() => onSaveCloudKey(m.id)}
                          />
                          {isCloudReady ? (
                            <Button
                              theme="red"
                              disabled={busy}
                              onPress={() => onRemoveCloudKey(m.id)}
                            >
                              {busy ? "Removing…" : "Remove key"}
                            </Button>
                          ) : null}
                        </XStack>
                        <Text color="$textMuted" fontSize={11}>
                          Create key: {m.setupUrl}
                        </Text>
                      </YStack>
                    )}
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
