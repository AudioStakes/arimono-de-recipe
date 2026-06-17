export type GenerateRecipeSuccess = {
  ok: true;
  recipe: string;
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

export const maxRecipePromptLength = 12000;

type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

type ApiSuccessResponse = {
  recipe: string;
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
  typeof value["recipe"] === "string" &&
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
  prompt: string,
  fetcher: typeof fetch = fetch,
): Promise<GenerateRecipeResult> {
  if (prompt.trim().length > maxRecipePromptLength) {
    return {
      ok: false,
      error: {
        code: "prompt_too_long",
        message: "promptが長すぎます。内容を短くしてください。",
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
      body: JSON.stringify({ prompt }),
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

  return {
    ok: true,
    recipe: payload.recipe,
    model: payload.model,
    usage: payload.usage,
  };
}
