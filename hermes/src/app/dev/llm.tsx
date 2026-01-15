// src/app/dev/llm.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  const example = [
    "{",
    '  "type": "mcq_v1.basic",',
    '  "mode": "reception",',
    '  "skills": ["reading"],',
    '  "conceptIds": [123],',
    '  "prompt": "Где находится банк?",',
    '  "choices": [',
    '    {"id":"A","text":"В школе"},',
    '    {"id":"B","text":"В банке"},',
    '    {"id":"C","text":"В парке"},',
    '    {"id":"D","text":"Дома"}',
    "  ],",
    '  "correctChoiceId": "B"',
    "}",
  ].join("\n");

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
    "- prompt and choices must be Russian (Cyrillic only; no Latin letters).",
    '- Use EXACTLY these choice ids: "A","B","C","D".',
    "- Keep the prompt under 10 words; each choice under 8 words.",
    "- conceptIds must be [123] exactly.",
    "",
    "Example valid output:",
    example,
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

function hasCyrillic(s: string) {
  return /[\u0400-\u04FF]/.test(s);
}

function hasLatin(s: string) {
  return /[A-Za-z]/.test(s);
}

function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function qualityCheckMcq(parsed: any): string[] {
  const issues: string[] = [];

  const prompt = normalizeWhitespace(String(parsed?.prompt ?? ""));
  if (prompt.length < 6) issues.push("prompt too short");
  if (!hasCyrillic(prompt)) issues.push("prompt missing Cyrillic");
  if (hasLatin(prompt)) issues.push("prompt contains Latin letters");
  if (prompt.split(" ").length > 10) issues.push("prompt too long for A1");

  const choices: Array<{ id?: unknown; text?: unknown }> = Array.isArray(parsed?.choices)
    ? (parsed.choices as Array<{ id?: unknown; text?: unknown }>)
    : [];
  if (choices.length !== 4) issues.push("choices must be exactly 4");

  const ids = choices.map((c: { id?: unknown }) => String(c?.id ?? ""));
  const texts = choices.map((c: { text?: unknown }) =>
    normalizeWhitespace(String(c?.text ?? ""))
  );

  const expectedIds = ["A", "B", "C", "D"];
  for (const id of expectedIds) {
    if (!ids.includes(id)) issues.push(`missing choice id "${id}"`);
  }
  for (const id of ids) {
    if (!expectedIds.includes(id)) issues.push(`unexpected choice id "${id}"`);
  }

  const uniqueTexts = new Set(texts.map((t: string) => t.toLowerCase()));
  if (uniqueTexts.size !== texts.length) issues.push("choices contain duplicates");

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    const id = ids[i] || String(i);

    if (t.length < 1) issues.push(`choice ${id} is empty`);
    if (!hasCyrillic(t)) issues.push(`choice ${id} missing Cyrillic`);
    if (hasLatin(t)) issues.push(`choice ${id} contains Latin letters`);
    if (t.split(" ").length > 8) issues.push(`choice ${id} too long for A1`);
  }

  const correct = String(parsed?.correctChoiceId ?? "");
  if (!expectedIds.includes(correct)) issues.push("correctChoiceId must be A/B/C/D");

  const correctChoice = choices.find(
    (c: { id?: unknown }) => String(c?.id ?? "") === correct
  );
  if (!correctChoice) issues.push("correctChoiceId does not match any choice id");

  const correctText = normalizeWhitespace(String(correctChoice?.text ?? "")).toLowerCase();
  const distractors = choices
    .filter((c: { id?: unknown }) => String(c?.id ?? "") !== correct)
    .map((c: { text?: unknown }) => normalizeWhitespace(String(c?.text ?? "")).toLowerCase());

  if (correctChoice && distractors.some((d: string) => d === correctText)) {
    issues.push("a distractor matches the correct answer text");
  }

  return issues;
}


function formatQualityIssues(issues: string[]) {
  return issues.map((s) => `- ${s}`).join("\n");
}

async function generateValidatedMcq(
  ctx: any,
  setOutput: (s: string) => void
): Promise<
  | {
      ok: true;
      rawText: string;
      parsed: any;
      attempts: number;
      timings?: any;
      qualityIssues: string[];
    }
  | {
      ok: false;
      rawText: string;
      error: string;
      attempts: number;
      timings?: any;
      qualityIssues: string[];
    }
