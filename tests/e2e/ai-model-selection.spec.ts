import { expect, test } from "@playwright/test";
import { aiModels, defaultAiModelId } from "../../src/ai-models";
import { pressCommittedEnter } from "./helpers/combo";
import { openAiSettings } from "./helpers/settings";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let copied = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          copied = text;
        },
        readText: async () => copied,
      },
    });
  });
  await page.route("**/api/recipe?models", async (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().postData()).toBeNull();
    await route.fulfill({
      json: { models: aiModels.map((model) => ({ id: model.id, enabled: true })) },
    });
  });
});

test("モデル変更は送信せず、選択したAIへ依頼文を省略せず明示送信する", async ({ page }) => {
  let posted: unknown = null;
  let calls = 0;
  await page.route("**/api/recipe", async (route) => {
    calls += 1;
    posted = route.request().postDataJSON();
    await route.fulfill({
      json: { recipe: "# 豆腐の料理", model: "openai/gpt-oss-20b", usage: null },
    });
  });
  await page.goto("/");
  await expect(page.getByTestId("ai-model-select")).toBeHidden();
  await expect(page.getByTestId("ai-model-status")).toBeEmpty();
  await openAiSettings(page);
  const pickerBounds = await page.getByTestId("ai-model-select").boundingBox();
  if (!pickerBounds) throw new Error("Model picker must be rendered");
  expect(pickerBounds.height).toBeGreaterThanOrEqual(44);
  await page.getByTestId("privacy-close").click();
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐/);
  const prompt = await page.getByTestId("prompt-output").inputValue();
  await openAiSettings(page);
  await page.getByTestId("ai-model-select").selectOption("openai/gpt-oss-20b");
  await expect(page.getByTestId("ai-model-info")).toContainText("Groq");
  await page.getByTestId("privacy-close").click();
  await expect(page.getByTestId("mobile-ai-prompt-send")).toHaveAccessibleDescription(/GroqのAI/);
  expect(calls).toBe(0);
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect.poll(() => posted).toEqual({ prompt, model: "openai/gpt-oss-20b" });
  await expect(page.getByTestId("ai-prompt-reply")).toContainText("豆腐の料理");
  await expect(page.getByTestId("prompt-output")).toHaveValue(prompt);
});

for (const limit of [
  { code: "usage_limit_reached", message: "利用上限に達しました。依頼文はコピーできます。" },
  {
    code: "provider_quota_exceeded",
    message:
      "Cloudflare AIの本日の無料枠の上限に達しました。無料枠が回復してから再度お試しください。依頼文をコピーして普段使うAIへ貼り付けることもできます。",
  },
  {
    code: "provider_rate_limited",
    message:
      "Groqの利用上限に達しました。時間をおいて再度お試しください。依頼文をコピーして普段使うAIへ貼り付けることもできます。",
  },
]) {
  test(`${limit.code}では理由を表示し、自動再送せずコピーを使い続けられる`, async ({ page }) => {
    let calls = 0;
    await page.route("**/api/recipe", async (route) => {
      calls += 1;
      await route.fulfill({
        status: 429,
        json: {
          error: limit,
        },
      });
    });
    await page.goto("/");
    await page.getByTestId("combo-input-materials").fill("卵");
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
    await page.getByTestId("mobile-ai-prompt-send").click();
    await expect(page.getByTestId("ai-prompt-status")).toContainText(limit.message);
    await expect(page.getByTestId("ai-prompt-status")).toHaveAttribute("role", "alert");
    const prompt = await page.getByTestId("prompt-output").inputValue();
    await page.getByTestId("copy-prompt-sticky").click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(calls).toBe(1);
  });
}

test("利用できないモデルから別の提供元へ自動で切り替えない", async ({ page }) => {
  await page.route("**/api/recipe?models", async (route) => {
    await route.fulfill({
      json: {
        models: aiModels.map((model) => ({ id: model.id, enabled: model.provider === "groq" })),
      },
    });
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  await expect(page.getByTestId("ai-model-status")).toContainText("現在利用できません");
  await expect(page.getByTestId("ai-model-unavailable")).toContainText("現在利用できません");
  await expect(page.getByTestId("ai-model-unavailable")).toBeVisible();
  await openAiSettings(page);
  await expect(page.getByTestId("ai-model-info")).toContainText("現在利用できません");
  await expect(page.getByTestId("ai-model-select")).toHaveValue(defaultAiModelId);
  await expect(page.getByTestId("mobile-ai-prompt-send")).toBeDisabled();
  await expect(page.getByTestId("copy-prompt-sticky")).toBeEnabled();
  await page.getByTestId("ai-model-select").selectOption("openai/gpt-oss-20b");
  await page.getByTestId("privacy-close").click();
  await expect(page.getByTestId("mobile-ai-prompt-send")).toBeEnabled();
  await expect(page.getByTestId("ai-model-unavailable")).toBeEmpty();
});

test("利用状況の確認失敗は設定内に置き、利用可能な初期画面を塞がない", async ({ page }) => {
  await page.route("**/api/recipe?models", async (route) => {
    await route.fulfill({ status: 503, body: "unavailable" });
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  await expect(page.getByTestId("ai-model-status")).toContainText("利用状況を確認できません");
  await expect(page.getByTestId("ai-model-status")).toBeHidden();
  await expect(page.getByTestId("ai-model-unavailable")).toBeEmpty();
  await expect(page.getByTestId("ai-model-unavailable")).toHaveAttribute("role", "status");
  await expect(page.getByTestId("ai-model-unavailable")).not.toHaveAttribute("hidden");
  await expect(page.getByTestId("mobile-ai-prompt-send")).toBeEnabled();
  await openAiSettings(page);
  await expect(page.getByTestId("ai-model-status")).toBeVisible();
});

test("全AIが利用不可なら回答欄に理由を示し、コピーを利用できる", async ({ page }) => {
  await page.route("**/api/recipe?models", async (route) => {
    await route.fulfill({
      json: { models: aiModels.map((model) => ({ id: model.id, enabled: false })) },
    });
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  await expect(page.getByTestId("ai-model-unavailable")).toHaveText(
    "現在利用できるAIがありません。依頼文はコピーできます。",
  );
  await expect(page.getByTestId("ai-model-unavailable")).toBeVisible();
  await expect(page.getByTestId("ai-prompt-empty")).toBeHidden();
  await expect(page.getByTestId("mobile-ai-prompt-send")).toBeDisabled();
  await expect(page.getByTestId("copy-prompt-sticky")).toBeEnabled();
});
