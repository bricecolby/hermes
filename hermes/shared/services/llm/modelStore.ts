// shared/services/llm/modelStore.ts
import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MODEL_CATALOG } from "./modelCatalog";

const MODEL_SUBDIR = "models";
const MIN_MODEL_BYTES = 50_000_000;

// Persisted "active model" pointer (device-specific)
const ACTIVE_MODEL_URI_KEY = "llm.activeModelUri";


/**
 * Ensure a model file exists in the app's document storage under /models.
 * If the file already exists and looks valid, returns its URI without downloading.
 * If not, checks free disk space and downloads from modelUrl into /models.
 */
export async function ensureModelOnDevice(
  modelUrl: string,
  modelFilename: string,
  minFreeBytes: number
): Promise<string> {
  const dir = new Directory(Paths.document, MODEL_SUBDIR);
  const file = new File(Paths.document, `${MODEL_SUBDIR}/${modelFilename}`);

  // ✅ FIRST: if model already exists and is large enough, use it
  const info = await file.info();
  if (info.exists && typeof info.size === "number" && info.size > MIN_MODEL_BYTES) {
    return file.uri;
  }

  // ✅ Only require free disk space when we actually need to download
  const free = await LegacyFS.getFreeDiskStorageAsync();
  if (free < minFreeBytes) {
    throw new Error("Not enough free disk space for model");
  }

  try {
    await dir.create();
  } catch {}

  const downloaded = await File.downloadFileAsync(modelUrl, file);
  const post = await downloaded.info();

  if (!post.exists || (post.size ?? 0) < MIN_MODEL_BYTES) {
    throw new Error("Downloaded model file invalid");
  }

  return file.uri;
}

export function getModelFileUri(modelFilename: string): string {
  const file = new File(Paths.document, `${MODEL_SUBDIR}/${modelFilename}`);
  return file.uri;
}

export async function modelFileInfo(modelFilename: string) {
  const file = new File(Paths.document, `${MODEL_SUBDIR}/${modelFilename}`);
  return file.info();
}

export async function modelIsDownloaded(modelFilename: string): Promise<boolean> {
  const info = await modelFileInfo(modelFilename);
  return !!(info.exists && typeof info.size === "number" && info.size > MIN_MODEL_BYTES);
}

export async function deleteModel(modelFilename: string) {
  const file = new File(Paths.document, `${MODEL_SUBDIR}/${modelFilename}`);
  const info = await file.info();
  if (info.exists) {
    await file.delete();
  }
}

/**
 * Persist which model URI should be used by default on this device.
 * Call this after a successful download/import.
 */
export async function setActiveModelUri(uri: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_MODEL_URI_KEY, uri);
}

/**
 * Retrieve the persisted active model URI, if any.
 */
export async function getActiveModelUri(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_MODEL_URI_KEY);
}

/**
 * Clear active model selection (e.g., user deletes model).
 */
export async function clearActiveModelUri(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_MODEL_URI_KEY);
}

/**
 * Verify the model file still exists at the provided URI.
 */
export async function modelFileExists(uri: string): Promise<boolean> {
  try {
    const info = await LegacyFS.getInfoAsync(uri);
    return !!info.exists;
  } catch {
    return false;
  }
}

export async function findFirstDownloadedModelUri(): Promise<string | null> {
  for (const m of MODEL_CATALOG) {
    if (await modelIsDownloaded(m.filename)) {
      return getModelFileUri(m.filename);
    }
  }
  return null;
}
