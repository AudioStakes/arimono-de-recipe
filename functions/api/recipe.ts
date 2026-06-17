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

type RecipeApiErrorCode =
  | "method_not_allowed"
  | "unsupported_media_type"
  | "forbidden_origin"
  | "invalid_json"
  | "invalid_prompt"
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

const MODEL = "@cf/meta/llama-3.2-3b-instruct";
const MAX_PROMPT_LENGTH = 12000;
const MAX_BODY_BYTES = 32000;
const MAX_TOKENS = 1400;
const TEMPERATURE = 0.4;

const SYSTEM_MESSAGE = [
  "あなたは家庭料理に詳しい料理研究家です。",
  "ユーザーのレシピ依頼文に従い、安全性、再現性、日本語での分かりやすさを重視して回答してください。",
  "内部の推論や確認過程は出力しないでください。",
].join("\n");

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
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
  return typeof value === "object" && value !== null;
}

function isRecipeRequestBody(value: unknown): value is RecipeRequestBody {
  return isRecord(value) && typeof value["prompt"] === "string";
}

async function readRequestBody(request: Request): Promise<RecipeRequestBody | Response> {
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      return errorResponse(413, "body_too_large", "リクエスト本文が長すぎます。");
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json");
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

  const body = await readRequestBody(context.request);
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
    const recipe = extractRecipeText(result).trim();

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
  maxTokens: MAX_TOKENS,
  temperature: TEMPERATURE,
  model: MODEL,
} as const;
