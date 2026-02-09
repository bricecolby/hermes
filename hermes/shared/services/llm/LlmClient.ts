// shared/services/llm/LlmClient.ts
import { initLlama } from "llama.rn";
import { Asset } from "expo-asset";

import { getActiveModelUri, modelFileExists, findFirstDownloadedModelUri } from "./modelStore";

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
  private status: LlmStatus = { state: "idle" };
  private initPromise: Promise<void> | null = null;

  getStatus(): LlmStatus {
    return this.status;
  }

  isReady(): boolean {
    return !!this.ctx;
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
  private async resolveModelUri(): Promise<string> {
    this.status = { state: "resolving_model" };

    const activeUri = await getActiveModelUri();
    console.log("[llm] activeUri", activeUri);
    if (activeUri && (await modelFileExists(activeUri))) {
      console.log("[llm] using activeUri");
      return activeUri;
    }

    const downloadedUri = await findFirstDownloadedModelUri();
    console.log("[llm] downloadedUri", downloadedUri);
    if (downloadedUri && (await modelFileExists(downloadedUri))) {
      console.log("[llm] using downloadedUri");
      return downloadedUri;
    }

    const bundledUri = await this.getBundledModelUri();
    console.log("[llm] bundledUri", bundledUri);
    if (bundledUri) return bundledUri;

    throw new Error(
      "No local model available. Download/import a model first, or configure a bundled model for production."
    );
  }

  /**
   * Ensure an initialized llama context exists. Safe to call repeatedly.
   */
  async ensureReady(): Promise<void> {
    if (this.ctx) {
      this.status = { state: "ready" };
      return;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const modelUri = await this.resolveModelUri();
        console.log("[llm] resolved model uri", modelUri);

        this.status = { state: "initializing" };
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

  reset() {
    this.ctx = null;
    this.status = { state: "idle" };
    this.initPromise = null;
  }
}
