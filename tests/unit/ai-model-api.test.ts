import { afterEach, describe, expect, test, vi } from "vitest";
import { type Env, onRequest } from "../../functions/api/recipe";
import { createRecipeApplication } from "../../src/recipe-application";
import { createUsageDatabase } from "../helpers/usage-database";

const stores: ReturnType<typeof createUsageDatabase>[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function environment(): Env {
  const store = createUsageDatabase();
  stores.push(store);
  return {
    AI: { run: vi.fn(async () => ({ response: "豆腐の料理" })) },
    AI_USAGE: store.database,
    AI_USAGE_SECRET: "unit-test-secret-with-at-least-32-characters",
    CLOUDFLARE_FREE_ONLY: "true",
  };
}

function request(model?: string): Request {
  return new Request("https://example.test/api/recipe", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
      "CF-Connecting-IP": "192.0.2.1",
    },
    body: JSON.stringify({ prompt: "豆腐で料理を作ってください。", ...(model ? { model } : {}) }),
  });
}

describe("model selection and enforced usage", () => {
  test("daily network limits survive minute changes and reset only at UTC midnight", async () => {
    const env = environment();
    const start = Date.parse("2026-10-17T01:00:00Z");
    const clock = vi.spyOn(Date, "now");
    for (let i = 0; i < 10; i += 1) {
      clock.mockReturnValue(start + i * 61000);
      expect((await onRequest({ request: request(), env })).status).toBe(200);
    }
    clock.mockReturnValue(start + 11 * 61000);
    expect((await onRequest({ request: request(), env })).status).toBe(429);
    expect(env.AI.run).toHaveBeenCalledTimes(10);
    clock.mockReturnValue(Date.parse("2026-10-18T00:00:01Z"));
    expect((await onRequest({ request: request(), env })).status).toBe(200);
  });

  test("the global cap holds when requests rotate through many network addresses", async () => {
    const env = environment();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-17T01:00:00Z"));
    for (let i = 1; i <= 100; i += 1) {
      const input = request();
      input.headers.set("CF-Connecting-IP", `192.0.2.${i}`);
      expect((await onRequest({ request: input, env })).status).toBe(200);
    }
    const next = request();
    next.headers.set("CF-Connecting-IP", "192.0.2.101");
    expect((await onRequest({ request: next, env })).status).toBe(429);
    expect(env.AI.run).toHaveBeenCalledTimes(100);
  });

  test("failed inference consumes its reservation and never automatically retries", async () => {
    const env = environment();
    vi.mocked(env.AI.run).mockRejectedValue(new Error("private upstream details"));
    for (let i = 0; i < 3; i += 1) {
      const response = await onRequest({ request: request(), env });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private upstream details");
    }
    expect((await onRequest({ request: request(), env })).status).toBe(429);
    expect(env.AI.run).toHaveBeenCalledTimes(3);
  });
  test("metadata exposes only configured allowlist availability without calling AI", async () => {
    const env = environment();
    const response = await onRequest({
      request: new Request("https://example.test/api/recipe?models"),
      env,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(text).toContain('"enabled":true');
    expect(text).not.toContain(env.AI_USAGE_SECRET);
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  test.each(["missing", "false"])(
    "the emergency stop (%s master flag) disables every model including configured Groq",
    async (flag) => {
      const env = environment();
      env.GROQ_API_KEY = "unit-test-key";
      env.GROQ_FREE_ONLY = "true";
      if (flag === "missing") delete env.CLOUDFLARE_FREE_ONLY;
      else env.CLOUDFLARE_FREE_ONLY = "false";
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      const metadata = await onRequest({
        request: new Request("https://example.test/api/recipe?models"),
        env,
      });
      expect(metadata.status).toBe(200);
      expect(await metadata.json()).toMatchObject({
        models: Array.from({ length: 4 }, () => expect.objectContaining({ enabled: false })),
      });
      for (const model of [undefined, "openai/gpt-oss-20b"]) {
        expect((await onRequest({ request: request(model), env })).status).toBe(503);
      }
      expect(fetcher).not.toHaveBeenCalled();
      expect(env.AI.run).not.toHaveBeenCalled();
    },
  );

  test.each(["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/google/gemma-4-26b-a4b-it"])(
    "selected model %s uses its own capped output field",
    async (model) => {
      const env = environment();
      vi.mocked(env.AI.run).mockResolvedValue(
        model.includes("gemma")
          ? { choices: [{ finish_reason: "stop", message: { content: "選択モデルの料理" } }] }
          : { response: "選択モデルの料理" },
      );
      const response = await onRequest({ request: request(model), env });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ recipe: "選択モデルの料理", model });
      expect(env.AI.run).toHaveBeenCalledWith(
        model,
        expect.objectContaining(
          model.includes("gemma")
            ? { max_completion_tokens: 1400, chat_template_kwargs: { enable_thinking: false } }
            : { max_tokens: 1400 },
        ),
      );
    },
  );

  test.each(["cloudflare", "groq"])(
    "%s does not present an answer cut off at the token limit as a recipe",
    async (provider) => {
      const env = environment();
      const payload = {
        choices: [{ finish_reason: "length", message: { content: "途中で切れた料理手順" } }],
      };
      vi.mocked(env.AI.run).mockResolvedValue(payload);
      env.GROQ_API_KEY = "unit-test-key";
      env.GROQ_FREE_ONLY = "true";
      const fetcher = vi.fn(async () => Response.json(payload));
      vi.stubGlobal("fetch", fetcher);
      const response = await onRequest({
        request: request(
          provider === "groq" ? "openai/gpt-oss-20b" : "@cf/google/gemma-4-26b-a4b-it",
        ),
        env,
      });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("途中で切れた料理手順");
      expect(provider === "groq" ? fetcher : env.AI.run).toHaveBeenCalledTimes(1);
    },
  );

  test("the fourth rapid request is rejected without invoking AI, also across models", async () => {
    const env = environment();
    for (let i = 0; i < 3; i += 1)
      expect((await onRequest({ request: request(), env })).status).toBe(200);
    const response = await onRequest({
      request: request("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
      env,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(env.AI.run).toHaveBeenCalledTimes(3);
  });

  test("missing identity, ledger, Free attestation or unknown model cannot dispatch", async () => {
    for (const missing of ["identity", "ledger", "free", "unknown"] as const) {
      const env = environment();
      const input = request(missing === "unknown" ? "paid-model-or-url" : undefined);
      if (missing === "identity") input.headers.delete("CF-Connecting-IP");
      if (missing === "ledger") delete env.AI_USAGE;
      if (missing === "free") delete env.CLOUDFLARE_FREE_ONLY;
      expect((await onRequest({ request: input, env })).status).toBe(
        missing === "unknown" ? 400 : 503,
      );
      expect(env.AI.run).not.toHaveBeenCalled();
    }
  });

  test("a real generated request reaches the optional free provider within its limits", async () => {
    const env = environment();
    env.GROQ_API_KEY = "unit-test-key";
    env.GROQ_FREE_ONLY = "true";
    const app = createRecipeApplication({
      sendRecipe: async () => ({ ok: false, error: { code: "unused", message: "unused" } }),
    });
    app.commitInput("materials", "卵");
    const input = request("openai/gpt-oss-20b");
    const fullRequest = new Request(input, {
      body: JSON.stringify({ prompt: app.getSnapshot().prompt, model: "openai/gpt-oss-20b" }),
    });
    const fetcher = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: "卵焼き" } }],
        usage: { total_tokens: 100 },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect((await onRequest({ request: fullRequest, env })).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(env.AI.run).not.toHaveBeenCalled();
  });
});
