import type { AiModelId } from "../src/ai-models";

export const aiModelPolicies: Record<
  AiModelId,
  {
    contextTokens: number;
    inputNeuronsPerMillion: number;
    outputNeuronsPerMillion: number;
    outputParameter: "max_tokens" | "max_completion_tokens";
    chatTemplateKwargs?: { enable_thinking: false };
  }
> = {
  "@cf/meta/llama-3.1-8b-instruct-fp8": {
    contextTokens: 32000,
    inputNeuronsPerMillion: 13778,
    outputNeuronsPerMillion: 26128,
    outputParameter: "max_tokens",
  },
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": {
    contextTokens: 24000,
    inputNeuronsPerMillion: 26668,
    outputNeuronsPerMillion: 204805,
    outputParameter: "max_tokens",
  },
  "@cf/google/gemma-4-26b-a4b-it": {
    contextTokens: 256000,
    inputNeuronsPerMillion: 9091,
    outputNeuronsPerMillion: 27273,
    outputParameter: "max_completion_tokens",
    chatTemplateKwargs: { enable_thinking: false },
  },
  "openai/gpt-oss-20b": {
    contextTokens: 131072,
    inputNeuronsPerMillion: 0,
    outputNeuronsPerMillion: 0,
    outputParameter: "max_completion_tokens",
  },
};

export const aiMaxOutputTokens = 1400;
export const aiSystemMessage = [
  "あなたは家庭料理に詳しい料理研究家です。",
  "ユーザーのレシピ依頼文に従い、安全性、再現性、日本語での分かりやすさを重視して回答してください。",
  "内部の推論や確認過程は出力しないでください。",
  "Markdownの見出しと箇条書きを使い、日本語で読みやすく回答してください。",
].join("\n");
