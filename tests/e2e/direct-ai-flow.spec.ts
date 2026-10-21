import { expect, type Page, test } from "@playwright/test";
import { pressCommittedEnter } from "./helpers/combo";

const answer = "# 豆腐の料理\n\n- 豆腐を温めます。";
const response = (recipe = answer) => JSON.stringify({ recipe, model: "test-model", usage: null });

test("編集中の材料名もコピー・送信の直前に確定し、量とIDを保つ", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let posted: { prompt: string } | undefined;
  await page.route("**/api/recipe", async (route) => {
    posted = route.request().postDataJSON() as { prompt: string };
    await route.fulfill({ contentType: "application/json", body: response() });
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  const card = page.getByTestId(/^material-card-/);
  const id = await card.getAttribute("data-testid");
  await card.getByTestId(/^material-amount-/).fill("150g");
  await page.getByTestId("combo-pill-label-materials").click();
  await page.getByTestId("combo-pill-edit-materials").fill("木綿豆腐");
  await page.getByTestId("copy-prompt-sticky").click();
  let prompt = await page.getByTestId("prompt-output").inputValue();
  expect(prompt).toContain("木綿豆腐（量: 150g）");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
  expect(posted).toBeUndefined();
  await page.getByTestId("combo-pill-label-materials").click();
  await page.getByTestId("combo-pill-edit-materials").fill("冷凍豆腐");
  await page.getByTestId("mobile-ai-prompt-send").click();
  prompt = await page.getByTestId("prompt-output").inputValue();
  expect(prompt).toContain("冷凍豆腐（量: 150g）");
  await expect.poll(() => posted).toEqual({ prompt });
  await expect(page.getByTestId(id ?? "").getByTestId(/^material-amount-/)).toHaveValue("150g");
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let text = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          text = value;
        },
        readText: async () => text,
      },
    });
  });
});

async function openPreview(page: Page): Promise<void> {
  await page.getByTestId("prompt-preview-toggle").click();
}

for (const width of [1280, 390]) {
  const mobile = width < 1024;
  const sendId = "mobile-ai-prompt-send";
  const copyId = "copy-prompt-sticky";

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
    await page.getByTestId("combo-input-materials").fill("キャベツ");
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
    await openPreview(page);
    await page.getByTestId(copyId).click();
    expect(calls).toBe(0);
    if (mobile) await openPreview(page);
    await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
    const notes = `改行と"引用符"を残す\n${"あ".repeat(250)}`;
    await page.getByTestId("supplemental-notes").fill(notes);
    // Do not press Enter: submitting must commit the pending material too.
    await page.getByTestId("combo-input-materials").fill("豆腐（１丁）");
    if (mobile) await openPreview(page);
    await page.getByTestId(sendId).click();
    await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "loading");
    await expect(page.getByTestId(sendId)).toBeDisabled();
    if (mobile) {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByTestId("ai-prompt-heading")).toBeFocused();
      await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");
    }
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
    await expect(page.getByTestId("ai-prompt-reply")).toContainText("豆腐を温めます。");
    await expect(page.getByRole("heading", { name: "豆腐の料理", level: 3 })).toBeVisible();
    await expect(page.getByTestId("ai-prompt-status")).toHaveAttribute("role", "status");
    await expect(page.getByTestId("ai-prompt-panel")).toHaveCount(1);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.getByTestId(sendId)).toBeEnabled();
    await page.getByTestId(copyId).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(calls).toBe(1);
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
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
    await openPreview(page);
    await page.getByTestId(sendId).click();
    await expect(page.getByTestId("ai-prompt-status")).toContainText("AI設定がありません。");
    await expect(page.getByTestId("ai-prompt-status")).toHaveAttribute("role", "alert");
    await page.getByTestId(copyId).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(await page.getByTestId("prompt-output").inputValue());
    await page.getByTestId(sendId).click();
    await expect(page.getByTestId("ai-prompt-reply")).toContainText("豆腐を温めます。");
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
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
    await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
    const notes = "あ".repeat(11000);
    await page.getByTestId("supplemental-notes").fill(notes);
    await openPreview(page);
    await page.getByTestId(sendId).click();
    await expect(page.getByTestId("ai-prompt-status")).toContainText("送信上限を超えています");
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
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
    await openPreview(page);
    await page.getByTestId(sendId).click();
    await expect.poll(() => calls).toBe(1);
    if (!mobile) await openPreview(page);
    await page.getByTestId("combo-input-materials").focus();
    finish();
    await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "success");
    await expect(page.getByTestId("combo-input-materials")).toBeFocused();
    await openPreview(page);
    if (mobile) await openPreview(page);
    await expect(page.getByTestId("ai-prompt-reply")).toContainText("豆腐を温めます。");
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
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  await openPreview(page);
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect.poll(() => calls).toBe(1);
  await page.getByTestId("combo-input-materials").fill("キャベツ");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "idle");
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-reply")).toHaveText("新しい回答");
  finishOld();
  await completed;
  await expect(page.getByTestId("ai-prompt-reply")).toHaveText("新しい回答");
  expect(calls).toBe(2);
});

