import { expect, test } from "@playwright/test";

test("2つの実行方法が表示され、AI生成は最新の依頼文を送って結果を表示する", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let resolveApiResponse: (() => void) | undefined;
  const apiResponseReady = new Promise<void>((resolve) => {
    resolveApiResponse = resolve;
  });
  await page.route("**/api/recipe", async (route) => {
    const body = route.request().postDataJSON() as { prompt?: unknown };
    expect(typeof body.prompt).toBe("string");
    expect(body.prompt).toContain("未確定の豆腐");
    await apiResponseReady;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        recipe: "### レシピ名\n豆腐のあんかけ",
        model: "test-model",
        usage: null,
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("generate-recipe")).toBeVisible();
  await expect(page.getByTestId("copy-prompt")).toContainText("AI向けレシピ依頼文をコピー");

  await page.getByTestId("combo-input-materials").fill("未確定の豆腐");
  const requestSeen = page.waitForRequest("**/api/recipe");
  await page.getByTestId("generate-recipe").click();
  await requestSeen;

  await expect(page.getByTestId("generate-recipe")).toBeDisabled();
  await expect(page.getByTestId("generate-recipe")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "loading");
  await expect(page.getByTestId("ai-recipe-status")).toHaveAttribute("role", "status");
  await expect(page.getByTestId("mobile-ai-recipe-status")).not.toHaveAttribute("role", "status");
  await expect(page.getByTestId("copy-prompt")).toBeEnabled();

  resolveApiResponse?.();
  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "success");
  await expect(page.getByTestId("ai-recipe-status")).toHaveAttribute("role", "status");
  await expect(page.getByTestId("mobile-ai-recipe-status")).not.toHaveAttribute("role", "status");
  await expect(page.getByTestId("ai-recipe-content")).toContainText("豆腐のあんかけ");
  await expect(page.getByTestId("ai-recipe-model")).toContainText("test-model");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/未確定の豆腐/);
});

test("API失敗時はエラーとコピー導線を表示する", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/api/recipe", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "ai_generation_failed",
          message: "AIへの依頼に失敗しました。",
        },
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await page.getByTestId("generate-recipe").click();

  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "error");
  await expect(page.getByTestId("ai-recipe-error")).toHaveAttribute("role", "alert");
  await expect(page.getByTestId("mobile-ai-recipe-error")).not.toHaveAttribute("role", "alert");
  await expect(page.getByTestId("ai-recipe-error")).toContainText("AI向けレシピ依頼文をコピーして");
  await expect(page.getByTestId("copy-prompt")).toBeVisible();
  await expect(page.getByTestId("copy-prompt")).toBeEnabled();
});

test("モバイルの展開パネルでも2つの実行方法が使える", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.route("**/api/recipe", async (route) => {
    const body = route.request().postDataJSON() as { prompt?: unknown };
    expect(String(body.prompt)).toContain("豆腐");
    const longRecipe = [
      "豆腐のスープ",
      ...Array.from({ length: 18 }, (_, index) => `${index + 1}. 豆腐を使った手順です。`),
    ].join("\n");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        recipe: longRecipe,
        model: "mobile-test-model",
        usage: null,
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await page.getByRole("button", { name: "レシピ依頼文全文を表示" }).click();

  await expect(page.getByTestId("generate-recipe-mobile")).toBeVisible();
  await expect(page.getByTestId("copy-prompt-mobile-panel")).toBeVisible();
  await expect(page.getByTestId("mobile-prompt-output")).toHaveValue(/豆腐/);

  await page.getByTestId("generate-recipe-mobile").click();
  await expect(page.getByTestId("mobile-ai-recipe-panel")).toHaveAttribute("data-state", "success");
  await expect(page.getByTestId("mobile-ai-recipe-status")).toHaveAttribute("role", "status");
  await expect(page.getByTestId("ai-recipe-status")).not.toHaveAttribute("role", "status");
  await expect(page.getByTestId("mobile-ai-recipe-content")).toContainText("豆腐のスープ");

  const panelBox = await page.getByTestId("mobile-ai-recipe-panel").boundingBox();
  expect(panelBox).not.toBeNull();
  if (!panelBox) throw new Error("mobile AI recipe panel was not visible.");
  expect(panelBox.y).toBeGreaterThanOrEqual(0);
  expect(panelBox.y).toBeLessThan(await page.evaluate(() => window.innerHeight));
  const closeBox = await page
    .getByTestId("mobile-prompt-panel")
    .getByRole("button", { name: "閉じる" })
    .boundingBox();
  expect(closeBox).not.toBeNull();
  if (!closeBox) throw new Error("sheet close button was not visible.");
  expect(closeBox.y).toBeGreaterThanOrEqual(0);
  expect(closeBox.y).toBeLessThan(await page.evaluate(() => window.innerHeight));

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test("条件変更後の古いAI応答は表示しない", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let resolveApiResponse: (() => void) | undefined;
  const apiResponseReady = new Promise<void>((resolve) => {
    resolveApiResponse = resolve;
  });

  await page.route("**/api/recipe", async (route) => {
    await apiResponseReady;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        recipe: "古い条件のレシピ",
        model: "stale-test-model",
        usage: null,
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  const requestSeen = page.waitForRequest("**/api/recipe");
  await page.getByTestId("generate-recipe").click();
  await requestSeen;
  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "loading");

  await page.getByTestId("combo-input-materials").fill("キャベツ");
  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "idle");
  resolveApiResponse?.();

  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "idle");
  await expect(page.getByText("古い条件のレシピ")).toHaveCount(0);
});
