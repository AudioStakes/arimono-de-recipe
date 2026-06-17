import { describe, expect, test, vi } from "vitest";
import { type Env, onRequest, recipeFunctionLimits } from "../../functions/api/recipe";
import { buildPrompt, makeEmptyPromptData } from "../../src/prompt";
import type { AiRecipeCandidateRequest, AiRecipeCandidatesResponse } from "../../src/types";

type RecipeFunctionContext = Parameters<typeof onRequest>[0];

const apiUrl = "https://example.test/api/recipe";

const candidateRequest = {
  mode: "candidates",
  materials: ["豆腐", "キャベツ"],
  servings: "2人分",
  time: "20分以内",
  directions: ["あっさり"],
  tools: ["フライパン"],
  avoid: ["にんにく"],
  notes: "薄味",
} satisfies AiRecipeCandidateRequest;

const candidateResponse = {
  items: [
    {
      id: "a",
      title: "豆腐のあんかけ",
      time: 15,
      badges: ["no_shop", "quick"],
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
      miss: ["卵"],
      why: "少ない材料で主菜寄りにできます。",
      ing: ["キャベツ", "油", "塩"],
      steps: ["切る", "炒める", "味を調える"],
    },
    {
      id: "c",
      title: "豆腐スープ",
      time: 10,
      badges: ["no_shop", "few_dishes"],
      use: ["豆腐", "キャベツ"],
      miss: [],
      why: "鍋ひとつでありものを使えます。",
      ing: ["豆腐", "キャベツ", "だし"],
      steps: ["煮る", "味を調える"],
    },
  ],
} satisfies AiRecipeCandidatesResponse;

function createContext(request: Request, env: Env): RecipeFunctionContext {
  return { request, env };
}