test("多くの必須・使い切り材料も、目的・品数・NGとともに全文送信できる", async ({ page }) => {
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
  for (const name of names) {
    await page.getByTestId("combo-input-materials").fill(name);
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  }
  for (const [index, name] of names.entries()) {
    const card = page.getByTestId(/^material-card-/).filter({ hasText: name });
    const usage = card.getByTestId(
      new RegExp(`^material-usage-option-.+-${index === 0 ? "use-up" : "required"}$`),
    );
    // Exercise native keyboard selection without repeating pointer frame-stability waits
    // for every setup radio; pointer and arrow-key behavior have separate UI regressions.
    await usage.press("Space");
    await expect(usage).toBeChecked();
  }
  await page
    .getByTestId(/^material-card-/)
    .filter({ hasText: "豆腐" })
    .getByTestId(/^material-amount-/)
    .fill("１丁");
  await page.getByTestId("recipe-item-toggle-cookingTools").click();
  await page.getByTestId("combo-input-cookingTools").fill("電子レンジ");
  await pressCommittedEnter(page.getByTestId("combo-input-cookingTools"));
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page
    .getByTestId("supplemental-notes")
    .fill("餃子に合う副菜を作りたい。にんにくは使わず、家族用に薄味で。");
  await openPreview(page);
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-reply")).toContainText("豆腐を温めます。");
  const prompt = await page.getByTestId("prompt-output").inputValue();
  expect(posted).toEqual({ prompt });
  for (const value of [
    ...names,
    "１丁",
    "使い切",
    "必ず使",
    "電子レンジ",
    "餃子",
    "副菜を作りたい",
    "にんにく",
    "家族用に薄味で。",
  ])
    expect(prompt).toContain(value);
  expect(calls).toBe(1);
});

