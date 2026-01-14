// src/app/dev/llm.tsx
import React, { useMemo, useRef, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Button, Text, YStack } from "tamagui";

import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";

import { initLlama, loadLlamaModelInfo } from "llama.rn";

// Small multilingual instruct GGUF starter
const MODEL_URL =
  "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";

const MODEL_FILENAME = "qwen2.5-0.5b-instruct-q4_k_m.gguf";

const MODEL_SUBDIR = "models";

// Conservative: below this, downloads will likely fail
const MIN_FREE_BYTES_FOR_MODEL = 800_000_000; // ~800MB


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

  const [status, setStatus] = useState<string>("idle");
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [output, setOutput] = useState<string>("");
  const [timings, setTimings] = useState<any>(null);

  const ctxRef = useRef<LlamaContext | null>(null);

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

    // If it's smaller than "real model" threshold, it's probably a partial download.
    if (typeof info.size === "number" && info.size < 50_000_000) {
      await modelFile.delete();
      return;
    }

    // Even if it's larger, it may still be incomplete/corrupt.
    // If you want to be aggressive during dev, you can delete any existing file here.
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

    if (info.exists && typeof info.size === "number" && info.size > 50_000_000) {
      // Looks like we already have a real file. (May still be corrupt, but good enough for spike.)
      return;
    }

    // Clean up partial file if present
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
      setTimings(null);

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
      setTimings(null);

      await ensureModelOnDevice();

      setStatus("initializing llama context… (can take a bit)");
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

  async function onGenerateJsonTest() {
    try {
      const ctx = ctxRef.current;
      if (!ctx) {
        Alert.alert("Not ready", "Initialize the context first.");
        return;
      }

      setOutput("");
      setTimings(null);
      setStatus("generating…");

      const system = [
        "You are a generator for a language-learning app.",
        "Return ONLY valid JSON. No markdown. No commentary.",
        "All strings must be double-quoted. No trailing commas.",
        'If you cannot comply, return: {"error":"cannot_comply"}',
      ].join(" ");

      const user = [
        "Target language: Russian.",
        "Learner level: A1.",
        "Task: generate ONE practice item.",
        "Return JSON with this exact shape:",
        "{",
        '  "type": "multipleChoice",',
        '  "prompt": string,',
        '  "choices": [string, string, string, string],',
        '  "answerIndex": number,',
        '  "explanation": string',
        "}",
        "Constraints:",
        "- prompt and choices must be in Russian",
        "- explanation can be in English",
      ].join("\n");

      let built = "";
      const result = await ctx.completion(
        {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          n_predict: 220,
          temperature: 0.7,
          stop: STOP_WORDS,
        },
        (data) => {
          if (data?.token) {
            built += data.token;
            if (built.length % 32 === 0) setOutput(built);
          }
        }
      );

      setOutput(result.text ?? built);
      setTimings(result.timings);
      setStatus("done ✅");
    } catch (e: any) {
      setStatus("error");
      Alert.alert("Generate error", e?.message ?? String(e));
    }
  }

  function onReset() {
    ctxRef.current = null;
    setModelInfo(null);
    setOutput("");
    setTimings(null);
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
          <Button onPress={onGenerateJsonTest}>Generate JSON test</Button>

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

        {modelInfo ? (
          <YStack gap="$1">
            <Text fontWeight="700">Model Info</Text>
            <Text selectable fontFamily="$mono" fontSize={12}>
              {JSON.stringify(modelInfo, null, 2)}
            </Text>
          </YStack>
        ) : null}

        <YStack gap="$1">
          <Text fontWeight="700">Output</Text>
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
