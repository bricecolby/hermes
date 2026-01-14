// src/app/dev/llm.tsx
import React, { useMemo, useRef, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Button, Text, YStack } from "tamagui";

import { Directory, File, Paths } from "expo-file-system";
import * as LegacyFS from "expo-file-system/legacy";

import { initLlama, loadLlamaModelInfo } from "llama.rn";

import { z } from "zod";
import { practiceItemRegistry, registerPracticeItems } from "shared/domain/practice";

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

function extractLikelyJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

function buildMcqPrompt() {
  const system = [
    "You generate content for a language-learning app.",
    "Return ONLY valid JSON (no markdown, no commentary).",
    "All keys and strings must use double quotes.",
    "No trailing commas.",
  ].join(" ");

  const user = [
    "Generate ONE practice item JSON for this schema:",
    "{",
    '  "type": "mcq_v1.basic",',
    '  "mode": "reception",',
    '  "skills": ["reading"],',
    '  "conceptIds": [123],',
    '  "prompt": string,',
    '  "choices": [{"id":"A","text":string},{"id":"B","text":string},{"id":"C","text":string},{"id":"D","text":string}],',
    '  "correctChoiceId": "A" | "B" | "C" | "D"',
    "}",
    "",
    "Constraints:",
    "- Target language: Russian",
    "- Learner level: A1",
    "- Use short, natural phrases.",
    "- prompt and choices must be Russian.",
    "- correctChoiceId must match one of the choice ids.",
    "- conceptIds must be [123] exactly.",
    `Example valid output:
        {
        "type": "mcq_v1.basic",
        "mode": "reception",
        "skills": ["reading"],
        "conceptIds": [123],
        "prompt": "Где находится банк?",
        "choices": [
            {"id":"A","text":"В школе"},
            {"id":"B","text":"В банке"},
            {"id":"C","text":"В парке"},
            {"id":"D","text":"Дома"}
        ],
        "correctChoiceId": "B"
        }`,
  ].join("\n");

  return { system, user };
}

async function completionToText(
  ctx: any,
  params: any,
  onPartial?: (t: string) => void
): Promise<{ text: string; timings?: any }> {
  let built = "";
  const result = await ctx.completion(params, (data: any) => {
    if (data?.token) {
      built += data.token;
      if (onPartial && built.length % 64 === 0) onPartial(built);
    }
  });

  return { text: String(result?.text ?? built ?? ""), timings: result?.timings };
}

async function generateValidatedMcq(
  ctx: any,
  setOutput: (s: string) => void
): Promise<
  | { ok: true; rawText: string; parsed: any; attempts: number; timings?: any }
  | { ok: false; rawText: string; error: string; attempts: number; timings?: any }
> {
  const { system, user } = buildMcqPrompt();

  const first = await completionToText(
    ctx,
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      n_predict: 260,
      temperature: 0.6,
      stop: STOP_WORDS,
    },
    setOutput
  );

  let rawText = first.text;
  let timings = first.timings;
  let jsonStr = extractLikelyJson(rawText) ?? rawText;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const parsed = JSON.parse(jsonStr);
      practiceItemRegistry.create(parsed);
      return { ok: true, rawText, parsed, attempts: attempt, timings };
    } catch (e: any) {
      const errorText =
        e instanceof z.ZodError ? formatZodError(e) : e?.message ?? String(e);

      const repair = await completionToText(
        ctx,
        {
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content:
                "Fix the JSON to satisfy the schema. Return ONLY corrected JSON.\n\n" +
                `Validation errors:\n${errorText}\n\n` +
                `JSON:\n${jsonStr}`,
            },
          ],
          n_predict: 260,
          temperature: 0.2,
          stop: STOP_WORDS,
        },
        setOutput
      );

      rawText = repair.text;
      timings = repair.timings;
      jsonStr = extractLikelyJson(rawText) ?? rawText;

      if (attempt === 2) {
        return { ok: false, rawText, error: errorText, attempts: attempt, timings };
      }
    }
  }

  return { ok: false, rawText, error: "Unknown error", attempts: 2, timings };
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
  const [lastError, setLastError] = useState<string>("");
  const [lastParsed, setLastParsed] = useState<any>(null);
  const [batchStats, setBatchStats] = useState<{
    n: number;
    ok: number;
    firstTryOk: number;
    repairedOk: number;
    failed: number;
    avgMs: number;
  } | null>(null);

  const ctxRef = useRef<LlamaContext | null>(null);

  useMemo(() => {
    registerPracticeItems();
    return null;
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

    if (info.exists && typeof info.size === "number" && info.size > 50_000_000) {
      return;
    }

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

  async function onGenerateValidatedMcq() {
    try {
      const ctx = ctxRef.current;
      if (!ctx) {
        Alert.alert("Not ready", "Initialize the context first.");
        return;
      }

      setOutput("");
      setLastError("");
      setLastParsed(null);
      setTimings(null);
      setBatchStats(null);

      setStatus("generating mcq…");

      const res = await generateValidatedMcq(ctx, setOutput);

      setOutput(res.rawText);
      setTimings(res.timings);

      if (res.ok) {
        setLastParsed(res.parsed);
        setStatus(res.attempts === 1 ? "valid ✅ (first try)" : "valid ✅ (repaired)");
      } else {
        setLastError(res.error);
        setStatus("invalid ❌");
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
      setLastError("");
      setLastParsed(null);
      setTimings(null);
      setBatchStats(null);

      const n = 20;
      setStatus(`batch generating (${n})…`);

      let ok = 0;
      let firstTryOk = 0;
      let repairedOk = 0;
      let failed = 0;
      const times: number[] = [];

      for (let i = 0; i < n; i++) {
        const t0 = Date.now();
        const res = await generateValidatedMcq(ctx, () => {});
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

          <Button onPress={onGenerateValidatedMcq}>Generate MCQ (validate+repair)</Button>
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

        {batchStats ? (
          <YStack gap="$1">
            <Text fontWeight="700">Batch Stats</Text>
            <Text selectable fontFamily="$mono" fontSize={12}>
              {JSON.stringify(batchStats, null, 2)}
            </Text>
          </YStack>
        ) : null}

        {lastError ? (
          <YStack gap="$1">
            <Text fontWeight="700">Validation Error</Text>
            <Text selectable fontFamily="$mono" fontSize={12}>
              {lastError}
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
