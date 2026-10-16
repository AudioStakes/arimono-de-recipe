import {
  maxAiRecipeBodyBytes,
  maxAiRecipePromptLength,
  maxAiRecipeResponseLength,
} from "../../src/ai-recipe-limits";

type Ai = {
  run: (model: string, input: unknown) => Promise<unknown>;
};

type PagesFunction<TEnv> = (context: {
  request: Request;
  env: TEnv;
}) => Response | Promise<Response>;

export interface Env {
  AI: Ai;
}

type RecipeRequestBody = {
  prompt: string;
};

type RecipeParsedBody = RecipeRequestBody;

type RecipeApiErrorCode =
  | "method_not_allowed"
  | "unsupported_media_type"
  | "forbidden_origin"
  | "invalid_json"
  | "invalid_prompt"
  | "invalid_request"
  | "prompt_too_long"
  | "body_too_large"
  | "ai_binding_unavailable"
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

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_PROMPT_LENGTH = maxAiRecipePromptLength;
const MAX_BODY_BYTES = maxAiRecipeBodyBytes;
const MAX_TOKENS = 1400;
const TEMPERATURE = 0.4;

const SYSTEM_MESSAGE = [
  "あなたは家庭料理に詳しい料理研究家です。",
  "ユーザーのレシピ依頼文に従い、安全性、再現性、日本語での分かりやすさを重視して回答してください。",
  "内部の推論や確認過程は出力しないでください。",
  "Markdownの見出しと箇条書きを使い、日本語で読みやすく回答してください。",
].join("\n");

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

  return { prompt };
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

  return "";
}

function extractUsage(result: unknown): unknown | null {
  if (!isRecord(result) || !("usage" in result)) {
    return null;
  }

  return result["usage"] ?? null;
}

export const onRequest: PagesFunction<Env> = async (context) => {
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

  if (!context.env.AI) {
    return errorResponse(500, "ai_binding_unavailable", "AI設定を確認してください。");
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

  try {
    const result = await context.env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_MESSAGE },
        { role: "user", content: body.prompt },
      ],
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

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
      model: MODEL,
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
