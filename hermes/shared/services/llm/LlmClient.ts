// shared/services/llm/LlmClient.ts
import { initLlama } from "llama.rn";
import { Asset } from "expo-asset";

import {
  findFirstDownloadedModelUri,
  getActiveModelId,
  getActiveModelUri,
  getModelFileUri,
  modelFileExists,
} from "./modelStore";
import { getCloudApiKey } from "./cloudCredentials";
import {
  MODEL_CATALOG,
  cloudProviderLabel,
  isCloudModelCard,
  isLocalModelCard,
  type CloudModelCard,
} from "./modelCatalog";

export type LlmCompletionParams = {
  messages: { role: "system" | "user"; content: string }[];
  n_predict?: number;
  temperature?: number;
  stop?: string[];
};

export type LlmCompletionResult = {
  text: string;
  timings?: any;
};

export type LlmStatus =
  | { state: "idle" }
  | { state: "resolving_model" }
  | { state: "initializing" }
  | { state: "ready" }
  | { state: "error"; message: string };

export class LlmClient {
  /**
   * Optional bundled fallback. In Expo Go this likely won't be used (big models),
   */
  private static bundledModelModuleId: number | null = null;

  static configureBundledModel(moduleId: number) {
    LlmClient.bundledModelModuleId = moduleId;
  }

  private ctx: Awaited<ReturnType<typeof initLlama>> | null = null;
  private cloudConfig: { model: CloudModelCard; apiKey: string } | null = null;
  private status: LlmStatus = { state: "idle" };
  private initPromise: Promise<void> | null = null;

  getStatus(): LlmStatus {
    return this.status;
  }

  isReady(): boolean {
    return !!this.ctx || !!this.cloudConfig;
  }

  /**
   * Resolve the URI for a bundled model asset (if configured).
   */
  private async getBundledModelUri(): Promise<string | null> {
    if (!LlmClient.bundledModelModuleId) return null;

    this.status = { state: "resolving_model" };

    const asset = Asset.fromModule(LlmClient.bundledModelModuleId);
    await asset.downloadAsync();

    const uri = asset.localUri ?? asset.uri ?? null;
    return uri;
  }

  /**
   * Resolve a model URI in this order:
   * 1) Active downloaded/imported model (stored in modelStore)
   * 2) Bundled model fallback (if configured)
   */
  private async resolveBackend(): Promise<
    { mode: "cloud"; model: CloudModelCard; apiKey: string } | { mode: "local"; modelUri: string }
  > {
    this.status = { state: "resolving_model" };

    const activeModelId = await getActiveModelId();
    if (activeModelId) {
      const activeModel = MODEL_CATALOG.find((m) => m.id === activeModelId);
      if (activeModel && isCloudModelCard(activeModel)) {
        const apiKey = await getCloudApiKey(activeModel.provider);
        if (apiKey && apiKey.trim().length > 0) {
          return { mode: "cloud", model: activeModel, apiKey: apiKey.trim() };
        }
      }
      if (activeModel && isLocalModelCard(activeModel)) {
        const localUri = getModelFileUri(activeModel.filename);
        if (await modelFileExists(localUri)) {
          return { mode: "local", modelUri: localUri };
        }
      }
    }

    const activeUri = await getActiveModelUri();
    console.log("[llm] activeUri", activeUri);
    if (activeUri && (await modelFileExists(activeUri))) {
      console.log("[llm] using activeUri");
      return { mode: "local", modelUri: activeUri };
    }

    const downloadedUri = await findFirstDownloadedModelUri();
    console.log("[llm] downloadedUri", downloadedUri);
    if (downloadedUri && (await modelFileExists(downloadedUri))) {
      console.log("[llm] using downloadedUri");
      return { mode: "local", modelUri: downloadedUri };
    }

    const bundledUri = await this.getBundledModelUri();
    console.log("[llm] bundledUri", bundledUri);
    if (bundledUri) return { mode: "local", modelUri: bundledUri };

    throw new Error(
      "No model available. Download/import a local model, or configure a cloud model API key."
    );
  }

