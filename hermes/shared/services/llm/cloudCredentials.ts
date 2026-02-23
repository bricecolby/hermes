import * as SecureStore from "expo-secure-store";
import type { CloudProvider } from "./modelCatalog";

const CLOUD_API_KEY_PREFIX = "llm.cloudApiKey";

function storageKey(provider: CloudProvider): string {
  return `${CLOUD_API_KEY_PREFIX}.${provider}`;
}

export async function getCloudApiKey(provider: CloudProvider): Promise<string | null> {
  const key = storageKey(provider);
  return SecureStore.getItemAsync(key);
}

export async function setCloudApiKey(provider: CloudProvider, value: string): Promise<void> {
  const key = storageKey(provider);
  await SecureStore.setItemAsync(key, value);
}

export async function removeCloudApiKey(provider: CloudProvider): Promise<void> {
  const key = storageKey(provider);
  await SecureStore.deleteItemAsync(key);
}

export async function hasCloudApiKey(provider: CloudProvider): Promise<boolean> {
  const key = await getCloudApiKey(provider);
  return typeof key === "string" && key.trim().length > 0;
}