test("Markdownの構造だけを表示し、生HTML・画像・危険URLから外部通信しない", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    errors.push(dialog.message());
    await dialog.dismiss();
  });
  await page.route("https://markdown-attacker.invalid/**", async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  const markdown = [
    "# 豆腐の献立",
    "**分量**を確認します。",
    "- 豆腐 1丁\n- しょうゆ 少々",
    "1. 豆腐を切る\n2. 加熱する",
    "| 材料 | 分量 |\n| --- | --- |\n| 豆腐 | 1丁 |",
    "[外部確認](https://example.com/recipe?q=1) [HTTP確認](http://example.com/)",
    "[危険](javascript:alert%281%29) [データ](data:text/html,unsafe) [相対](/private) [アンカー](#secret) [プロトコル相対](//markdown-attacker.invalid/link) [メール](mailto:a@example.com)",
    "![Markdown画像](https://markdown-attacker.invalid/md-image)",
    '<img src="https://markdown-attacker.invalid/html-image" onerror="alert(1)">',
    '<script src="https://markdown-attacker.invalid/script.js"></script>',
    '<iframe src="https://markdown-attacker.invalid/frame"></iframe>',
  ].join("\n\n");
  await page.route("**/api/recipe", (route) =>
    route.fulfill({ contentType: "application/json", body: response(markdown) }),
  );
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  await page.getByTestId("mobile-ai-prompt-send").click();
  const reply = page.getByTestId("ai-prompt-reply");
  await expect(reply.getByRole("heading", { name: "豆腐の献立", level: 3 })).toBeVisible();
  await expect(reply.locator("strong")).toHaveText("分量");
  await expect(reply.getByRole("list")).toHaveCount(2);
  await expect(reply.getByRole("table")).toBeVisible();
  await expect(reply.getByRole("cell", { name: "1丁", exact: true })).toBeVisible();
  await expect(reply.locator("img,script,iframe,object,style")).toHaveCount(0);
  await expect(reply).toContainText('<img src="https://markdown-attacker.invalid/html-image"');
  for (const label of ["危険", "データ", "相対", "アンカー", "プロトコル相対", "メール"]) {
    await expect(reply.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    await expect(reply).toContainText(label);
  }
  const link = reply.getByRole("link", { name: "外部確認", exact: true });
  await expect(link).toHaveAttribute("href", "https://example.com/recipe?q=1");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(reply.getByRole("link", { name: "HTTP確認", exact: true })).toHaveAttribute(
    "href",
    "http://example.com/",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByTestId("ai-prompt-answer-notice")).toBeVisible();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("材料と使い切り量の不足は送信せず入力へ誘導し、入力後に再試行できる", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/recipe", async (route) => {
    calls += 1;
    await route.fulfill({ contentType: "application/json", body: response() });
  });
  await page.goto("/");
  const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
  const send = page.getByTestId("mobile-ai-prompt-send");
  const input = page.getByTestId("combo-input-materials");
  await send.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("materials-error")).toBeVisible();
  await expect(page.getByTestId("ai-prompt-status")).toContainText("家にある食材");
  await expect(page.getByTestId("ai-prompt-status")).not.toContainText("再試行");
  expect(calls).toBe(0);
  await input.fill("キャベツ");
  await pressCommittedEnter(input);
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("materials-error")).toBeHidden();
  const card = page.getByTestId(/^material-card-/);
  await card.getByRole("radio", { name: "使い切る", exact: true }).check();
  if (mobile) await openPreview(page);
  await send.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");
  await expect(card.getByTestId(/^material-amount-/)).toBeFocused();
  await expect(card.getByTestId(/^material-use-up-error-/)).toContainText("量を入力");
  expect(calls).toBe(0);
  await card.getByTestId(/^material-amount-/).fill("1/2玉");
  await send.click();
  await expect(page.getByTestId("ai-prompt-reply")).toBeVisible();
  expect(calls).toBe(1);
});

for (const [length, message] of [
  [0, "応答形式"],
  [20001, "回答が長すぎます"],
] as const) {
  test(`不正な回答${length}文字でも操作でき、依頼文をコピーできる`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/recipe", (route) =>
      route.fulfill({ contentType: "application/json", body: response("あ".repeat(length)) }),
    );
    await page.goto("/");
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
    const send = page.getByTestId("mobile-ai-prompt-send");
    await send.click();
    await expect(page.getByTestId("ai-prompt-status")).toContainText(message);
    await expect(send).toBeEnabled();
    await expect(page.getByTestId("ai-prompt-reply")).toBeHidden();
    await page.getByTestId("copy-prompt-sticky").click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(await page.getByTestId("prompt-output").inputValue());
    expect(errors).toEqual([]);
  });
}

test("AI失敗後も同じ依頼文をコピーでき、入力変更で古いエラーを解消する", async ({ page }) => {
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
  const input = page.getByTestId("combo-input-materials");
  await input.fill("豆腐");
  await pressCommittedEnter(input);
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-status")).toContainText("AIを利用できません。");
  const prompt = await page.getByTestId("prompt-output").inputValue();
  await page.getByTestId("copy-prompt-sticky").click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
  expect(calls).toBe(1);
  await input.fill("キャベツ");
  await pressCommittedEnter(input);
  await expect(page.getByTestId("ai-prompt-status")).toBeEmpty();
  await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "idle");
  expect(calls).toBe(1);
});

