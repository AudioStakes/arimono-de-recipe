import { describe, expect, test } from "vitest";
import { generateRecipe, maxRecipePromptLength } from "../../src/ai-recipe-client";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

describe("generateRecipe", () => {
  test("成功レスポンスを扱える", async () => {
    const fetcher: typeof fetch = async (input, init) => {
      expect(input).toBe("/api/recipe");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      expect(JSON.parse(String(init?.body))).toEqual({ prompt: "豆腐で作る" });

      return jsonResponse({
        recipe: "豆腐のあんかけ",
        model: "test-model",
        usage: { output_tokens: 120 },
      });
    };

    await expect(generateRecipe("豆腐で作る", fetcher)).resolves.toEqual({
      ok: true,
      recipe: "豆腐のあんかけ",
      model: "test-model",
      usage: { output_tokens: 120 },
    });
  });

  test("APIエラーレスポンスを扱える", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse(
        {
          error: {
            code: "invalid_prompt",
            message: "promptを入力してください。",
          },
        },
        { status: 400 },
      );

    await expect(generateRecipe("", fetcher)).resolves.toEqual({
      ok: false,
      error: {
        code: "invalid_prompt",
        message: "promptを入力してください。",
      },
    });
  });

  test("不正レスポンスを扱える", async () => {
    const fetcher: typeof fetch = async () => jsonResponse({ result: "missing recipe" });

    await expect(generateRecipe("豆腐", fetcher)).resolves.toEqual({
      ok: false,
      error: {
        code: "invalid_response",
        message: "AIからの応答形式を確認できませんでした。",
      },
    });
  });

  test("ネットワークエラーを扱える", async () => {
    const fetcher: typeof fetch = async () => {
      throw new TypeError("network failed");
    };

    await expect(generateRecipe("豆腐", fetcher)).resolves.toEqual({
      ok: false,
      error: {
        code: "network_error",
        message: "AIへの接続に失敗しました。",
      },
    });
  });

  test("長すぎるpromptは送信前に拒否する", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("fetch should not be called");
    };

    await expect(generateRecipe("あ".repeat(maxRecipePromptLength + 1), fetcher)).resolves.toEqual({
      ok: false,
      error: {
        code: "prompt_too_long",
        message: "promptが長すぎます。内容を短くしてください。",
      },
    });
  });
});
