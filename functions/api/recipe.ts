import { aiMaxOutputTokens } from "../../server/ai-model-policy";
import {
  type AiProviderEnvironment,
  generateWithModel,
  modelAvailability,
  reserveRecipeUsage,
} from "../../server/ai-provider";
import {
  type AiModelId,
  aiRequestLimits,
  defaultAiModelId,
  findAiModel,
} from "../../src/ai-models";
import {
  maxAiRecipeBodyBytes,
  maxAiRecipePromptLength,
  maxAiRecipeResponseLength,
} from "../../src/ai-recipe-limits";

type PagesFunction<TEnv> = (context: {
  request: Request;
  env: TEnv;
}) => Response | Promise<Response>;

export type Env = AiProviderEnvironment;

type RecipeRequestBody = {
  prompt: string;
  model?: unknown;
};

type RecipeParsedBody = { prompt: string; model: AiModelId };

type RecipeApiErrorCode =
  | "method_not_allowed"
  | "unsupported_media_type"
  | "forbidden_origin"
  | "invalid_json"
  | "invalid_prompt"
  | "invalid_request"
  | "prompt_too_long"
  | "body_too_large"
  | "invalid_model"
  | "model_unavailable"
  | "usage_limit_reached"
  | "usage_unavailable"
  | "ai_generation_failed";

type RecipeApiError = {
  error: {
    code: RecipeApiErrorCode;
    message: string;
  };
};

type WorkersAiTextResult = {
  response?: unknown;
  text?: unknown;
  result?: unknown;
  usage?: unknown;
};

const MODEL = defaultAiModelId;
const MAX_PROMPT_LENGTH = maxAiRecipePromptLength;
const MAX_BODY_BYTES = maxAiRecipeBodyBytes;
const MAX_TOKENS = aiMaxOutputTokens;
const TEMPERATURE = 0.4;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return Response.json(body, {
    ...init,
    headers,
  });
}

function errorResponse(
  status: number,
  code: RecipeApiErrorCode,
  message: string,
  headers?: HeadersInit,
): Response {
  const init: ResponseInit = headers ? { status, headers } : { status };
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
    } satisfies RecipeApiError,
    init,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecipeRequestBody(value: unknown): value is RecipeRequestBody {
  return isRecord(value) && typeof value["prompt"] === "string";
}

function parseRequestPayload(payload: unknown): RecipeParsedBody | Response {
  if (!isRecipeRequestBody(payload)) {
    return errorResponse(400, "invalid_prompt", "promptを文字列で指定してください。");
  }

  const prompt = payload.prompt.trim();
  if (!prompt) {
    return errorResponse(400, "invalid_prompt", "promptを入力してください。");
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return errorResponse(413, "prompt_too_long", "promptが長すぎます。内容を短くしてください。");
  }

  const model = payload.model === undefined ? MODEL : payload.model;
  const selected = typeof model === "string" ? findAiModel(model) : undefined;
  if (!selected) {
    return errorResponse(400, "invalid_model", "利用できるAIモデルを選択してください。");
  }
  return { prompt, model: selected.id };
}

async function readParsedRequestBody(request: Request): Promise<RecipeParsedBody | Response> {
  const text = await readRequestText(request);
  if (text instanceof Response) {
    return text;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return errorResponse(400, "invalid_json", "JSONを読み取れませんでした。");
  }

  return parseRequestPayload(payload);
}

async function readRequestText(request: Request): Promise<string | Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return errorResponse(413, "body_too_large", "リクエスト本文が長すぎます。");
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        // Cancellation may never settle; rejecting an oversized body must not wait for it.
        void reader.cancel().catch(() => undefined);
        return errorResponse(413, "body_too_large", "リクエスト本文が長すぎます。");
      }
      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.split(";", 1)[0]?.trim() === "application/json";
}

function hasAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function extractRecipeText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (!isRecord(result)) {
    return "";
  }

  const output = result as WorkersAiTextResult;
  if (typeof output.response === "string") {
    return output.response;
  }
  if (typeof output.text === "string") {
    return output.text;
  }
  if (typeof output.result === "string") {
    return output.result;
  }

  const choices = result["choices"];
  const first: unknown = Array.isArray(choices) ? choices[0] : null;
  const message = isRecord(first) ? first["message"] : null;
  if (isRecord(message) && typeof message["content"] === "string") return message["content"];

  return "";
}

function extractUsage(result: unknown): unknown | null {
  if (!isRecord(result) || !("usage" in result)) {
    return null;
  }

  const usage = result["usage"];
  if (!isRecord(usage)) return null;
  const allowed = [
    "input_tokens",
    "output_tokens",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
  ];
  const entries = allowed.flatMap((key) => {
    const value = usage[key];
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
      ? [[key, value]]
      : [];
  });
  return entries.length ? Object.fromEntries(entries) : null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method === "GET" && new URL(context.request.url).searchParams.has("models")) {
    return jsonResponse({ models: modelAvailability(context.env), limits: aiRequestLimits });
  }
  if (context.request.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "POSTでリクエストしてください。", {
      allow: "POST",
    });
  }

  if (!hasAllowedOrigin(context.request)) {
    return errorResponse(403, "forbidden_origin", "許可されていない送信元です。");
  }

  if (!hasJsonContentType(context.request)) {
    return errorResponse(415, "unsupported_media_type", "JSONでリクエストしてください。");
  }

  let body: RecipeParsedBody | Response;
  try {
    body = await readParsedRequestBody(context.request);
  } catch {
    return errorResponse(400, "invalid_request", "リクエスト本文を読み取れませんでした。");
  }
  if (body instanceof Response) {
    return body;
  }

  const model = findAiModel(body.model);
  if (!model || !modelAvailability(context.env).find((entry) => entry.id === model.id)?.enabled) {
    return errorResponse(
      503,
      "model_unavailable",
      "このAIは現在利用できません。別のモデルを選ぶか、依頼文をコピーしてください。",
    );
  }
  try {
    const reservation = await reserveRecipeUsage(context.request, context.env, model, body.prompt);
    if (reservation === "prompt_limit")
      return errorResponse(
        413,
        "prompt_too_long",
        "このモデルの入力上限を超えています。条件を短くするか、別のモデルを選択してください。",
      );
    if (reservation === "limited")
      return errorResponse(
        429,
        "usage_limit_reached",
        "利用上限に達しました。時間をおくか、依頼文をコピーして普段使うAIへ貼り付けてください。",
        { "retry-after": "60" },
      );
    if (reservation !== "reserved")
      return errorResponse(
        503,
        "usage_unavailable",
        "利用上限を確認できないため送信を停止しています。依頼文はコピーできます。",
      );
    const result = await generateWithModel(context.env, model, body.prompt);

    const rawRecipe = extractRecipeText(result);
    if (rawRecipe.length > maxAiRecipeResponseLength) {
      return errorResponse(
        500,
        "ai_generation_failed",
        "AIの回答が長すぎます。依頼文をコピーして別のAIへ相談できます。",
      );
    }
    const recipe = rawRecipe.trim();

    if (!recipe) {
      return errorResponse(500, "ai_generation_failed", "AIからレシピ案を取得できませんでした。");
    }

    return jsonResponse({
      recipe,
      model: model.id,
      usage: extractUsage(result),
    });
  } catch {
    return errorResponse(500, "ai_generation_failed", "AIへの依頼に失敗しました。");
  }
};

export const recipeFunctionLimits = {
  maxPromptLength: MAX_PROMPT_LENGTH,
  maxBodyBytes: MAX_BODY_BYTES,
  maxResponseLength: maxAiRecipeResponseLength,
  maxTokens: MAX_TOKENS,
  temperature: TEMPERATURE,
  model: MODEL,
};
