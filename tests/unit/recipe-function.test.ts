import { describe, expect, test, vi } from "vitest";
import { type Env, onRequest, recipeFunctionLimits } from "../../functions/api/recipe";

type RecipeFunctionContext = Parameters<typeof onRequest>[0];

const apiUrl = "https://example.test/api/recipe";

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
    expect(input["max_tokens"]).toBe(recipeFunctionLimits.maxTokens);
    expect(input["temperature"]).toBe(recipeFunctionLimits.temperature);
    expect(input["messages"]).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "豆腐で作ってください。" },
    ]);
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
