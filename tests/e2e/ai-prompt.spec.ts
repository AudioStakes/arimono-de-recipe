import { expect, type Page, test } from "@playwright/test";

const answer = '豆腐を温めます。\n<img src=x onerror="alert(1)">';
const response = (recipe = answer) => JSON.stringify({ recipe, model: "test-model", usage: null });

async function openPreview(page: Page, mobile: boolean): Promise<void> {
  if (mobile) {
    await page.getByRole("button", { name: "レシピ依頼文全文を表示", exact: true }).click();
  } else {
    await page.getByText("コピーする依頼文を確認する", { exact: true }).click();
  }
}

for (const width of [1280, 390]) {
  const mobile = width < 1024;
  const prefix = mobile ? "mobile-ai-prompt" : "ai-prompt";
  const otherPrefix = mobile ? "ai-prompt" : "mobile-ai-prompt";
  const copyId = mobile ? "copy-prompt-mobile-panel" : "copy-prompt";

  test(`${width}pxでコピー本文全文を明示送信し、待機中と回答後もコピーできる`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let calls = 0;
    let posted: { prompt: string } | undefined;
    let finish = () => {};
    const ready = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await page.route("**/api/recipe", async (route) => {
      calls += 1;
      posted = route.request().postDataJSON() as { prompt: string };
      await ready;
      await route.fulfill({ status: 200, contentType: "application/json", body: response() });
    });
    await page.goto("/");
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"], { origin: page.url() });
    await page.getByTestId("combo-input-materials").fill("キャベツ");
    await page.getByTestId("combo-input-materials").press("Enter");
    await openPreview(page, mobile);
    await page.getByTestId(copyId).click();
    expect(calls).toBe(0);
    if (mobile) await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
    const notes = `改行と"引用符"を残す\n${"あ".repeat(250)}`;
    await page.getByTestId("supplemental-notes").fill(notes);
    // Do not press Enter: submitting must commit the pending material too.
    await page.getByTestId("combo-input-materials").fill("豆腐（１丁）");
    if (mobile) await openPreview(page, mobile);
    await page.getByTestId(`${prefix}-send`).click();
    await expect(page.getByTestId(`${prefix}-panel`)).toHaveAttribute("data-state", "loading");
    await expect(page.getByTestId(`${prefix}-send`)).toBeDisabled();
    await expect(page.getByTestId(`${otherPrefix}-send`)).toBeDisabled();
    await expect.poll(() => calls).toBe(1);
    const prompt = await page.getByTestId("prompt-output").inputValue();
    expect(posted).toEqual({ prompt });
    expect(prompt).toContain("豆腐（１丁）");
    expect(prompt).toContain(notes);
    await expect(page.getByTestId("mobile-prompt-output")).toHaveValue(prompt);
    await page.getByTestId(copyId).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(calls).toBe(1);
    finish();
    await expect(page.getByTestId(`${prefix}-reply`)).toHaveValue(answer);
    await expect(page.getByTestId(`${prefix}-reply`)).toHaveAccessibleName(
      "この依頼文へのAIの回答",
    );
    await expect(page.getByTestId(`${prefix}-reply`)).toHaveAttribute("readonly");
    await expect(page.getByTestId(`${prefix}-status`)).toHaveAttribute("role", "status");
    await expect(page.getByTestId(`${otherPrefix}-status`)).not.toHaveAttribute("role", "status");
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.getByTestId(`${prefix}-send`)).toBeEnabled();
    await page.getByTestId(copyId).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(calls).toBe(1);
    if (mobile) {
      const reply = page.getByTestId(`${prefix}-reply`);
      const first = page.getByRole("button", { name: "レシピ依頼文全文を閉じる", exact: true });
      await reply.focus();
      await reply.press("Tab");
      await expect(first).toBeFocused();
      await first.press("Shift+Tab");
      await expect(reply).toBeFocused();
    }
  });

  test(`${width}pxでAI未設定の失敗から再試行でき、コピーも保持する`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let calls = 0;
    await page.route("**/api/recipe", async (route) => {
      calls += 1;
      await route.fulfill({
        status: calls === 1 ? 500 : 200,
        contentType: "application/json",
        body:
          calls === 1
            ? JSON.stringify({
                error: { code: "ai_binding_unavailable", message: "AI設定がありません。" },
              })
            : response(),
      });
    });
    await page.goto("/");
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"], { origin: page.url() });
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await page.getByTestId("combo-input-materials").press("Enter");
    await openPreview(page, mobile);
    await page.getByTestId(`${prefix}-send`).click();
    await expect(page.getByTestId(`${prefix}-status`)).toHaveText("AI設定がありません。");
    await expect(page.getByTestId(`${prefix}-status`)).toHaveAttribute("role", "alert");
    await page.getByTestId(copyId).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(await page.getByTestId("prompt-output").inputValue());
    await page.getByTestId(`${prefix}-send`).click();
    await expect(page.getByTestId(`${prefix}-reply`)).toHaveValue(answer);
    expect(calls).toBe(2);
  });

  test(`${width}pxで送信サイズを超えてもコピー全文を失わない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let calls = 0;
    await page.route("**/api/recipe", async (route) => {
      calls += 1;
      await route.abort();
    });
    await page.goto("/");
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"], { origin: page.url() });
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await page.getByTestId("combo-input-materials").press("Enter");
    await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
    const notes = "あ".repeat(11000);
    await page.getByTestId("supplemental-notes").fill(notes);
    await openPreview(page, mobile);
    await page.getByTestId(`${prefix}-send`).click();
    await expect(page.getByTestId(`${prefix}-status`)).toContainText("送信上限を超えています");
    const prompt = await page.getByTestId("prompt-output").inputValue();
    expect(prompt).toContain(notes);
    await page.getByTestId(copyId).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(calls).toBe(0);
  });

  test(`${width}pxで確認画面を閉じた後の回答がフォーカスを奪わず、再表示しても再送信しない`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let calls = 0;
    let finish = () => {};
    const ready = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await page.route("**/api/recipe", async (route) => {
      calls += 1;
      await ready;
      await route.fulfill({ status: 200, contentType: "application/json", body: response() });
    });
    await page.goto("/");
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await page.getByTestId("combo-input-materials").press("Enter");
    await openPreview(page, mobile);
    await page.getByTestId(`${prefix}-send`).click();
    await expect.poll(() => calls).toBe(1);
    if (mobile) await page.getByRole("button", { name: "閉じる", exact: true }).click();
    else await openPreview(page, mobile);
    await page.getByTestId("combo-input-materials").focus();
    finish();
    await expect(page.getByTestId(`${prefix}-panel`)).toHaveAttribute("data-state", "success");
    await expect(page.getByTestId("combo-input-materials")).toBeFocused();
    await openPreview(page, mobile);
    await expect(page.getByTestId(`${prefix}-reply`)).toHaveValue(answer);
    expect(calls).toBe(1);
  });
}

test("入力変更で旧通信を中断し、新しい依頼への回答だけを残す", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let calls = 0;
  let finishOld = () => {};
  let oldCompleted = () => {};
  const ready = new Promise<void>((resolve) => {
    finishOld = resolve;
  });
  const completed = new Promise<void>((resolve) => {
    oldCompleted = resolve;
  });
  await page.route("**/api/recipe", async (route) => {
    calls += 1;
    const first = calls === 1;
    if (first) await ready;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: response(first ? "古い回答" : "新しい回答"),
    });
    if (first) oldCompleted();
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await openPreview(page, false);
  await page.getByTestId("ai-prompt-send").click();
  await expect.poll(() => calls).toBe(1);
  await page.getByTestId("combo-input-materials").fill("キャベツ");
  await page.getByTestId("combo-input-materials").press("Enter");
  await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "idle");
  await page.getByTestId("ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-reply")).toHaveValue("新しい回答");
  finishOld();
  await completed;
  await expect(page.getByTestId("ai-prompt-reply")).toHaveValue("新しい回答");
  expect(calls).toBe(2);
});

test("候補上限を超える必須・使い切り材料も、目的・品数・NGとともに全文送信できる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let posted: { prompt: string } | undefined;
  let calls = 0;
  await page.route("**/api/recipe", async (route) => {
    calls += 1;
    posted = route.request().postDataJSON() as { prompt: string };
    await route.fulfill({ status: 200, contentType: "application/json", body: response() });
  });
  await page.goto("/");
  const names = ["豆腐", "キャベツ", "人参", "大根", "玉ねぎ", "じゃがいも", "ほうれん草"];
  for (const [index, name] of names.entries()) {
    await page.getByTestId("combo-input-materials").fill(name);
    await page.getByTestId("combo-input-materials").press("Enter");
    const card = page.getByTestId(/^material-card-/).filter({ hasText: name });
    await card
      .getByTestId(new RegExp(`^material-usage-option-.+-${index === 0 ? "use-up" : "required"}$`))
      .check();
    if (index === 0) await card.getByTestId(/^material-amount-/).fill("１丁");
  }
  await page.getByRole("radio", { name: "一緒に出す料理に合わせたい", exact: true }).check();
  await page.getByTestId("combo-input-pairingTargets").fill("餃子");
  await page.getByTestId("combo-input-pairingTargets").press("Enter");
  await page.getByRole("radio", { name: "複数品を指定", exact: true }).check();
  await page.getByTestId("recipe-item-toggle-ngFoodsAndSeasonings").click();
  await page.getByTestId("combo-input-ngFoodsAndSeasonings").fill("にんにく");
  await page.getByTestId("combo-input-ngFoodsAndSeasonings").press("Enter");
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page.getByTestId("supplemental-notes").fill("家族用に薄味で。");
  await page.getByTestId("generate-recipe").click();
  await expect(page.getByTestId("ai-recipe-error")).toContainText("合計6件まで");
  expect(calls).toBe(0);
  await openPreview(page, false);
  await page.getByTestId("ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-reply")).toHaveValue(answer);
  const prompt = await page.getByTestId("prompt-output").inputValue();
  expect(posted).toEqual({ prompt });
  for (const value of [
    ...names,
    "１丁",
    "使い切",
    "必ず使",
    "餃子",
    "複数品",
    "にんにく",
    "家族用に薄味で。",
  ])
    expect(prompt).toContain(value);
  expect(calls).toBe(1);
});
