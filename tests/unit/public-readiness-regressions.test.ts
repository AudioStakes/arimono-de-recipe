import { describe, expect, test, vi } from "vitest";
import { type Env, onRequest, recipeFunctionLimits } from "../../functions/api/recipe";
import {
  buildAiRecipeCandidateRequest,
  getAiRecipeInputLimitError,
} from "../../src/ai-recipe-request";
import {
  aiRecipeCandidateLimits,
  parseAiRecipeCandidateRequest,
  parseAiRecipeCandidatesResponse,
  validateAiRecipeCandidatesForRequest,
} from "../../src/ai-recipe-schema";
import { makeEmptyPromptData } from "../../src/prompt";
import type { AiRecipeCandidateRequest, AiRecipeCandidatesResponse } from "../../src/types";

const request = {
  mode: "candidates",
  materials: [{ name: "豆腐", usage: "auto" }],
} satisfies AiRecipeCandidateRequest;

const candidates = {
  items: ["a", "b", "c"].map((id) => ({
    id,
    title: "豆腐煮",
    time: 10,
    badges: [],
    use: ["豆腐"],
    miss: [],
    why: "豆腐を使います",
    ing: ["豆腐", "水"],
    steps: ["豆腐を煮る"],
  })),
} satisfies AiRecipeCandidatesResponse;

function apiRequest(body: unknown): Request {
  return new Request("https://example.test/api/recipe", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify(body),
  });
}

