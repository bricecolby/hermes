export type ModelPurpose = "chat" | "tts" | "stt";

type BaseModelCard = {
  id: string;
  name: string;
  description: string;
  sizeLabel: string;
  purposes: ModelPurpose[];
};

export type LocalModelCard = BaseModelCard & {
  delivery: "local-download";
  url: string;
  filename: string;
  minFreeBytes: number;
};

export type CloudProvider = "google-gemini" | "mistral";

export type CloudModelCard = BaseModelCard & {
  delivery: "cloud-api";
  provider: CloudProvider;
  remoteModelId: string;
  setupUrl: string;
};

export type ModelCard = LocalModelCard | CloudModelCard;

export function isLocalModelCard(model: ModelCard): model is LocalModelCard {
  return model.delivery === "local-download";
}

export function isCloudModelCard(model: ModelCard): model is CloudModelCard {
  return model.delivery === "cloud-api";
}

export function cloudProviderLabel(provider: CloudProvider): string {
  if (provider === "google-gemini") return "Google Gemini";
  return "Mistral";
}

export const MODEL_CATALOG: ModelCard[] = [
  {
    id: "qwen2.5-0.5b-instruct-q4_k_m",
    delivery: "local-download",
    name: "Qwen 2.5 0.5B Instruct (Q4_K_M)",
    description:
      "Smallest local instruct model option for low-memory devices and emulators.",
    sizeLabel: "≈ 0.5–0.7 GB",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    filename: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    minFreeBytes: 1_500_000_000,
    purposes: ["chat"],
  },
  {
    id: "qwen2.5-3b-instruct-q4_k_m",
    delivery: "local-download",
    name: "Qwen 2.5 3B Instruct (Q4_K_M)",
    description:
      "Balanced quality and speed for general chat. Good default model for mobile devices.",
    sizeLabel: "≈ 2–3 GB",
    url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
    minFreeBytes: 4_000_000_000,
    purposes: ["chat"],
  },
  {
    id: "gemini-2.5-flash",
    delivery: "cloud-api",
    provider: "google-gemini",
    remoteModelId: "gemini-2.5-flash",
    name: "Google Gemini 2.5 Flash (Cloud)",
    description:
      "Cloud model on Google's API free tier. No local download required; add your API key.",
    sizeLabel: "No download",
    setupUrl: "https://aistudio.google.com/apikey",
    purposes: ["chat"],
  },
  {
    id: "mistral-small-latest",
    delivery: "cloud-api",
    provider: "mistral",
    remoteModelId: "mistral-small-latest",
    name: "Mistral Small (Cloud)",
    description:
      "Balanced low-latency general model for multilingual chat and structured JSON outputs.",
    sizeLabel: "No download",
    setupUrl: "https://console.mistral.ai/api-keys",
    purposes: ["chat"],
  },
];
