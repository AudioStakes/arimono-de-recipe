import { expect, test } from "@playwright/test";
import { pressCommittedEnter } from "./helpers/combo";

test("入力から候補選択・調理タブまで各ブラウザで操作できる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let calls = 0;
  await page.route("**/api/recipe", async (route) => {
    calls += 1;
    expect(route.request().postDataJSON()).toMatchObject({
      mode: "candidates",
      materials: [{ name: "豆腐", usage: "auto" }],
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: ["a", "b", "c"].map((id, index) => ({
          id,
          title: ["豆腐の塩焼き", "豆腐のスープ", "温やっこ"][index],
          time: 10,
          badges: ["easy"],
          use: ["豆腐"],
          miss: [],
          why: "家にある材料で作れます。",
          ing: ["豆腐", "塩", "油"],
          steps: ["豆腐を切る", "火を通して味を調える"],
        })),
        model: "test-model",
        usage: null,
      }),
    });
  });
  await page.goto("/");
  const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
  const prefix = mobile ? "mobile-" : "";
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐/);
  expect(calls).toBe(0);
  await page.getByTestId(mobile ? "generate-recipe-mobile" : "generate-recipe").click();
  await expect(page.getByTestId(`${prefix}recipe-candidate-list`)).toBeVisible();
  await page.getByTestId(`${prefix}recipe-candidate-select-a`).click();
  await expect(page.getByTestId(`${prefix}recipe-candidate-detail`)).toContainText("豆腐の塩焼き");
  await page.getByTestId(`${prefix}recipe-candidate-cook`).click();
  await expect(page.getByTestId(`${prefix}recipe-cooking-panel`)).toContainText("豆腐");
  const materials = page.getByTestId(`${prefix}recipe-cooking-tab-materials`);
  await materials.focus();
  await materials.press("ArrowRight");
  await expect(page.getByTestId(`${prefix}recipe-cooking-tab-instructions`)).toBeFocused();
  await expect(page.getByTestId(`${prefix}recipe-cooking-panel`)).toContainText("豆腐を切る");
  await page.getByTestId(`${prefix}recipe-cooking-tab-taste`).click();
  await expect(page.getByTestId(`${prefix}recipe-cooking-tab-taste`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(calls).toBe(1);
  expect(errors).toEqual([]);
});

test("AI失敗後も同じ依頼文をコピーでき、入力変更で古いエラーを解消できる", async ({ page }) => {
  let copied = "";
  await page.exposeFunction("recordCopiedPrompt", (text: string) => {
    copied = text;
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          const browserWindow = window as typeof window & {
            recordCopiedPrompt: (text: string) => Promise<void>;
          };
          await browserWindow.recordCopiedPrompt(text);
        },
      },
    });
  });
  let calls = 0;
  await page.route("**/api/recipe", async (route) => {
    calls += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "ai_binding_unavailable", message: "AIを利用できません。" },
      }),
    });
  });
  await page.goto("/");
  const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
  const input = page.getByTestId("combo-input-materials");
  await input.fill("豆腐");
  await pressCommittedEnter(input);
  await page.getByTestId(mobile ? "generate-recipe-mobile" : "generate-recipe").click();
  const error = page.getByTestId(mobile ? "mobile-ai-recipe-error" : "ai-recipe-error");
  await expect(error).toBeVisible();
  await page.getByTestId(mobile ? "copy-prompt-mobile-panel" : "copy-prompt").click();
  const prompt = await page.getByTestId("prompt-output").inputValue();
  await expect.poll(() => copied).toBe(prompt);
  expect(calls).toBe(1);
  if (mobile) await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await input.fill("キャベツ");
  await pressCommittedEnter(input);
  await expect(error).toBeHidden();
  expect(calls).toBe(1);
});

test("依頼文全文の明示送信と自由文回答の安全な表示を各ブラウザで確認する", async ({ page }) => {
  const answer = '豆腐を使います。<img src=x onerror="alert(1)">';
  let posted: unknown;
  await page.route("**/api/recipe", async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ recipe: answer, model: "test-model", usage: null }),
    });
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
  if (mobile) {
    await page.getByRole("button", { name: "レシピ依頼文全文を表示", exact: true }).click();
  } else {
    await page.getByText("コピーする依頼文を確認する", { exact: true }).click();
  }
  expect(posted).toBeUndefined();
  const prefix = mobile ? "mobile-ai-prompt" : "ai-prompt";
  await page.getByTestId(`${prefix}-send`).click();
  await expect(page.getByTestId(`${prefix}-reply`)).toHaveValue(answer);
  expect(posted).toEqual({ prompt: await page.getByTestId("prompt-output").inputValue() });
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});