test("過大なMarkdown表を表示せず、定型エラーからコピーと再送信に戻れる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let calls = 0;
  const table = `${"|a".repeat(20)}|\n${"|-".repeat(20)}|\n${"|a|\n".repeat(50)}`;
  await page.route("**/api/recipe", async (route) => {
    calls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: response(calls === 1 ? table : answer),
    });
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  const send = page.getByTestId("mobile-ai-prompt-send");
  await send.click();
  await expect(page.getByTestId("ai-prompt-status")).toContainText("回答を表示できませんでした");
  await expect(page.getByTestId("ai-prompt-reply")).toBeHidden();
  await page.getByTestId("copy-prompt-sticky").click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(await page.getByTestId("prompt-output").inputValue());
  await send.click();
  await expect(page.getByTestId("ai-prompt-reply")).toBeVisible();
  expect(calls).toBe(2);
  expect(errors).toEqual([]);
});

for (const width of [1280, 320]) {
  test(`${width}pxで横長の表の分量を分割せず、表内だけ横スクロールできる`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const table = `| 材料 | 分量 | 時間 | 道具 | 目的 | 下処理 | 手順 | 注意 | 保存 | 味 | 調整 | 盛付 | 温度 | 火力 | 順番 | 仕上げ |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| 豆腐 | 150g | 10分 | 鍋 | 主菜 | 切る | 温める | 加熱 | 冷蔵 | 薄味 | 適量 | 皿 | 熱め | 弱火 | 最後 | 完成 |`;
    const url = `https://example.com/${"long".repeat(100)}`;
    await page.route("**/api/recipe", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: response(`${table}\n\n[参考](${url})`),
      }),
    );
    await page.goto("/");
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
    await page.getByTestId("mobile-ai-prompt-send").click();
    const reply = page.getByTestId("ai-prompt-reply");
    const quantity = reply.getByRole("cell", { name: "150g", exact: true });
    await expect(quantity).toBeVisible();
    expect(
      await quantity.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      }),
    ).toBe(1);
    const region = reply.getByRole("region", {
      name: "回答の表（横にスクロールできます）",
      exact: true,
    });
    expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    await region.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    expect(await region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

for (const width of [1280, 390]) {
  test(`${width}pxで待機中の未確定材料をコピーすると旧通信を中断して再送信できる`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let aborts = 0;
    await page.exposeFunction("recordCopyRequestAbort", () => {
      aborts += 1;
    });
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const browserWindow = window as typeof window & {
              recordCopyRequestAbort: () => Promise<void>;
            };
            void browserWindow.recordCopyRequestAbort();
          },
          { once: true },
        );
        return originalFetch(input, init);
      };
    });
    let finishOld = () => {};
    const ready = new Promise<void>((resolve) => {
      finishOld = resolve;
    });
    const posted: { prompt: string }[] = [];
    await page.route("**/api/recipe", async (route) => {
      posted.push(route.request().postDataJSON() as { prompt: string });
      const first = posted.length === 1;
      if (first) await ready;
      await route.fulfill({
        contentType: "application/json",
        body: response(first ? "古い回答" : "新しい回答"),
      });
    });
    await page.goto("/");
    const input = page.getByTestId("combo-input-materials");
    await input.fill("豆腐");
    await pressCommittedEnter(input);
    const send = page.getByTestId("mobile-ai-prompt-send");
    const copy = page.getByTestId("copy-prompt-sticky");
    await send.click();
    await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "loading");
    await expect.poll(() => posted.length).toBe(1);
    await input.fill("キャベツ");
    await input.press("Escape");
    // Hold beyond the delayed blur commit: the copy button must not move away before click.
    await copy.click({ delay: 200 });
    const prompt = await page.getByTestId("prompt-output").inputValue();
    expect(prompt).toContain("キャベツ");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    finishOld();
    await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "idle");
    await expect(send).toBeEnabled();
    await expect(page.getByTestId("ai-prompt-reply")).toBeHidden();
    await expect.poll(() => aborts).toBe(1);
    await send.click();
    await expect(page.getByTestId("ai-prompt-reply")).toHaveText("新しい回答");
    expect(posted).toEqual([
      expect.objectContaining({ prompt: expect.not.stringContaining("キャベツ") }),
      { prompt },
    ]);
  });

  test(`${width}pxで成功後の未確定材料をコピーすると古い回答を消す`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let requests = 0;
    await page.route("**/api/recipe", async (route) => {
      requests += 1;
      await route.fulfill({ contentType: "application/json", body: response("以前の回答") });
    });
    await page.goto("/");
    const input = page.getByTestId("combo-input-materials");
    await input.fill("豆腐");
    await pressCommittedEnter(input);
    const send = page.getByTestId("mobile-ai-prompt-send");
    await send.click();
    await expect(page.getByTestId("ai-prompt-reply")).toHaveText("以前の回答");
    await input.fill("キャベツ");
    await input.press("Escape");
    await page.getByTestId("copy-prompt-sticky").click();
    const prompt = await page.getByTestId("prompt-output").inputValue();
    expect(prompt).toContain("キャベツ");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "idle");
    await expect(page.getByTestId("ai-prompt-reply")).toBeHidden();
    await expect(send).toBeEnabled();
    expect(requests).toBe(1);
  });
}

