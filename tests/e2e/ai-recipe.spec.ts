import { expect, test } from "@playwright/test";

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
};

function apiSuccessBody() {
  return JSON.stringify({
    ...candidateResponse,
    model: "test-model",
    usage: null,
  });
}

test("AI生成は短い候補requestを送り、3候補から詳細をローカル表示する", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let callCount = 0;
  let resolveApiResponse: (() => void) | undefined;
  const apiResponseReady = new Promise<void>((resolve) => {
    resolveApiResponse = resolve;
  });
  await page.route("**/api/recipe", async (route) => {
    callCount += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body["mode"]).toBe("candidates");
    expect(body["prompt"]).toBeUndefined();
    expect(body["materials"]).toEqual([{ name: "未確定の豆腐", usage: "auto" }]);
    expect(JSON.stringify(body)).not.toContain("## 役割");
    await apiResponseReady;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: apiSuccessBody(),
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("generate-recipe")).toContainText("AIで候補を見る");
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
  await expect(page.getByTestId("ai-recipe-status")).toBeFocused();
  await expect(page.getByTestId(/^recipe-candidate-[abc]$/)).toHaveCount(3);
  await expect(page.getByTestId("recipe-candidate-a")).toContainText("豆腐のあんかけ");
  await expect(page.getByTestId("recipe-candidate-a")).toContainText("15分");
  await expect(page.getByTestId("recipe-candidate-a")).toContainText("買い足しなし");
  await expect(page.getByTestId("recipe-candidate-a")).toContainText("豆腐");
  await expect(page.getByTestId("recipe-candidate-a")).toContainText(
    "豆腐を主役にして短時間で作れます。",
  );
  await expect(page.getByTestId("recipe-candidate-a").getByRole("button")).toHaveAccessibleName(
    "「豆腐のあんかけ」の詳細を表示",
  );
  await expect(page.getByTestId("recipe-candidate-select-a")).not.toHaveAttribute("aria-controls");
  await expect(page.getByTestId("recipe-candidate-b")).toContainText("不足あり");
  await expect(page.getByTestId("recipe-candidate-b")).toContainText("卵");

  await page.getByTestId("recipe-candidate-select-a").click();
  await expect(page.getByTestId("recipe-candidate-select-a")).toHaveAttribute(
    "aria-controls",
    "recipe-candidate-detail",
  );
  await expect(page.getByTestId("recipe-candidate-detail")).toBeFocused();
  await expect(page.getByTestId("recipe-candidate-detail")).toContainText("豆腐のあんかけ");
  await expect(page.getByTestId("recipe-candidate-detail")).toContainText("片栗粉");
  await expect(page.getByTestId("recipe-candidate-detail")).toContainText("あんを作る");
  await page.getByTestId("recipe-candidate-back").click();
  await expect(page.getByTestId("recipe-candidate-list")).toBeFocused();
  expect(callCount).toBe(1);
  await expect(page.getByTestId("prompt-output")).toHaveValue(/未確定の豆腐/);
});

test("食材未入力ではAI候補APIを呼ばず入力案内を表示する", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let callCount = 0;
  await page.route("**/api/recipe", async (route) => {
    callCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: apiSuccessBody(),
    });
  });

  await page.goto("/");
  await page.getByTestId("generate-recipe").click();

  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "error");
  await expect(page.getByTestId("ai-recipe-error")).toContainText(
    "先に「家にある食材・材料」を入力してください",
  );
  await expect(page.getByTestId("copy-prompt")).toBeEnabled();
  expect(callCount).toBe(0);
});

test("使い切る量が未入力ならAI候補APIを呼ばず、量入力後に送信できる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let callCount = 0;
  await page.route("**/api/recipe", async (route) => {
    callCount += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body["materials"]).toEqual([{ name: "豆腐", usage: "use_up", amount: "150g" }]);
    expect(body["notes"]).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: apiSuccessBody(),
    });
  });

  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");

  const tofuRow = page.locator("[data-material-request-id]").filter({ hasText: "豆腐" });
  await tofuRow.locator('input[value="use-up"]').check();
  await expect(tofuRow.getByText("使い切る場合は量を入力してください。")).toBeVisible();

  await page.getByTestId("generate-recipe").click();
  await expect(tofuRow.getByLabel("量（必須）")).toBeFocused();
  await expect(tofuRow.getByText("使い切る場合は量を入力してください。")).toHaveAttribute(
    "role",
    "alert",
  );
  expect(callCount).toBe(0);

  const requestSeen = page.waitForRequest("**/api/recipe");
  await tofuRow.getByLabel("量（必須）").fill("150g");
  await expect(tofuRow.getByText("使い切る場合は量を入力してください。")).toBeHidden();
  await page.getByTestId("generate-recipe").click();
  await requestSeen;
  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "success");
  expect(callCount).toBe(1);
});

