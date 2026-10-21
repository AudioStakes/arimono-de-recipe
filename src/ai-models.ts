export const aiModels = [
  {
    id: "@cf/meta/llama-3.1-8b-instruct-fp8",
    label: "Llama 3.1 8B",
    provider: "cloudflare",
    recipient: "CloudflareのAI",
  },
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    label: "Llama 3.3 70B",
    provider: "cloudflare",
    recipient: "CloudflareのAI",
  },
  {
    id: "@cf/google/gemma-4-26b-a4b-it",
    label: "Gemma 4 26B",
    provider: "cloudflare",
    recipient: "CloudflareのAI",
  },
  { id: "openai/gpt-oss-20b", label: "GPT OSS 20B", provider: "groq", recipient: "GroqのAI" },
] as const;

export type AiModel = (typeof aiModels)[number];
export type AiModelId = AiModel["id"];
export const defaultAiModelId: AiModelId = "@cf/google/gemma-4-26b-a4b-it";

export function findAiModel(id: string): AiModel | undefined {
  return aiModels.find((model) => model.id === id);
}

export type AvailableAiModel = { id: AiModelId; enabled: boolean };

export const aiRequestLimits = { perMinute: 3, perDay: 10, globalPerDay: 100 } as const;
