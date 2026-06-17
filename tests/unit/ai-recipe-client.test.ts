import { describe, expect, test } from "vitest";
import { generateRecipe } from "../../src/ai-recipe-client";
import type { AiRecipeCandidateRequest, AiRecipeCandidatesResponse } from "../../src/types";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

const request = {
  mode: "candidates",
  materials: [
    { name: "豆腐", usage: "auto" },
    { name: "キャベツ", usage: "auto" },
  ],
  servings: "2人分",
  directions: ["あっさり"],
} satisfies AiRecipeCandidateRequest;

const candidates = {
  items: [
    {
      id: "a",
      title: "豆腐のあんかけ",
      time: 15,
      badges: ["quick"],
      use: ["豆腐"],
      miss: [],
      why: "豆腐を主役にして短時間で作れます。",
      ing: ["豆腐", "片栗粉", "しょうゆ"],
      steps: ["豆腐を温める", "あんを作る", "かける"],
    },
    {
      id: "b",
      title: "キャベツ炒め",
      time: 12,
      badges: ["easy"],
      use: ["キャベツ"],
      miss: [],
      why: "少ない材料で主菜寄りにできます。",
      ing: ["キャベツ", "油", "塩"],
      steps: ["切る", "炒める", "味を調える"],
    },
    {
      id: "c",
      title: "豆腐スープ",
      time: 10,
      badges: ["few_dishes"],
      use: ["豆腐", "キャベツ"],
      miss: [],
      why: "鍋ひとつでありものを使えます。",
      ing: ["豆腐", "キャベツ", "だし"],
      steps: ["煮る", "味を調える"],
    },
  ],
} satisfies AiRecipeCandidatesResponse;

describe("generateRecipe", () => {
  test("候補成功レスポンスを扱える", async () => {
    const fetcher: typeof fetch = async (input, init) => {
      expect(input).toBe("/api/recipe");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toEqual(request);
      expect(body["prompt"]).toBeUndefined();
      expect(String(init?.body)).not.toContain("## 役割");

      return jsonResponse({
        ...candidates,
        model: "test-model",
        usage: { output_tokens: 120 },
      });
    };

    await expect(generateRecipe(request, fetcher)).resolves.toEqual({
      ok: true,
      candidates,
      model: "test-model",
      usage: { output_tokens: 120 },
    });
  });

  test("APIエラーレスポンスを扱える", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse(
        {
          error: {
            code: "invalid_request",
            message: "AI候補の依頼条件を確認してください。",
          },
        },
        { status: 400 },
      );

    await expect(generateRecipe(request, fetcher)).resolves.toEqual({
      ok: false,
      error: {
        code: "invalid_request",
        message: "AI候補の依頼条件を確認してください。",
      },
    });
  });

  test("不正レスポンスを扱える", async () => {
    const fetcher: typeof fetch = async () => jsonResponse({ result: "missing items" });

    await expect(generateRecipe(request, fetcher)).resolves.toEqual({
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

    await expect(generateRecipe(request, fetcher)).resolves.toEqual({
      ok: false,
      error: {
        code: "network_error",
        message: "AIへの接続に失敗しました。",
      },
    });
  });

  test("長すぎるrequest bodyは送信前に拒否する", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("fetch should not be called");
    };

    await expect(
      generateRecipe(
        {
          mode: "candidates",
          materials: [{ name: "豆腐", usage: "auto" }],
          notes: "あ".repeat(3000),
        },
        fetcher,
      ),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "request_too_long",
        message: "AIへの依頼条件が長すぎます。内容を短くしてください。",
      },
    });
  });
});