describe("公開準備の独立レビュー回帰", () => {
  test.each([
    { materials: [{ name: "あ".repeat(81), usage: "auto" }] },
    { materials: [{ name: "豆腐", usage: "use_up", amount: "あ".repeat(81) }] },
    { servings: "あ".repeat(81) },
    { time: "あ".repeat(41) },
    { directions: ["あ".repeat(81)] },
    { tools: ["あ".repeat(81)] },
    { avoid: ["あ".repeat(81)] },
    { notes: "あ".repeat(181) },
  ])("APIは文字数超過を切り捨てずAI呼出し前に拒否する: %j", async (fields) => {
    const body = { ...request, ...fields };
    expect(parseAiRecipeCandidateRequest(body).ok).toBe(false);
    const run = vi.fn<Env["AI"]["run"]>();
    const response = await onRequest({ request: apiRequest(body), env: { AI: { run } } });
    expect(response.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  test.each([
    { materials: [{ name: "あ".repeat(80), usage: "auto" }] },
    { materials: [{ name: "豆腐", usage: "use_up", amount: "あ".repeat(80) }] },
    { servings: "あ".repeat(80) },
    { time: "あ".repeat(40) },
    { directions: ["あ".repeat(80)] },
    { tools: ["あ".repeat(80)] },
    { avoid: ["あ".repeat(80)] },
    { notes: "あ".repeat(180) },
  ])("APIの文字数上限ちょうどは欠落なく保持する: %j", (fields) => {
    const body = { ...request, ...fields };
    const parsed = parseAiRecipeCandidateRequest(body);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value).toEqual(body);
  });

  test("上限超過のAI手順の後半にあるNG指定を切り落として成功扱いしない", async () => {
    const output = {
      items: candidates.items.map((item) => ({
        ...item,
        steps: [`${"あ".repeat(aiRecipeCandidateLimits.response.maxStepLength)}にんにくを加える`],
      })),
    };
    expect(parseAiRecipeCandidatesResponse(output).ok).toBe(false);
    const run = vi.fn<Env["AI"]["run"]>().mockResolvedValue({ response: output });
    const response = await onRequest({
      request: apiRequest({ ...request, avoid: ["にんにく"] }),
      env: { AI: { run } },
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "ai_generation_failed" } });
  });

  test.each([
    { title: "あ".repeat(33) },
    { why: "あ".repeat(81) },
    { use: ["あ".repeat(81)] },
    { miss: ["あ".repeat(81)] },
    { ing: [`豆腐${"あ".repeat(79)}`] },
  ])("AI応答の文字数超過も切り捨てず拒否する: %j", (fields) => {
    expect(
      parseAiRecipeCandidatesResponse({
        items: candidates.items.map((item) => ({ ...item, ...fields })),
      }).ok,
    ).toBe(false);
  });

  test.each([
    "豆腐（半丁）",
    "豆腐1丁（300g）",
    "豆腐２００ｇ",
    "豆腐（150g）",
  ])("材料名の後の通常の分量表記を拒否しない: %s", (ingredient) => {
    const output = {
      items: candidates.items.map((item) => ({ ...item, ing: [ingredient, "水"] })),
    };
    const parsed = parseAiRecipeCandidatesResponse(output);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(
      validateAiRecipeCandidatesForRequest(parsed.value, {
        ...request,
        materials: [{ name: "豆腐", usage: "required" }],
      }).ok,
    ).toBe(true);
  });

  test.each([
    "豆腐ハンバーグ",
    "豆腐（豚肉）",
    "豆腐1丁（卵）",
    "塩漬け豚肉",
    "油揚げ",
  ])("別の材料は分量として許可しない: %s", (ingredient) => {
    expect(
      validateAiRecipeCandidatesForRequest(
        { items: candidates.items.map((item) => ({ ...item, ing: [ingredient] })) },
        request,
      ).ok,
    ).toBe(false);
  });

  test("おまかせ材料もuseの申告だけでなく実際の材料一覧に少なくとも1件必要", () => {
    expect(
      validateAiRecipeCandidatesForRequest(
        { items: candidates.items.map((item) => ({ ...item, ing: ["塩", "水"] })) },
        request,
      ).ok,
    ).toBe(false);
  });

  test("同じ料理名でも作りたい料理と合わせる料理をAI送信で区別する", () => {
    const target = buildAiRecipeCandidateRequest(
      makeEmptyPromptData({
        materials: ["豆腐"],
        requestIntent: "target-dish",
        targetDish: ["カレー"],
      }),
    );
    const pairing = buildAiRecipeCandidateRequest(
      makeEmptyPromptData({
        materials: ["豆腐"],
        requestIntent: "pairing",
        pairingTargets: ["カレー"],
      }),
    );
    expect(target).not.toEqual(pairing);
    expect(target.notes).toContain("作りたい料理");
    expect(pairing.notes).toContain("一緒に出す料理");
  });

  test("品数の指定と自由記述をAI送信で両方保持する", () => {
    const data = makeEmptyPromptData({
      materials: ["豆腐"],
      recipeCount: "multiple",
      supplementalNotes: "薄味",
    });
    expect(getAiRecipeInputLimitError(data)).toBeNull();
    const result = buildAiRecipeCandidateRequest(data);
    expect(result.notes).toContain("複数品");
    expect(result.notes).toContain("薄味");
  });

  test("選択した要望と自由記述の合計が上限を超えた場合は送信前に案内する", () => {
    const data = makeEmptyPromptData({
      materials: ["豆腐"],
      recipeCount: "multiple",
      supplementalNotes: "あ".repeat(aiRecipeCandidateLimits.request.maxNotesLength),
    });
    expect(getAiRecipeInputLimitError(data)).toContain("依頼文コピー");
  });

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
  test("Workers AIに渡す材料名のschemaも80文字の入力と一致する", async () => {
    const name = "あ".repeat(aiRecipeCandidateLimits.request.maxItemLength);
    const output = {
      items: candidates.items.map((item) => ({ ...item, use: [name], ing: [name] })),
    };
    const run = vi.fn<Env["AI"]["run"]>().mockResolvedValue({ response: output });
    const response = await onRequest({
      request: apiRequest({
        ...request,
        materials: [{ name, usage: "required" }],
        allowShopping: true,
      }),
      env: { AI: { run } },
    });
    expect(response.status).toBe(200);
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      response_format: {
        json_schema: {
          properties: {
            items: {
              items: {
                properties: {
                  ing: { items: { maxLength: aiRecipeCandidateLimits.response.maxListItemLength } },
                  miss: { items: { maxLength: aiRecipeCandidateLimits.response.maxListItemLength } },
                },
              },
            },
          },
        },
      },
    });
  });
});
