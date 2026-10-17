import { afterEach, describe, expect, test, vi } from "vitest";
import { defaultAiModelId } from "../../src/ai-models";
import {
  aiRecipeRequestTimeoutMs,
  generateRecipeFromPrompt,
  loadAiModelCatalog,
} from "../../src/ai-recipe-client";

const success = { recipe: "豆腐を温めます。", model: "test-model", usage: null };
const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), { status });

describe("generateRecipeFromPrompt", () => {
  afterEach(() => vi.useRealTimers());
  test("model metadata contains no recipe and unsupported or failed catalogs expose no optional provider", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(input).toBe("/api/recipe?models");
      expect(init?.method).toBe("GET");
      expect(init?.body).toBeUndefined();
      return jsonResponse({ models: [{ id: defaultAiModelId, enabled: false }] });
    });
    expect(await loadAiModelCatalog(fetcher)).toEqual({
      confirmed: true,
      models: [{ id: defaultAiModelId, enabled: false }],
    });
    for (const payload of [{ models: [{ id: "unknown", enabled: true }] }, null]) {
      const result = await loadAiModelCatalog(async () => jsonResponse(payload));
      expect(result.confirmed).toBe(false);
      expect(result.models.find((model) => model.id === "openai/gpt-oss-20b")?.enabled).toBe(false);
    }
  });

  test("nondefault model selection preserves the exact prompt and the existing endpoint", async () => {
    const prompt = '材料: 豆腐\n要望: "温かい料理"';
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(input).toBe("/api/recipe");
      expect(JSON.parse(String(init?.body))).toEqual({
        prompt,
        model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      });
      return jsonResponse(success);
    });
    expect(
      (
        await generateRecipeFromPrompt(
          prompt,
          fetcher,
          undefined,
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        )
      ).ok,
    ).toBe(true);
  });

  test("日本語・改行・引用符を含む依頼文をそのまま既存APIへ送る", async () => {
    const prompt = '## 材料\n豆腐（１丁）\n要望: "あっさり"';
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(input).toBe("/api/recipe");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "content-type": "application/json" });
      expect(JSON.parse(String(init?.body))).toEqual({ prompt });
      return jsonResponse(success);
    });
    await expect(generateRecipeFromPrompt(prompt, fetcher)).resolves.toEqual({
      ok: true,
      ...success,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test.each([
    "",
    " \n ",
    "a".repeat(12001),
    "あ".repeat(10663),
    "あ".repeat(8000) + '"'.repeat(4000),
  ])("空または文字数・UTF-8本文サイズ超過は送信せず拒否する", async (prompt) => {
    const fetcher = vi.fn<typeof fetch>();
    expect((await generateRecipeFromPrompt(prompt, fetcher)).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  test.each(["a".repeat(12000), "あ".repeat(10662), '"'.repeat(12000)])(
    "文字数とJSON全体のバイト数の上限内は省略せず送る",
    async (prompt) => {
      const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ prompt });
        return jsonResponse(success);
      });
      expect((await generateRecipeFromPrompt(prompt, fetcher)).ok).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    { ...success, recipe: " \n" },
    { ...success, recipe: null },
    { ...success, recipe: 123 },
    { recipe: "回答", model: "test-model" },
    { items: [], model: "test-model", usage: null },
  ])("不正な自由文回答を受理しない", async (payload) => {
    const fetcher: typeof fetch = async () => jsonResponse(payload);
    await expect(generateRecipeFromPrompt("依頼", fetcher)).resolves.toMatchObject({
      ok: false,
      error: { code: "invalid_response" },
    });
  });

  test.each([20000, 20001])("AI回答の長さ境界を検証する: %s文字", async (length) => {
    const recipe = "あ".repeat(length);
    const fetcher: typeof fetch = async () => jsonResponse({ ...success, recipe });
    const result = await generateRecipeFromPrompt("依頼", fetcher);
    if (length === 20000) expect(result).toEqual({ ok: true, ...success, recipe });
    else expect(result).toMatchObject({ ok: false, error: { code: "response_too_long" } });
  });

  test("APIのエラーを扱い、成功・失敗でタイマーを残さない", async () => {
    vi.useFakeTimers();
    const fetcher: typeof fetch = async () => jsonResponse(success);
    expect((await generateRecipeFromPrompt("依頼", fetcher)).ok).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const error = { code: "ai_binding_unavailable", message: "AI設定がありません。" };
    const failedFetcher: typeof fetch = async () => jsonResponse({ error }, 500);
    await expect(generateRecipeFromPrompt("依頼", failedFetcher)).resolves.toEqual({
      ok: false,
      error,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  test("通常のネットワークエラーを扱い、タイマーを残さない", async () => {
    vi.useFakeTimers();
    const fetcher: typeof fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(generateRecipeFromPrompt("依頼", fetcher)).resolves.toEqual({
      ok: false,
      error: { code: "network_error", message: "AIへの接続に失敗しました。" },
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each([false, true])(
    "接続・本文読み取りの待機を30秒で中断する: 本文=%s",
    async (bodyRead) => {
      vi.useFakeTimers();
      const fetcher: typeof fetch = async (_input, init) => {
        const signal = init?.signal;
        if (!signal) throw new Error("AbortSignal is required");
        if (bodyRead) {
          return new Response(
            new ReadableStream({
              start(controller) {
                signal.addEventListener("abort", () =>
                  controller.error(new DOMException("Aborted", "AbortError")),
                );
              },
            }),
          );
        }
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      };
      const pending = generateRecipeFromPrompt("依頼", fetcher);
      await vi.advanceTimersByTimeAsync(aiRecipeRequestTimeoutMs);
      await expect(pending).resolves.toMatchObject({
        ok: false,
        error: { code: "request_timed_out" },
      });
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test("入力変更による中断で通信とタイマーを解放する", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetcher: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    const pending = generateRecipeFromPrompt("依頼", fetcher, controller.signal);
    controller.abort();
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: "request_canceled" },
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