  /**
   * Ensure an initialized llama context exists. Safe to call repeatedly.
   */
  async ensureReady(): Promise<void> {
    if (this.ctx || this.cloudConfig) {
      this.status = { state: "ready" };
      return;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const backend = await this.resolveBackend();
        if (backend.mode === "cloud") {
          this.ctx = null;
          this.cloudConfig = { model: backend.model, apiKey: backend.apiKey };
          this.status = { state: "ready" };
          return;
        }

        const modelUri = backend.modelUri;
        console.log("[llm] resolved model uri", modelUri);

        this.status = { state: "initializing" };
        this.cloudConfig = null;
        await this.init(modelUri);

        this.status = { state: "ready" };
      } catch (e: any) {
        console.warn("[llm] init failed", e?.message ?? String(e));
        this.status = { state: "error", message: e?.message ?? String(e) };
        throw e;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Initialize llama context with a model URI.
   * Called by ensureReady() after resolving a URI.
   */
  async init(modelUri: string) {
    if (this.ctx) return;

    this.ctx = await initLlama({
      model: modelUri,
      n_ctx: 2048,
      n_gpu_layers: 0,
      use_mlock: true,
    });
  }

  async complete(
    params: LlmCompletionParams,
    onPartial?: (text: string) => void
  ): Promise<LlmCompletionResult> {
    if (this.cloudConfig) {
      return this.completeCloud(params, onPartial);
    }

    if (!this.ctx) {
      throw new Error("LLM context not initialized");
    }

    let built = "";
    const callback =
      typeof onPartial === "function"
        ? (data: any) => {
            if (data?.token) {
              built += data.token;
              onPartial(built);
            }
          }
        : undefined;

    const result = callback
      ? await this.ctx.completion(params, callback)
      : await this.ctx.completion(params);

    return {
      text: String(result?.text ?? built ?? ""),
      timings: result?.timings,
    };
  }

  private async completeCloud(
    params: LlmCompletionParams,
    onPartial?: (text: string) => void
  ): Promise<LlmCompletionResult> {
    if (!this.cloudConfig) {
      throw new Error("Cloud model not configured");
    }

    const { model, apiKey } = this.cloudConfig;
    const systemText = params.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n")
      .trim();

    const userContents = params.messages
      .filter((m) => m.role === "user")
      .map((m) => ({
        role: "user",
        parts: [{ text: m.content }],
      }));

    let text = "";

    if (model.provider === "google-gemini") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.remoteModelId)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(systemText
              ? { systemInstruction: { parts: [{ text: systemText }] } }
              : {}),
            contents:
              userContents.length > 0
                ? userContents
                : [{ role: "user", parts: [{ text: "Hello." }] }],
            generationConfig: {
              ...(typeof params.temperature === "number"
                ? { temperature: params.temperature }
                : {}),
              ...(typeof params.n_predict === "number"
                ? { maxOutputTokens: params.n_predict }
                : {}),
              ...(Array.isArray(params.stop) && params.stop.length > 0
                ? { stopSequences: params.stop }
                : {}),
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloud API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      text = String(
        data?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p?.text ?? "")
          .join("") ?? ""
      );
    } else if (model.provider === "mistral") {
      const mistralMessages = [
        ...(systemText ? [{ role: "system", content: systemText }] : []),
        ...params.messages
          .filter((m) => m.role === "user")
          .map((m) => ({ role: "user", content: m.content })),
      ];

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model.remoteModelId,
          messages: mistralMessages.length
            ? mistralMessages
            : [{ role: "user", content: "Hello." }],
          ...(typeof params.temperature === "number"
            ? { temperature: params.temperature }
            : {}),
          ...(typeof params.n_predict === "number"
            ? { max_tokens: params.n_predict }
            : {}),
          ...(Array.isArray(params.stop) && params.stop.length > 0
            ? { stop: params.stop }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloud API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string") {
        text = content;
      } else if (Array.isArray(content)) {
        text = content.map((c: any) => c?.text ?? "").join("");
      } else {
        text = "";
      }
    } else {
      throw new Error(`Unsupported cloud provider: ${cloudProviderLabel(model.provider)}`);
    }

    if (onPartial) onPartial(text);
    return { text };
  }

  reset() {
    this.ctx = null;
    this.cloudConfig = null;
    this.status = { state: "idle" };
    this.initPromise = null;
  }
}