function createRequest(body: unknown): Request {
  return new Request(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.test",
    },
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("POST /api/recipe", () => {
  test("POST以外を405で拒否する", async () => {
    const response = await onRequest(
      createContext(new Request(apiUrl, { method: "GET" }), {
        AI: { run: vi.fn() },
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await readJson(response)).toEqual({
      error: {
        code: "method_not_allowed",
        message: "POSTでリクエストしてください。",
      },
    });
  });

  test("不正JSONを400で拒否する", async () => {
    const response = await onRequest(
      createContext(
        new Request(apiUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://example.test",
          },
          body: "{",
        }),
        {
          AI: { run: vi.fn() },
        },
      ),
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      error: {
        code: "invalid_json",
        message: "JSONを読み取れませんでした。",
      },
    });
  });

  test("JSON以外を415で拒否する", async () => {
    const response = await onRequest(
      createContext(
        new Request(apiUrl, {
          method: "POST",
          headers: {
            "content-type": "text/plain",
            origin: "https://example.test",
          },
          body: "prompt",
        }),
        {
          AI: { run: vi.fn() },
        },
      ),
    );

    expect(response.status).toBe(415);
    expect(await readJson(response)).toEqual({
      error: {
        code: "unsupported_media_type",
        message: "JSONでリクエストしてください。",
      },
    });
  });

  test("異なるoriginを403で拒否する", async () => {
    const request = createRequest({ prompt: "豆腐" });
    request.headers.set("origin", "https://evil.example");
    const response = await onRequest(
      createContext(request, {
        AI: { run: vi.fn() },
      }),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({
      error: {
        code: "forbidden_origin",
        message: "許可されていない送信元です。",
      },
    });
  });

  test("originがないPOSTを403で拒否する", async () => {
    const response = await onRequest(
      createContext(
        new Request(apiUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: "豆腐" }),
        }),
        {
          AI: { run: vi.fn() },
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({
      error: {
        code: "forbidden_origin",
        message: "許可されていない送信元です。",
      },
    });
  });

  test("大きすぎる本文を413で拒否する", async () => {
    const response = await onRequest(
      createContext(
        new Request(apiUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://example.test",
            "content-length": String(recipeFunctionLimits.maxBodyBytes + 1),
          },
          body: JSON.stringify({ prompt: "豆腐" }),
        }),
        {
          AI: { run: vi.fn() },
        },
      ),
    );

    expect(response.status).toBe(413);
    expect(await readJson(response)).toEqual({
      error: {
        code: "body_too_large",
        message: "リクエスト本文が長すぎます。",
      },
    });
  });

  test("content-lengthなしでも大きすぎる本文を413で拒否する", async () => {
    const response = await onRequest(
      createContext(
        new Request(apiUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://example.test",
          },
          body: JSON.stringify({ prompt: "あ".repeat(recipeFunctionLimits.maxBodyBytes) }),
        }),
        {
          AI: { run: vi.fn() },
        },
      ),
    );

    expect(response.status).toBe(413);
    expect(await readJson(response)).toEqual({
      error: {
        code: "body_too_large",
        message: "リクエスト本文が長すぎます。",
      },
    });
  });

  test("空promptを400で拒否する", async () => {
    const response = await onRequest(
      createContext(createRequest({ prompt: "   " }), {
        AI: { run: vi.fn() },
      }),
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      error: {
        code: "invalid_prompt",
        message: "promptを入力してください。",
      },
    });
  });

  test("長すぎるpromptを413で拒否する", async () => {
    const response = await onRequest(
      createContext(
        createRequest({ prompt: "a".repeat(recipeFunctionLimits.maxPromptLength + 1) }),
        {
          AI: { run: vi.fn() },
        },
      ),
    );

    expect(response.status).toBe(413);
    expect(await readJson(response)).toEqual({
      error: {
        code: "prompt_too_long",
        message: "promptが長すぎます。内容を短くしてください。",
      },
    });
  });

  test("AI binding未設定を500で返す", async () => {
    const response = await onRequest(
      createContext(createRequest({ prompt: "豆腐" }), {
        AI: undefined as unknown as Env["AI"],
      }),
    );

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      error: {
        code: "ai_binding_unavailable",
        message: "AI設定を確認してください。",
      },
    });
  });

  test("fake env.AI.run の結果を返す", async () => {
    const run = vi.fn<Env["AI"]["run"]>(async () => ({
      response: "豆腐のあんかけ\n\n1. 豆腐を温める。",
      usage: { input_tokens: 12, output_tokens: 34 },
    }));

    const response = await onRequest(
      createContext(createRequest({ prompt: "豆腐で作ってください。" }), {
        AI: { run },
      }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      recipe: "豆腐のあんかけ\n\n1. 豆腐を温める。",
      model: recipeFunctionLimits.model,
      usage: { input_tokens: 12, output_tokens: 34 },
    });

    expect(run).toHaveBeenCalledTimes(1);
    const call = run.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("AI.run was not called.");
    const [model, input] = call;
    expect(model).toBe(recipeFunctionLimits.model);
    expect(isRecord(input)).toBe(true);
    if (!isRecord(input)) throw new Error("AI input was not an object.");
    expect(input["max_tokens"]).toBe(recipeFunctionLimits.legacyMaxTokens);
    expect(input["temperature"]).toBe(recipeFunctionLimits.temperature);
    expect(input["messages"]).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "豆腐で作ってください。" },
    ]);
  });

  test("candidate JSONを受け取り、短いcompact inputでWorkers AIへ依頼する", async () => {
    const run = vi.fn<Env["AI"]["run"]>(async () => ({
      response: JSON.stringify(candidateResponse),
      usage: { input_tokens: 18, output_tokens: 120 },
    }));

    const response = await onRequest(
      createContext(createRequest(candidateRequest), {
        AI: { run },
      }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      ...candidateResponse,
      model: recipeFunctionLimits.model,
      usage: { input_tokens: 18, output_tokens: 120 },
    });

    expect(run).toHaveBeenCalledTimes(1);
    const call = run.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("AI.run was not called.");
    const [model, input] = call;
    expect(model).toBe(recipeFunctionLimits.model);
    expect(isRecord(input)).toBe(true);
    if (!isRecord(input)) throw new Error("AI input was not an object.");
    expect(input["max_tokens"]).toBe(recipeFunctionLimits.candidateMaxTokens);
    expect(input["temperature"]).toBe(recipeFunctionLimits.temperature);
    const messages = input["messages"];
    expect(Array.isArray(messages)).toBe(true);
    if (!Array.isArray(messages)) throw new Error("AI messages were not an array.");
    const system = messages[0] as Record<string, unknown> | undefined;
    const user = messages[1] as Record<string, unknown> | undefined;
    expect(system).toEqual(expect.objectContaining({ role: "system" }));
    expect(String(system?.["content"])).toContain("Return JSON only");
    expect(user).toEqual(
      expect.objectContaining({
        role: "user",
        content:
          'r={"m":["豆腐","キャベツ"],"sv":"2人分","t":"20分以内","d":["あっさり"],"tl":["フライパン"],"ng":["にんにく"],"n":"薄味"}',
      }),
    );
    expect(String(user?.["content"])).not.toContain("materials");
    expect(String(user?.["content"])).not.toContain("## 役割");

    const legacyPrompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["豆腐", "キャベツ"],
        servings: "2人分",
        cookTime: "20分以内",
        recipeDirections: ["あっさり"],
        cookingTools: ["フライパン"],
        ngFoodsAndSeasonings: ["にんにく"],
        supplementalNotes: "薄味",
      }),
    );
    expect(String(user?.["content"]).length).toBeLessThan(legacyPrompt.length);
  });

  test("candidate requestの未知fieldや上限超過を400で拒否する", async () => {
    const run = vi.fn<Env["AI"]["run"]>();

    const unknownField = await onRequest(
      createContext(createRequest({ ...candidateRequest, prompt: "legacy text" }), {
        AI: { run },
      }),
    );
    expect(unknownField.status).toBe(400);
    expect(await readJson(unknownField)).toEqual({
      error: {
        code: "invalid_request",
        message: "AI候補の依頼条件を確認してください。",
      },
    });

    const tooManyMaterials = await onRequest(
      createContext(
        createRequest({
          mode: "candidates",
          materials: Array.from({ length: 13 }, (_, index) => `材料${index}`),
        }),
        {
          AI: { run },
        },
      ),
    );
    expect(tooManyMaterials.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  test("candidate modeはAI応答が3件未満または不正JSONなら安全に失敗する", async () => {
    const run = vi.fn<Env["AI"]["run"]>(async () => ({
      response: JSON.stringify({ items: [candidateResponse.items[0]] }),
    }));

    const response = await onRequest(
      createContext(createRequest(candidateRequest), {
        AI: { run },
      }),
    );

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      error: {
        code: "ai_generation_failed",
        message: "AIからレシピ案を取得できませんでした。",
      },
    });

    run.mockResolvedValueOnce({ response: "not-json" });
    const invalidJsonResponse = await onRequest(
      createContext(createRequest(candidateRequest), {
        AI: { run },
      }),
    );
    expect(invalidJsonResponse.status).toBe(500);
  });

  test("candidate modeはrequest外のuse材料やavoid衝突を安全に拒否する", async () => {
    const run = vi.fn<Env["AI"]["run"]>(async () => ({
      response: JSON.stringify({
        items: [
          { ...candidateResponse.items[0], use: ["豚肉"] },
          candidateResponse.items[1],
          candidateResponse.items[2],
        ],
      }),
    }));

    const response = await onRequest(
      createContext(createRequest(candidateRequest), {
        AI: { run },
      }),
    );

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      error: {
        code: "ai_generation_failed",
        message: "AIからレシピ案を取得できませんでした。",
      },
    });

    run.mockResolvedValueOnce({
      response: JSON.stringify({
        items: [
          { ...candidateResponse.items[0], ing: ["豆腐", "にんにく"] },
          candidateResponse.items[1],
          candidateResponse.items[2],
        ],
      }),
    });

    const avoidResponse = await onRequest(
      createContext(createRequest(candidateRequest), {
        AI: { run },
      }),
    );
    expect(avoidResponse.status).toBe(500);
  });

  test("candidate modeは4件以上の妥当な候補を3件に切る", async () => {
    const extra = {
      ...candidateResponse.items[0],
      id: "d",
      title: "豆腐焼き",
    };
    const run = vi.fn<Env["AI"]["run"]>(async () => ({
      response: JSON.stringify({ items: [...candidateResponse.items, extra] }),
    }));

    const response = await onRequest(
      createContext(createRequest(candidateRequest), {
        AI: { run },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await readJson(response);
    expect(isRecord(payload)).toBe(true);
    if (!isRecord(payload) || !Array.isArray(payload["items"])) {
      throw new Error("candidate payload was not returned.");
    }
    expect(payload["items"]).toHaveLength(3);
  });

  test("AI失敗時は内部例外を出さずに500を返す", async () => {
    const run = vi.fn<Env["AI"]["run"]>(async () => {
      throw new Error("secret stack");
    });

    const response = await onRequest(
      createContext(createRequest({ prompt: "豆腐で作ってください。" }), {
        AI: { run },
      }),
    );

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      error: {
        code: "ai_generation_failed",
        message: "AIへの依頼に失敗しました。",
      },
    });
  });

  test("AI応答が空なら500を返す", async () => {
    const run = vi.fn<Env["AI"]["run"]>(async () => ({ response: "" }));

    const response = await onRequest(
      createContext(createRequest({ prompt: "豆腐で作ってください。" }), {
        AI: { run },
      }),
    );

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({
      error: {
        code: "ai_generation_failed",
        message: "AIからレシピ案を取得できませんでした。",
      },
    });
  });
});