> {
  const { system, user } = buildMcqPrompt();

  let rawText = "";
  let timings: any = null;
  let jsonStr = "";
  let lastError = "";
  let lastQualityIssues: string[] = [];
  let hadParsableJson = false;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const msg =
      attempt === 1 || !rawText
        ? [
            { role: "system", content: system },
            { role: "user", content: user },
          ]
        : [
            { role: "system", content: system },
            {
              role: "user",
              content:
                "Fix the JSON to satisfy BOTH structure and quality requirements. Return ONLY corrected JSON.\n\n" +
                (hadParsableJson
                  ? `Current JSON:\n${jsonStr}\n\n`
                  : `Previous output (may be invalid):\n${rawText}\n\n`) +
                (lastError ? `Structure/validation errors:\n${lastError}\n\n` : "") +
                (lastQualityIssues.length
                  ? `Quality issues:\n${formatQualityIssues(lastQualityIssues)}\n\n`
                  : "") +
                "Requirements reminder:\n" +
                '- JSON only, double quotes, no trailing commas\n' +
                '- type="mcq_v1.basic", mode="reception", skills=["reading"], conceptIds=[123]\n' +
                '- choices must be 4 with ids A/B/C/D, and correctChoiceId must match one of them\n' +
                "- Russian only (Cyrillic), no Latin letters\n" +
                "- Short A1 phrasing",
            },
          ];

    const r = await completionToText(
      ctx,
      {
        messages: msg,
        n_predict: 260,
        temperature: attempt === 1 ? 0.4 : 0.2,
        stop: STOP_WORDS,
      },
      setOutput
    );

    rawText = r.text;
    timings = r.timings;
    jsonStr = extractLikelyJson(rawText) ?? rawText;

    let parsed: any = null;

    try {
      parsed = JSON.parse(jsonStr);
      hadParsableJson = true;
    } catch (e: any) {
      hadParsableJson = false;
      lastQualityIssues = [];
      lastError = `JSON parse error: ${e?.message ?? String(e)}`;
      continue;
    }

    try {
      practiceItemRegistry.create(parsed);
    } catch (e: any) {
      lastQualityIssues = [];
      lastError = e instanceof z.ZodError ? formatZodError(e) : e?.message ?? String(e);
      continue;
    }

    const qIssues = qualityCheckMcq(parsed);
    lastQualityIssues = qIssues;

    if (qIssues.length === 0) {
      return { ok: true, rawText, parsed, attempts: attempt, timings, qualityIssues: qIssues };
    }

    lastError = "";
  }

  const error = lastError || (lastQualityIssues.length ? "quality check failed" : "unknown error");
  return {
    ok: false,
    rawText,
    error,
    attempts: 3,
    timings,
    qualityIssues: lastQualityIssues,
  };
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
  const [lastQualityIssues, setLastQualityIssues] = useState<string[]>([]);
  const [lastQualityOk, setLastQualityOk] = useState<boolean | null>(null);

  const [batchStats, setBatchStats] = useState<{
    n: number;
    ok: number;
    firstTryOk: number;
    repairedOk: number;
    qualityOk: number;
    failed: number;
    avgMs: number;
  } | null>(null);

  const ctxRef = useRef<LlamaContext | null>(null);

  useEffect(() => {
    registerPracticeItems();
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

  async function onGenerateValidatedMcq() {
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

      const res = await generateValidatedMcq(ctx, setOutput);

      setOutput(res.rawText);
      setTimings(res.timings);
      setLastQualityIssues(res.qualityIssues);
      setLastQualityOk(res.ok && res.qualityIssues.length === 0);

      if (res.ok) {
        setLastParsed(res.parsed);
        setLastError("");
        setStatus(res.attempts === 1 ? "valid ✅ (first try)" : `valid ✅ (attempt ${res.attempts})`);
      } else {
        setLastParsed(null);
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
      setBatchStats(null);

      setLastError("");
      setLastParsed(null);
      setLastQualityIssues([]);
      setLastQualityOk(null);

      const n = 20;
      setStatus(`batch generating (${n})…`);

      let ok = 0;
      let firstTryOk = 0;
      let repairedOk = 0;
      let qualityOk = 0;
      let failed = 0;
      const times: number[] = [];

      for (let i = 0; i < n; i++) {
        const t0 = Date.now();
        const res = await generateValidatedMcq(ctx, () => {});
        times.push(Date.now() - t0);

        if (res.ok) {
          ok += 1;
          qualityOk += 1;
          if (res.attempts === 1) firstTryOk += 1;
          else repairedOk += 1;
        } else {
          failed += 1;
        }
      }

      const avgMs = Math.round(times.reduce((a, b) => a + b, 0) / Math.max(times.length, 1));
      setBatchStats({ n, ok, firstTryOk, repairedOk, qualityOk, failed, avgMs });
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

          <Button onPress={onGenerateValidatedMcq}>Generate MCQ (validate+quality)</Button>
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
