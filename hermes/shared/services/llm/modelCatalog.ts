export type ModelPurpose = "chat" | "tts" | "stt";

export type ModelCard = {
  id: string;
  name: string;
  description: string;
  sizeLabel: string;
  url: string;
  filename: string;
  minFreeBytes: number;
  purposes: ModelPurpose[];
};

export const MODEL_CATALOG: ModelCard[] = [
  {
    id: "qwen2.5-3b-instruct-q4_k_m",
    name: "Qwen 2.5 3B Instruct (Q4_K_M)",
    description:
      "Balanced quality and speed for general chat. Good default model for mobile devices.",
    sizeLabel: "≈ 2–3 GB",
    url: "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf",
    filename: "qwen2.5-3b-instruct-q4_k_m.gguf",
    minFreeBytes: 4_000_000_000,
    purposes: ["chat"],
  },
];
