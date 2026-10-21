import { afterEach, describe, expect, test, vi } from "vitest";
import { type Env, onRequest, recipeFunctionLimits } from "../../functions/api/recipe";
import { defaultAiModelId } from "../../src/ai-models";
import { createUsageDatabase } from "../helpers/usage-database";

type RecipeFunctionContext = Parameters<typeof onRequest>[0];

const apiUrl = "https://example.test/api/recipe";
const stores: ReturnType<typeof createUsageDatabase>[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  vi.unstubAllGlobals();
});

function createContext(request: Request, env: Env): RecipeFunctionContext {
  const store = createUsageDatabase();
  stores.push(store);
  return {
    request,
    env: {
      AI_USAGE: store.database,
      AI_USAGE_SECRET: "unit-test-secret-with-at-least-32-characters",
      CLOUDFLARE_FREE_ONLY: "true",
      ...env,
    },
  };
}

function createRequest(body: unknown): Request {
  return new Request(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.test",
      "CF-Connecting-IP": "192.0.2.1",
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
  test("本文超過の取消処理が止まっても413を返しreaderを解放する", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => undefined));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(recipeFunctionLimits.maxBodyBytes + 1));
      },
      cancel,
    });
    const input = new Request("https://example.test/api/recipe", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body,
      duplex: "half",
    } as RequestInit);
    const run = vi.fn<Env["AI"]["run"]>();
    const response = await onRequest({ request: input, env: { AI: { run } } });
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  test("成功・エラーとも入力由来の応答をキャッシュさせない", async () => {
    const env = { AI: { run: vi.fn().mockResolvedValue({ response: "豆腐のレシピ" }) } };
    for (const request of [
      createRequest({ prompt: "豆腐で作ってください。" }),
      new Request(apiUrl),
    ]) {
      const response = await onRequest(createContext(request, env));
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(env.AI.run).toHaveBeenCalledTimes(1);
  });

  test("JSONに見せかけた別media typeはAIを呼ばず拒否する", async () => {
    const request = createRequest({ prompt: "豆腐で作ってください。" });
    request.headers.set("content-type", "text/plain; application/json");
    const run = vi.fn();
    const response = await onRequest(createContext(request, { AI: { run } }));
    expect(response.status).toBe(415);
    expect(run).not.toHaveBeenCalled();
  });

  test("本文ストリームの例外は入力や内部エラーを漏らさず扱う", async () => {
    const request = new Request(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body: new ReadableStream({
        start(controller) {
          controller.error(new Error("private input"));
        },
      }),
      duplex: "half",
    } as RequestInit);
    const run = vi.fn();
    const response = await onRequest(createContext(request, { AI: { run } }));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private input");
    expect(run).not.toHaveBeenCalled();
  });

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

  test("AI binding未設定では送信せず503を返す", async () => {
    const response = await onRequest(
      createContext(createRequest({ prompt: "豆腐" }), {
        AI: undefined as unknown as Env["AI"],
      }),
    );

    expect(response.status).toBe(503);
    expect(await readJson(response)).toEqual({
      error: {
        code: "model_unavailable",
        message: "このAIは現在利用できません。別のモデルを選ぶか、依頼文をコピーしてください。",
      },
    });
  });

  test("モデルを省略した旧画面は従来のLlamaを使い続ける", async () => {
    const run = vi.fn().mockResolvedValue({ response: "豆腐のレシピ" });
    const response = await onRequest(
      createContext(createRequest({ prompt: "豆腐で作ってください。" }), { AI: { run } }),
    );
    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      recipe: "豆腐のレシピ",
      model: "@cf/meta/llama-3.1-8b-instruct-fp8",
    });
    expect(run).toHaveBeenCalledWith(
      "@cf/meta/llama-3.1-8b-instruct-fp8",
      expect.objectContaining({ max_tokens: recipeFunctionLimits.maxTokens }),
    );
  });

  test("既定Gemmaの応答を返し、thinkingなしで依頼文全体を送る", async () => {
    const run = vi.fn<Env["AI"]["run"]>(async () => ({
      choices: [
        {
          finish_reason: "stop",
          message: { content: "豆腐のあんかけ\n\n1. 豆腐を温める。" },
        },
      ],
      usage: { input_tokens: 12, output_tokens: 34 },
    }));

    const response = await onRequest(
      createContext(createRequest({ prompt: "豆腐で作ってください。", model: defaultAiModelId }), {
        AI: { run },
      }),
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      recipe: "豆腐のあんかけ\n\n1. 豆腐を温める。",
      model: defaultAiModelId,
      usage: { input_tokens: 12, output_tokens: 34 },
    });

    expect(run).toHaveBeenCalledTimes(1);
    const call = run.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("AI.run was not called.");
    const [model, input] = call;
    expect(model).toBe("@cf/google/gemma-4-26b-a4b-it");
    expect(isRecord(input)).toBe(true);
    if (!isRecord(input)) throw new Error("AI input was not an object.");
    expect(input["max_completion_tokens"]).toBe(recipeFunctionLimits.maxTokens);
    expect(input["max_tokens"]).toBeUndefined();
    expect(input["chat_template_kwargs"]).toEqual({ enable_thinking: false });
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

  test.each([20000, 20001])("AI回答の長さ境界を検証する: %s文字", async (length) => {
    const recipe = "あ".repeat(length);
    const run = vi.fn<Env["AI"]["run"]>(async () => ({ response: recipe }));
    const response = await onRequest(
      createContext(createRequest({ prompt: "豆腐で作ってください。" }), { AI: { run } }),
    );
    expect(response.status).toBe(length === 20000 ? 200 : 500);
    const payload = await readJson(response);
    if (length === 20000) expect(payload).toMatchObject({ recipe });
    else
      expect(payload).toEqual({
        error: {
          code: "ai_generation_failed",
          message: "AIの回答が長すぎます。依頼文をコピーして別のAIへ相談できます。",
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
