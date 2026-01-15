// shared/services/llm/LlmClient.ts
import { initLlama } from "llama.rn";

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

export class LlmClient {
  private ctx: Awaited<ReturnType<typeof initLlama>> | null = null;

  async init(modelUri: string) {
    if (this.ctx) return;

    this.ctx = await initLlama({
      model: modelUri,
      n_ctx: 2048,
      n_gpu_layers: 0,
      use_mlock: true,
    });
  }

  isReady() {
    return !!this.ctx;
  }

  async complete(
    params: LlmCompletionParams,
    onPartial?: (text: string) => void
  ): Promise<LlmCompletionResult> {
    if (!this.ctx) {
      throw new Error("LLM context not initialized");
    }

    let built = "";

    const result = await this.ctx.completion(params, (data: any) => {
      if (data?.token) {
        built += data.token;
        onPartial?.(built);
      }
    });

    return {
      text: String(result?.text ?? built ?? ""),
      timings: result?.timings,
    };
  }

  reset() {
    this.ctx = null;
  }
}
