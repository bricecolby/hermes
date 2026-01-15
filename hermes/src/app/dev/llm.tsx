// src/app/dev/llm.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Button, Text, YStack } from "tamagui";

import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";

import { initLlama, loadLlamaModelInfo } from "llama.rn";

import { registerPracticeItems } from "shared/domain/practice";
import { registerPracticeItemSpecs } from "shared/services/practiceGeneration/specs/registerPracticeItemSpecs";
import { PracticeItemGenerator } from "shared/services/practiceGeneration/PracticeItemGenerator";

const MODEL_URL =
  "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";

const MODEL_FILENAME = "qwen2.5-0.5b-instruct-q4_k_m.gguf";
const MODEL_SUBDIR = "models";
const MIN_FREE_BYTES_FOR_MODEL = 800_000_000;

const STOP_WORDS = [
  "</s>",
  "<|end|>",
  "<|eot_id|>",
  "<|end_of_text|>",
  "<|im_end|>",
  "<|EOT|>",
  "<|END_OF_TURN_TOKEN|>",
  "<|end_of_turn|>",
  "<|endoftext|>",
];

type LlamaContext = Awaited<ReturnType<typeof initLlama>>;

function mb(bytes: number) {
  return Math.round(bytes / 1e6);
}

export default function LlmDevScreen() {
  const modelDir = useMemo(() => new Directory(Paths.document, MODEL_SUBDIR), []);
  const modelFile = useMemo(
    () => new File(Paths.document, `${MODEL_SUBDIR}/${MODEL_FILENAME}`),
    []
  );

  const ctxRef = useRef<LlamaContext | null>(null);

  const [status, setStatus] = useState<string>("idle");
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [output, setOutput] = useState<string>("");
  const [timings, setTimings] = useState<any>(null);

  const [lastError, setLastError] = useState<string>("");
  const [lastParsed, setLastParsed] = useState<any>(null);
  const [lastQualityIssues, setLastQualityIssues] = useState<string[]>([]);
  const [lastQualityOk, setLastQualityOk] = useState<boolean | null>(null);

  const [batchStats, setBatchStats] = useState<{
    n: number;
    ok: number;
    firstTryOk: number;
    repairedOk: number;
    failed: number;
    avgMs: number;
  } | null>(null);

  useEffect(() => {
    registerPracticeItems();
    registerPracticeItemSpecs();
  }, []);

  async function onCheckStorage() {
    const free = await LegacyFS.getFreeDiskStorageAsync();
    const total = await LegacyFS.getTotalDiskCapacityAsync();
    setStatus(`disk free=${mb(free)}MB / total=${mb(total)}MB`);

    try {
      const entries = await modelDir.list();
      console.log("modelDir entries:", entries.map((e: any) => e.uri));

      for (const e of entries as any[]) {
        if (typeof e?.info === "function") {
          const info = await e.info();
          console.log("entry info", e.uri, info);
        }
      }

      const mf = await modelFile.info();
      console.log("modelFile info", modelFile.uri, mf);
    } catch (err) {
      console.log("Could not inspect model dir", err);
    }
  }

  async function deleteModelFileIfExists() {
    try {
      const info = await modelFile.info();
      if (info.exists) {
        await modelFile.delete();
        setStatus("deleted model file ✅");
      } else {
        setStatus("no model file to delete");
      }
    } catch (e: any) {
      setStatus("delete failed");
      Alert.alert("Delete error", e?.message ?? String(e));
    }
  }

  async function deletePartialModelIfAny() {
    const info = await modelFile.info();
    if (!info.exists) return;

    if (typeof info.size === "number" && info.size < 50_000_000) {
      await modelFile.delete();
    }
  }

  async function ensureModelOnDevice() {
    setStatus("checking disk space…");
    const free = await LegacyFS.getFreeDiskStorageAsync();
    if (free < MIN_FREE_BYTES_FOR_MODEL) {
      throw new Error(
        `Not enough space to download model. Free=${mb(free)}MB (need ~${mb(
          MIN_FREE_BYTES_FOR_MODEL
        )}MB).`
      );
    }

    setStatus("checking model file…");
    const info = await modelFile.info();
    if (info.exists && typeof info.size === "number" && info.size > 50_000_000) return;

    await deletePartialModelIfAny();

    setStatus("creating model directory…");
    try {
      await modelDir.create();
    } catch {}

    setStatus("downloading model…");
    const downloaded = await File.downloadFileAsync(MODEL_URL, modelDir);

    const post = await downloaded.info();
    if (!post.exists || typeof post.size !== "number" || post.size < 50_000_000) {
      throw new Error(`Downloaded file seems wrong (size=${post.size ?? 0}).`);
    }
  }

  async function onLoadModelInfo() {
    try {
      setOutput("");
      setLastError("");
      setLastParsed(null);
      setLastQualityIssues([]);
      setLastQualityOk(null);
      setTimings(null);
      setBatchStats(null);

      await ensureModelOnDevice();

      setStatus("reading model info…");
      const info = await loadLlamaModelInfo(modelFile.uri);
      setModelInfo(info);
      setStatus("model info loaded ✅");
    } catch (e: any) {
      setStatus("error");
      Alert.alert("Model info error", e?.message ?? String(e));
    }
  }

  async function onInitContext() {
    try {
      setOutput("");
      setLastError("");
      setLastParsed(null);
      setLastQualityIssues([]);
      setLastQualityOk(null);
      setTimings(null);
      setBatchStats(null);

      await ensureModelOnDevice();

      setStatus("initializing llama context…");
      const ctx = await initLlama({
        model: modelFile.uri,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 0,
      });

      ctxRef.current = ctx;
      setStatus("context ready ✅");
    } catch (e: any) {
      setStatus("error");
      Alert.alert("Init error", e?.message ?? String(e));
    }
  }

  function buildCompletionFn(ctx: any) {
    return async (params: any, onPartial?: (text: string) => void) => {
      let built = "";
      const result = await ctx.completion(params, (data: any) => {
        if (data?.token) {
          built += data.token;
          if (onPartial && built.length % 64 === 0) onPartial(built);
        }
      });

      return { text: String(result?.text ?? built ?? ""), timings: result?.timings };
    };
  }

  async function onGenerateMcq() {
    try {
      const ctx = ctxRef.current;
      if (!ctx) {
        Alert.alert("Not ready", "Initialize the context first.");
        return;
      }

      setOutput("");
      setTimings(null);
      setBatchStats(null);

      setLastError("");
      setLastParsed(null);
      setLastQualityIssues([]);
      setLastQualityOk(null);

      setStatus("generating mcq…");

      const generator = new PracticeItemGenerator(buildCompletionFn(ctx), STOP_WORDS);

      const res = await generator.generate(
        "mcq_v1.basic",
        { targetLanguage: "Russian", cefr: "A1", conceptIds: [123] },
        (partial) => setOutput(partial),
        { maxAttempts: 3 }
      );

      setOutput(res.rawText);
      setTimings(res.timings);

      if (res.ok) {
        setLastParsed(res.parsed);
        setLastQualityIssues(res.qualityIssues ?? []);
        setLastQualityOk(true);
        setStatus(res.attempts === 1 ? "valid ✅ (first try)" : `valid ✅ (attempt ${res.attempts})`);
      } else {
        setLastParsed(null);
        setLastQualityIssues(res.qualityIssues ?? []);
        setLastQualityOk(false);
        setLastError(res.error);
        setStatus(`failed ❌ (attempts=${res.attempts})`);
      }
    } catch (e: any) {
      setStatus("error");
      Alert.alert("Generate error", e?.message ?? String(e));
    }
  }

  async function onGenerateBatch() {
    try {
      const ctx = ctxRef.current;
      if (!ctx) {
        Alert.alert("Not ready", "Initialize the context first.");
        return;
      }

      setOutput("");
      setTimings(null);

      setLastError("");
      setLastParsed(null);
      setLastQualityIssues([]);
      setLastQualityOk(null);

      const n = 20;
      setBatchStats(null);
      setStatus(`batch generating (${n})…`);

      const generator = new PracticeItemGenerator(buildCompletionFn(ctx), STOP_WORDS);

      let ok = 0;
      let firstTryOk = 0;
      let repairedOk = 0;
      let failed = 0;
      const times: number[] = [];

      for (let i = 0; i < n; i++) {
        const t0 = Date.now();
        const res = await generator.generate(
          "mcq_v1.basic",
          { targetLanguage: "Russian", cefr: "A1", conceptIds: [123] },
          undefined,
          { maxAttempts: 3 }
        );
        times.push(Date.now() - t0);

        if (res.ok) {
          ok += 1;
          if (res.attempts === 1) firstTryOk += 1;
          else repairedOk += 1;
        } else {
          failed += 1;
        }
      }

      const avgMs = Math.round(times.reduce((a, b) => a + b, 0) / Math.max(times.length, 1));
      setBatchStats({ n, ok, firstTryOk, repairedOk, failed, avgMs });
      setStatus(`batch done ✅ ok=${ok}/${n} avg=${avgMs}ms`);
    } catch (e: any) {
      setStatus("error");
      Alert.alert("Batch error", e?.message ?? String(e));
    }
  }

  function onReset() {
    ctxRef.current = null;
    setModelInfo(null);
    setOutput("");
    setTimings(null);

    setLastError("");
    setLastParsed(null);
    setLastQualityIssues([]);
    setLastQualityOk(null);

    setBatchStats(null);
    setStatus("idle");
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <YStack gap="$3">
        <Text fontSize={20} fontWeight="700">
          Local LLM Dev
        </Text>

        <Text>Status: {status}</Text>

        <YStack gap="$2">
          <Button onPress={onCheckStorage}>Check Storage</Button>
          <Button onPress={deleteModelFileIfExists} theme="red">
            Delete model file
          </Button>

          <Button onPress={onLoadModelInfo}>Load model info</Button>
          <Button onPress={onInitContext}>Init context</Button>

          <Button onPress={onGenerateMcq}>Generate MCQ (validate+quality)</Button>
          <Button onPress={onGenerateBatch}>Generate 20 MCQs (stats)</Button>

          <Button onPress={onReset} theme="gray">
            Reset
          </Button>
        </YStack>

        <YStack gap="$1">
          <Text fontWeight="700">Model URI</Text>
          <Text selectable fontFamily="$mono" fontSize={12}>
            {modelFile.uri}
          </Text>
        </YStack>

        <YStack gap="$1">
          <Text fontWeight="700">Quality</Text>
          <Text selectable fontFamily="$mono" fontSize={12}>
            {lastQualityOk === null
              ? "(not evaluated yet)"
              : lastQualityOk
              ? "✅ passed"
              : `❌ failed\n${lastQualityIssues.join("\n")}`}
          </Text>
        </YStack>

        {lastError ? (
          <YStack gap="$1">
            <Text fontWeight="700">Last Error</Text>
            <Text selectable fontFamily="$mono" fontSize={12}>
              {lastError}
            </Text>
          </YStack>
        ) : null}

        {batchStats ? (
          <YStack gap="$1">
            <Text fontWeight="700">Batch Stats</Text>
            <Text selectable fontFamily="$mono" fontSize={12}>
              {JSON.stringify(batchStats, null, 2)}
            </Text>
          </YStack>
        ) : null}

        {lastParsed ? (
          <YStack gap="$1">
            <Text fontWeight="700">Parsed JSON</Text>
            <Text selectable fontFamily="$mono" fontSize={12}>
              {JSON.stringify(lastParsed, null, 2)}
            </Text>
          </YStack>
        ) : null}

        {modelInfo ? (
          <YStack gap="$1">
            <Text fontWeight="700">Model Info</Text>
            <Text selectable fontFamily="$mono" fontSize={12}>
              {JSON.stringify(modelInfo, null, 2)}
            </Text>
          </YStack>
        ) : null}

        <YStack gap="$1">
          <Text fontWeight="700">Raw Output</Text>
          <Text selectable fontFamily="$mono" fontSize={12}>
            {output || "(none yet)"}
          </Text>
        </YStack>

        {timings ? (
          <YStack gap="$1">
            <Text fontWeight="700">Timings</Text>
            <Text selectable fontFamily="$mono" fontSize={12}>
              {JSON.stringify(timings, null, 2)}
            </Text>
          </YStack>
        ) : null}
      </YStack>
    </ScrollView>
  );
}