test("分量変更は検証表示を更新し、旧通信を中断して新しい分量で再送信できる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  let aborts = 0;
  await page.exposeFunction("recordAmountRequestAbort", () => {
    aborts += 1;
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          const browserWindow = window as typeof window & {
            recordAmountRequestAbort: () => Promise<void>;
          };
          void browserWindow.recordAmountRequestAbort();
        },
        { once: true },
      );
      return originalFetch(input, init);
    };
  });
  let finishOld = () => {};
  let oldCompleted = () => {};
  const ready = new Promise<void>((resolve) => {
    finishOld = resolve;
  });
  const completed = new Promise<void>((resolve) => {
    oldCompleted = resolve;
  });
  const posted: { prompt: string }[] = [];
  await page.route("**/api/recipe", async (route) => {
    posted.push(route.request().postDataJSON() as { prompt: string });
    const first = posted.length === 1;
    if (first) await ready;
    await route.fulfill({
      contentType: "application/json",
      body: response(first ? "古い分量の回答" : "新しい分量の回答"),
    });
    if (first) oldCompleted();
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
  const card = page.getByTestId(/^material-card-/);
  await card.getByRole("radio", { name: "使い切る", exact: true }).check();
  const amount = card.getByTestId(/^material-amount-/);
  const error = card.getByTestId(/^material-use-up-error-/);
  await amount.fill("1丁");
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "loading");
  await expect.poll(() => posted.length).toBe(1);
  await amount.fill("");
  await expect(amount).toHaveAttribute("required", "");
  await expect(amount).toHaveAttribute("aria-invalid", "true");
  await expect(error).toBeVisible();
  await expect(page.getByTestId("copy-prompt-sticky")).toBeEnabled();
  await expect(page.getByTestId("ai-prompt-panel")).toHaveAttribute("data-state", "idle");
  await expect.poll(() => aborts).toBe(1);
  await amount.fill("2丁");
  await expect(amount).not.toHaveAttribute("aria-invalid", "true");
  await expect(error).toBeHidden();
  const prompt = await page.getByTestId("prompt-output").inputValue();
  expect(prompt).toContain("豆腐（使い切りたい量: 2丁）");
  finishOld();
  await completed;
  await expect(page.getByTestId("ai-prompt-reply")).toBeHidden();
  await expect(page.getByTestId("mobile-ai-prompt-send")).toBeEnabled();
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-reply")).toHaveText("新しい分量の回答");
  expect(posted[1]).toEqual({ prompt });
});
