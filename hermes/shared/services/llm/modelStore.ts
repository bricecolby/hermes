// shared/services/llm/modelStore.ts
import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";

const MODEL_SUBDIR = "models";
const MIN_MODEL_BYTES = 50_000_000;

export async function ensureModelOnDevice(
  modelUrl: string,
  modelFilename: string,
  minFreeBytes: number
): Promise<string> {
  const free = await LegacyFS.getFreeDiskStorageAsync();
  if (free < minFreeBytes) {
    throw new Error("Not enough free disk space for model");
  }

  const dir = new Directory(Paths.document, MODEL_SUBDIR);
  const file = new File(Paths.document, `${MODEL_SUBDIR}/${modelFilename}`);

  const info = await file.info();
  if (info.exists && typeof info.size === "number" && info.size > MIN_MODEL_BYTES) {
    return file.uri;
  }

  try {
    await dir.create();
  } catch {}

  const downloaded = await File.downloadFileAsync(modelUrl, dir);
  const post = await downloaded.info();

  if (!post.exists || (post.size ?? 0) < MIN_MODEL_BYTES) {
    throw new Error("Downloaded model file invalid");
  }

  return file.uri;
}

export async function deleteModel(modelFilename: string) {
  const file = new File(Paths.document, `models/${modelFilename}`);
  const info = await file.info();
  if (info.exists) {
    await file.delete();
  }
}
