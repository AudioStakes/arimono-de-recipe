import {
  buildCompactRecipeCandidateInput,
  isAiRecipeCandidateRequest,
  parseAiRecipeCandidateRequest,
  parseAiRecipeCandidatesModelOutput,
  validateAiRecipeCandidatesForRequest,
} from "../../src/ai-recipe-schema";
import type { AiRecipeCandidateRequest } from "../../src/types";

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

type RecipeParsedBody =
  | {
      kind: "legacy";
      prompt: string;
    }
  | {
      kind: "candidates";
      request: AiRecipeCandidateRequest;
    };

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

const LEGACY_MODEL = "@cf/meta/llama-3.2-3b-instruct";
const CANDIDATE_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_PROMPT_LENGTH = 12000;
const MAX_BODY_BYTES = 32000;
const LEGACY_MAX_TOKENS = 1400;
const CANDIDATE_MAX_TOKENS = 1000;
const TEMPERATURE = 0.4;

const LEGACY_SYSTEM_MESSAGE = [
  "あなたは家庭料理に詳しい料理研究家です。",
  "ユーザーのレシピ依頼文に従い、安全性、再現性、日本語での分かりやすさを重視して回答してください。",
  "内部の推論や確認過程は出力しないでください。",
].join("\n");

const CANDIDATE_SYSTEM_MESSAGE = [
  "You generate Japanese home-cooking recipe candidates.",
  "Return only JSON matching the response_format schema.",
  "Input m means available ingredients. Input rq means required ingredients that every candidate must use. Input tl means cooking tools. Input ng means avoid list.",
  "Main ingredients must come from m.",
  "Return exactly 3 items.",
  "Input keys: m materials, rq required materials, sv servings, t time, d direction, tl tools, ng avoid, n notes.",
  "Obey n constraints such as 必須 and 使切.",
  "Every output item must include every rq ingredient in use and ing.",
  "Output use must be ingredient names copied from m only. Never put tl tools in use.",
  "Output miss must be missing ingredient names only. Never put ng avoid items in miss.",
  "Output ing must contain only m ingredients, miss ingredients, or basic pantry seasonings.",
  "steps must be plain short Japanese strings, not objects.",
  "Use at most 4 badges.",
].join("\n");

const CANDIDATE_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "time", "badges", "use", "miss", "why", "ing", "steps"],
          properties: {
            id: {
              type: "string",
              enum: ["a", "b", "c"],
            },
            title: {
              type: "string",
              maxLength: 32,
            },
            time: {
              type: "integer",
              minimum: 1,
              maximum: 240,
            },
            badges: {
              type: "array",
              maxItems: 4,
              items: {
                type: "string",
                enum: [
                  "no_shop",
                  "miss_optional",
                  "quick",
                  "easy",
                  "uses_up",
                  "few_dishes",
                  "kids",
                ],
              },
            },
            use: {
              type: "array",
              description:
                "Available ingredient names used by this recipe. Values must be copied from input m, not tools.",
              minItems: 1,
              maxItems: 12,
              items: {
                type: "string",
                maxLength: 48,
              },
            },
            miss: {
              type: "array",
              description:
                "Missing ingredient names only. Do not include avoid items from ng or cooking tools from tl.",
              maxItems: 6,
              items: {
                type: "string",
                maxLength: 48,
              },
            },
            why: {
              type: "string",
              maxLength: 80,
            },
            ing: {
              type: "array",
              description:
                "Recipe ingredients. Use available m ingredients, miss ingredients, or basic pantry seasonings only.",
              minItems: 1,
              maxItems: 6,
              items: {
                type: "string",
                maxLength: 48,
              },
            },
            steps: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: {
                type: "string",
                maxLength: 60,
              },
            },
          },
        },
      },
    },
  },
} as const;

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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecipeRequestBody(value: unknown): value is RecipeRequestBody {
  return isRecord(value) && typeof value["prompt"] === "string";
}

function parseRequestPayload(payload: unknown): RecipeParsedBody | Response {
  if (isAiRecipeCandidateRequest(payload)) {
    const parsedRequest = parseAiRecipeCandidateRequest(payload);
    if (!parsedRequest.ok) {
      return errorResponse(400, "invalid_request", "AI候補の依頼条件を確認してください。");
    }
    return {
      kind: "candidates",
      request: parsedRequest.value,
    };
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

  return { kind: "legacy", prompt };
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

function extractCandidateOutput(result: unknown): unknown {
  if (!isRecord(result)) {
    return result;
  }

  const output = result as WorkersAiTextResult;
  return output.response ?? output.text ?? output.result ?? result;
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

  const body = await readParsedRequestBody(context.request);
  if (body instanceof Response) {
    return body;
  }

  try {
    const result =
      body.kind === "legacy"
        ? await context.env.AI.run(LEGACY_MODEL, {
            messages: [
              { role: "system", content: LEGACY_SYSTEM_MESSAGE },
              { role: "user", content: body.prompt },
            ],
            max_tokens: LEGACY_MAX_TOKENS,
            temperature: TEMPERATURE,
          })
        : await context.env.AI.run(CANDIDATE_MODEL, {
            messages: [
              { role: "system", content: CANDIDATE_SYSTEM_MESSAGE },
              {
                role: "user",
                content: `r=${buildCompactRecipeCandidateInput(body.request)}`,
              },
            ],
            max_tokens: CANDIDATE_MAX_TOKENS,
            temperature: TEMPERATURE,
            response_format: CANDIDATE_RESPONSE_FORMAT,
          });

    if (body.kind === "candidates") {
      const candidates = parseAiRecipeCandidatesModelOutput(extractCandidateOutput(result));
      if (!candidates.ok) {
        return errorResponse(500, "ai_generation_failed", "AIからレシピ案を取得できませんでした。");
      }
      const validatedCandidates = validateAiRecipeCandidatesForRequest(
        candidates.value,
        body.request,
      );
      if (!validatedCandidates.ok) {
        return errorResponse(500, "ai_generation_failed", "AIからレシピ案を取得できませんでした。");
      }

      return jsonResponse({
        ...validatedCandidates.value,
        model: CANDIDATE_MODEL,
        usage: extractUsage(result),
      });
    }

    const recipe = extractRecipeText(result).trim();

    if (!recipe) {
      return errorResponse(500, "ai_generation_failed", "AIからレシピ案を取得できませんでした。");
    }

    return jsonResponse({
      recipe,
      model: LEGACY_MODEL,
      usage: extractUsage(result),
    });
  } catch {
    return errorResponse(500, "ai_generation_failed", "AIへの依頼に失敗しました。");
  }
};

export const recipeFunctionLimits = {
  maxPromptLength: MAX_PROMPT_LENGTH,
  maxBodyBytes: MAX_BODY_BYTES,
  maxTokens: CANDIDATE_MAX_TOKENS,
  legacyMaxTokens: LEGACY_MAX_TOKENS,
  candidateMaxTokens: CANDIDATE_MAX_TOKENS,
  temperature: TEMPERATURE,
  model: LEGACY_MODEL,
  legacyModel: LEGACY_MODEL,
  candidateModel: CANDIDATE_MODEL,
} as const;
