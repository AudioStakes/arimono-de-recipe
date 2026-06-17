import { parseAiRecipeCandidatesResponse } from "./ai-recipe-schema";
import type { AiRecipeCandidateRequest, AiRecipeCandidatesResponse } from "./types";

export type GenerateRecipeSuccess = {
  ok: true;
  candidates: AiRecipeCandidatesResponse;
  model: string;
  usage: unknown | null;
};

export type GenerateRecipeFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type GenerateRecipeResult = GenerateRecipeSuccess | GenerateRecipeFailure;

const maxAiRecipeRequestBodyLength = 2400;

type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

type ApiSuccessResponse = {
  items: unknown;
  model: string;
  usage: unknown | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  isRecord(value) &&
  isRecord(value["error"]) &&
  typeof value["error"]["code"] === "string" &&
  typeof value["error"]["message"] === "string";

const isApiSuccessResponse = (value: unknown): value is ApiSuccessResponse =>
  isRecord(value) &&
  Array.isArray(value["items"]) &&
  typeof value["model"] === "string" &&
  ("usage" in value ? value["usage"] === null || value["usage"] !== undefined : false);

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function generateRecipe(
  request: AiRecipeCandidateRequest,
  fetcher: typeof fetch = fetch,
): Promise<GenerateRecipeResult> {
  const body = JSON.stringify(request);
  if (body.length > maxAiRecipeRequestBodyLength) {
    return {
      ok: false,
      error: {
        code: "request_too_long",
        message: "AIへの依頼条件が長すぎます。内容を短くしてください。",
      },
    };
  }

  let response: Response;

  try {
    response = await fetcher("/api/recipe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
    });
  } catch {
    return {
      ok: false,
      error: {
        code: "network_error",
        message: "AIへの接続に失敗しました。",
      },
    };
  }

  const payload = await readJson(response);

  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      return {
        ok: false,
        error: payload.error,
      };
    }

    return {
      ok: false,
      error: {
        code: "api_error",
        message: "AIへの依頼に失敗しました。",
      },
    };
  }

  if (!isApiSuccessResponse(payload)) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        message: "AIからの応答形式を確認できませんでした。",
      },
    };
  }

  const parsedCandidates = parseAiRecipeCandidatesResponse(payload);
  if (!parsedCandidates.ok) {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        message: "AIからの応答形式を確認できませんでした。",
      },
    };
  }

  return {
    ok: true,
    candidates: parsedCandidates.value,
    model: payload.model,
    usage: payload.usage,
  };
}
