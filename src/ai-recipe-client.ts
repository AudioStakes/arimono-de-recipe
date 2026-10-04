import { maxAiRecipeBodyBytes, maxAiRecipePromptLength } from "./ai-recipe-limits";
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

export type GeneratePromptRecipeResult =
  | { ok: true; recipe: string; model: string; usage: unknown | null }
  | GenerateRecipeFailure;

const maxAiRecipeRequestBodyLength = 2400;
export const aiRecipeRequestTimeoutMs = 30_000;

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

  return postRecipe(body, readRecipeResponse, fetcher);
}

export async function generateRecipeFromPrompt(
  prompt: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<GeneratePromptRecipeResult> {
  const body = JSON.stringify({ prompt });
  if (!prompt.trim()) {
    return {
      ok: false,
      error: { code: "invalid_prompt", message: "送信する依頼文がありません。" },
    };
  }
  if (
    prompt.length > maxAiRecipePromptLength ||
    new TextEncoder().encode(body).byteLength > maxAiRecipeBodyBytes
  ) {
    return {
      ok: false,
      error: {
        code: "prompt_too_long",
        message:
          "依頼文が送信上限を超えています。条件を短くするか、全文をコピーして普段使っているAIへ貼り付けてください。",
      },
    };
  }
  return postRecipe(body, readPromptRecipeResponse, fetcher, signal);
}

async function postRecipe<T extends GenerateRecipeResult | GeneratePromptRecipeResult>(
  body: string,
  readResponse: (response: Response) => Promise<T>,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<T | GenerateRecipeFailure> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = (): void => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, aiRecipeRequestTimeoutMs);

  try {
    if (controller.signal.aborted) return canceledRequest();
    const response = await fetcher("/api/recipe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body,
      signal: controller.signal,
    });
    const result = await readResponse(response);
    return controller.signal.aborted
      ? timedOut
        ? connectionFailure(true)
        : canceledRequest()
      : result;
  } catch {
    return signal?.aborted && !timedOut ? canceledRequest() : connectionFailure(timedOut);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function canceledRequest(): GenerateRecipeFailure {
  return {
    ok: false,
    error: { code: "request_canceled", message: "依頼文の送信を中断しました。" },
  };
}

async function readPromptRecipeResponse(response: Response): Promise<GeneratePromptRecipeResult> {
  const payload = await readJson(response);
  if (!response.ok) {
    return isApiErrorResponse(payload)
      ? { ok: false, error: payload.error }
      : { ok: false, error: { code: "api_error", message: "AIへの依頼に失敗しました。" } };
  }
  if (
    !isRecord(payload) ||
    typeof payload["recipe"] !== "string" ||
    !payload["recipe"].trim() ||
    typeof payload["model"] !== "string" ||
    !("usage" in payload) ||
    payload["usage"] === undefined
  ) {
    return {
      ok: false,
      error: { code: "invalid_response", message: "AIからの応答形式を確認できませんでした。" },
    };
  }
  return { ok: true, recipe: payload["recipe"], model: payload["model"], usage: payload["usage"] };
}

function connectionFailure(timedOut: boolean): GenerateRecipeFailure {
  return {
    ok: false,
    error: {
      code: timedOut ? "request_timed_out" : "network_error",
      message: timedOut
        ? "AIの応答待ちが長くなったため中断しました。"
        : "AIへの接続に失敗しました。",
    },
  };
}

async function readRecipeResponse(response: Response): Promise<GenerateRecipeResult> {
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