test("モバイルでも使い切る量が未入力ならAI候補APIを呼ばない", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  let callCount = 0;
  await page.route("**/api/recipe", async (route) => {
    callCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: apiSuccessBody(),
    });
  });

  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");

  const tofuRow = page.locator("[data-material-request-id]").filter({ hasText: "豆腐" });
  await tofuRow.locator('input[value="use-up"]').check();
  await page.getByTestId("generate-recipe-mobile").click();

  await expect(tofuRow.getByLabel("量（必須）")).toBeFocused();
  await expect(tofuRow.getByText("使い切る場合は量を入力してください。")).toBeVisible();
  await expect(page.getByTestId("mobile-prompt-panel")).toHaveAttribute("data-state", "closed");
  expect(callCount).toBe(0);
});

test("API失敗時はエラーとコピー導線を維持し、コピーできる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let callCount = 0;
  await page.route("**/api/recipe", async (route) => {
    callCount += 1;
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
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: page.url(),
  });
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await page.getByTestId("generate-recipe").click();

  await expect(page.getByTestId("ai-recipe-panel")).toHaveAttribute("data-state", "error");
  await expect(page.getByTestId("ai-recipe-error")).toBeFocused();
  await expect(page.getByTestId("ai-recipe-error")).toHaveAttribute("role", "alert");
  await expect(page.getByTestId("mobile-ai-recipe-error")).not.toHaveAttribute("role", "alert");
  await expect(page.getByTestId("ai-recipe-error")).toContainText("AI向けレシピ依頼文をコピーして");
  await expect(page.getByTestId("copy-prompt")).toBeVisible();
  await expect(page.getByTestId("copy-prompt")).toBeEnabled();

  await page.getByTestId("copy-prompt").click();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("### 家にある食材・材料");
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("豆腐");
  expect(callCount).toBe(1);
});

test("モバイルのAPI失敗時も展開パネル内のコピー導線を維持する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  let callCount = 0;
  await page.route("**/api/recipe", async (route) => {
    callCount += 1;
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
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: page.url(),
  });
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await page.getByTestId("generate-recipe-mobile").click();

  await expect(page.getByTestId("mobile-prompt-panel")).toHaveAttribute("data-state", "open");
  await expect(page.getByTestId("mobile-ai-recipe-panel")).toHaveAttribute("data-state", "error");
  await expect(page.getByTestId("mobile-ai-recipe-error")).toHaveAttribute("role", "alert");
  await expect(page.getByTestId("copy-prompt-mobile-panel")).toBeVisible();
  await expect(page.getByTestId("copy-prompt-mobile-panel")).toBeEnabled();

  await page.getByTestId("copy-prompt-mobile-panel").click();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("### 家にある食材・材料");
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("豆腐");
  expect(callCount).toBe(1);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});

test("モバイルの固定CTAから候補を見て詳細選択しても追加APIを呼ばない", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  let callCount = 0;
  await page.route("**/api/recipe", async (route) => {
    callCount += 1;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body["mode"]).toBe("candidates");
    expect(body["materials"]).toEqual([{ name: "豆腐", usage: "auto" }]);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: apiSuccessBody(),
    });
  });

  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");

  await expect(page.getByTestId("generate-recipe-mobile")).toBeVisible();
  await page.getByTestId("generate-recipe-mobile").click();
  await expect(page.getByTestId("mobile-prompt-panel")).toHaveAttribute("data-state", "open");
  await expect(page.getByTestId("mobile-ai-recipe-panel")).toHaveAttribute("data-state", "success");
  await expect(page.getByTestId("mobile-ai-recipe-status")).toHaveAttribute("role", "status");
  await expect(page.getByTestId("ai-recipe-status")).not.toHaveAttribute("role", "status");
  await expect(page.getByTestId("mobile-recipe-candidate-list")).toBeVisible();
  await expect(page.getByTestId(/^mobile-recipe-candidate-[abc]$/)).toHaveCount(3);

  await page.getByTestId("mobile-recipe-candidate-select-b").click();
  await expect(page.getByTestId("mobile-recipe-candidate-detail")).toContainText("キャベツ炒め");
  await expect(page.getByTestId("mobile-recipe-candidate-detail")).toContainText("卵");
  await expect(page.getByTestId("mobile-recipe-candidate-detail")).toContainText("味を調える");
  expect(callCount).toBe(1);

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
      body: apiSuccessBody(),
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
  await expect(page.getByText("豆腐のあんかけ")).toHaveCount(0);
});
