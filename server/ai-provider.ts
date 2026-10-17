import { type AiModel, type AvailableAiModel, aiModels, aiRequestLimits } from "../src/ai-models";
import { aiMaxOutputTokens, aiModelPolicies, aiSystemMessage } from "./ai-model-policy";
import {
  requesterUsageKey,
  reserveUsage,
  type UsageBucket,
  type UsageDatabase,
  type UsageReservation,
} from "./ai-usage";

export type AiProviderEnvironment = {
  AI: { run(model: string, input: unknown): Promise<unknown> };
  AI_USAGE?: UsageDatabase;
  AI_USAGE_SECRET?: string;
  CLOUDFLARE_FREE_ONLY?: string;
  GROQ_FREE_ONLY?: string;
  GROQ_API_KEY?: string;
};

export function modelAvailability(env: AiProviderEnvironment): AvailableAiModel[] {
  const usageReady = Boolean(
    env.AI_USAGE &&
      env.AI_USAGE_SECRET &&
      env.AI_USAGE_SECRET.length >= 32 &&
      env.CLOUDFLARE_FREE_ONLY === "true",
  );
  return aiModels.map((model) => ({
    id: model.id,
    enabled:
      usageReady &&
      (model.provider === "cloudflare"
        ? Boolean(env.AI && env.CLOUDFLARE_FREE_ONLY === "true")
        : Boolean(env.GROQ_API_KEY && env.GROQ_FREE_ONLY === "true")),
  }));
}

export async function reserveRecipeUsage(
  request: Request,
  env: AiProviderEnvironment,
  model: AiModel,
  prompt: string,
  now = Math.floor(Date.now() / 1000),
): Promise<UsageReservation | "prompt_limit"> {
  if (!env.AI_USAGE || !modelAvailability(env).find((entry) => entry.id === model.id)?.enabled)
    return "unavailable";
  const day = Math.floor(now / 86400);
  const minute = Math.floor(now / 60);
  const identity = await requesterUsageKey(request, env.AI_USAGE_SECRET, day);
  if (!identity) return "unavailable";
  // These are byte-based upper estimates plus template allowance, not chars / 4.
  // Provider Free-plan enforcement remains the final no-billing boundary.
  const inputBound =
    new TextEncoder().encode(aiSystemMessage + prompt).byteLength +
    (model.provider === "groq" ? 512 : 2048);
  const tokens = inputBound + aiMaxOutputTokens;
  const policy = aiModelPolicies[model.id];
  if (tokens > policy.contextTokens) return "prompt_limit";
  if (model.provider === "groq" && tokens > 7800) return "prompt_limit";
  const endDay = (day + 1) * 86400;
  const endMinute = (minute + 1) * 60;
  const buckets: UsageBucket[] = [
    {
      key: `network-minute:${identity}:${minute}`,
      amount: 1,
      limit: aiRequestLimits.perMinute,
      expiresAt: endMinute,
    },
    {
      key: `network-day:${identity}:${day}`,
      amount: 1,
      limit: aiRequestLimits.perDay,
      expiresAt: endDay,
    },
    { key: `global-day:${day}`, amount: 1, limit: aiRequestLimits.globalPerDay, expiresAt: endDay },
  ];
  if (model.provider === "cloudflare") {
    const neurons = Math.ceil(
      ((inputBound * policy.inputNeuronsPerMillion +
        aiMaxOutputTokens * policy.outputNeuronsPerMillion) *
        11) /
        10_000_000,
    );
    buckets.push({
      key: `cloudflare-neurons:${day}`,
      amount: neurons,
      limit: 9000,
      expiresAt: endDay,
    });
  } else {
    buckets.push(
      { key: `groq-minute-requests:${minute}`, amount: 1, limit: 25, expiresAt: endMinute },
      { key: `groq-minute-tokens:${minute}`, amount: tokens, limit: 7800, expiresAt: endMinute },
      { key: `groq-day-tokens:${day}`, amount: tokens, limit: 180000, expiresAt: endDay },
    );
  }
  return reserveUsage(env.AI_USAGE, buckets, now);
}

export async function generateWithModel(
  env: AiProviderEnvironment,
  model: AiModel,
  prompt: string,
): Promise<unknown> {
  const policy = aiModelPolicies[model.id];
  const input = {
    messages: [
      { role: "system", content: aiSystemMessage },
      { role: "user", content: prompt },
    ],
    [policy.outputParameter]: aiMaxOutputTokens,
    ...(policy.chatTemplateKwargs ? { chat_template_kwargs: policy.chatTemplateKwargs } : {}),
    temperature: 0.4,
  };
  if (model.provider === "cloudflare") return env.AI.run(model.id, input);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      ...input,
      model: model.id,
      reasoning_effort: "low",
      include_reasoning: false,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error("AI provider unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing AI response");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128000) {
        void reader.cancel().catch(() => undefined);
        throw new Error("AI response too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    const payload: unknown = JSON.parse(text + decoder.decode());
    if (typeof payload !== "object" || payload === null) throw new Error("Invalid AI response");
    return payload;
  } finally {
    reader.releaseLock();
  }
}
