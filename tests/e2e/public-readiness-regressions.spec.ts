import { expect, test } from "@playwright/test";
import { openCopyFallback } from "./helpers/settings";

test("モバイル展開中は背景を操作せずTabをパネル内で循環できる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  const opener = page.getByTestId("copy-prompt-sticky");
  await openCopyFallback(page);
  const close = page.getByRole("button", { name: "閉じる", exact: true });
  const first = page.getByTestId("mobile-ai-prompt-send");
  const output = page.getByTestId("mobile-prompt-output");
  await expect(output).toBeFocused();
  await output.focus();
  await output.press("Tab");
  await expect(first).toBeFocused();
  await first.press("Shift+Tab");
  await expect(output).toBeFocused();
  await page.getByTestId("combo-input-materials").evaluate((element) => {
    (element as HTMLElement).focus();
  });
  await expect(output).toBeFocused();
  const dialog = page.getByRole("dialog", { name: "AIに渡す依頼文" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await output.press("Escape");
  await expect(opener).toBeFocused();
  await page.getByTestId("combo-input-materials").focus();
  await expect(page.getByTestId("combo-input-materials")).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await opener.click();
  await close.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByTestId("mobile-action-footer")).not.toHaveAttribute("role", "dialog");
  await expect(page.getByTestId("privacy-dialog")).not.toBeVisible();
  await page.getByTestId("combo-input-materials").focus();
  await expect(page.getByTestId("combo-input-materials")).toBeFocused();
});

for (const width of [1280, 390]) {
  test(`${width}pxでネイティブ代替コピー後もキーボードのフォーカスを保持する`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await page.goto("/");
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await page.getByTestId("combo-input-materials").press("Enter");
    const textareaCount = await page.locator("textarea").count();
    const button = page.getByTestId("copy-prompt-sticky");
    await button.focus();
    await button.press("Enter");
    await expect(button).toContainText("コピーしました");
    await expect(button).toBeFocused();
    await expect(page.locator("textarea")).toHaveCount(textareaCount);
  });
}

for (const [width, clipboardAvailable] of [
  [1280, true],
  [390, true],
  [1280, false],
] as const) {
  test(`${width}px、Clipboard API=${clipboardAvailable}でコピー失敗を案内する`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    let apiCalls = 0;
    await page.route("**/api/recipe", async (route) => {
      apiCalls += 1;
      await route.abort();
    });
    await page.addInitScript((available) => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: available
          ? {
              writeText: async () => {
                throw new DOMException("Clipboard denied", "NotAllowedError");
              },
            }
          : undefined,
      });
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: () => {
          throw new DOMException("Copy denied", "SecurityError");
        },
      });
    }, clipboardAvailable);
    await page.goto("/");
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await page.getByTestId("combo-input-materials").press("Enter");
    const textareaCount = await page.locator("textarea").count();
    const mobile = width < 1024;
    await page.getByTestId("copy-prompt-sticky").click();
    const feedback = page.getByTestId(mobile ? "copy-prompt-mobile-panel" : "copy-prompt-sticky");
    await expect(feedback).toContainText("本文を選択してコピーしてください");
    await expect(page.getByTestId(mobile ? "mobile-prompt-output" : "prompt-output")).toHaveValue(
      /豆腐/,
    );
    await expect(page.locator("textarea")).toHaveCount(textareaCount);
    expect(pageErrors).toEqual([]);
    expect(apiCalls).toBe(0);
  });
}

test("その他の要望と器具を実際のフォーム操作から送信し、上限時はコピーを残す", async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1280, height: 900 });
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/recipe", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "ai_generation_failed", message: "テスト用の失敗" } }),
    });
  });
  await page.goto("/");
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page.getByTestId("supplemental-notes").fill("カレーを作りたい");
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-status")).toContainText("テスト用の失敗");
  expect(requests[0]?.["prompt"]).toContain("カレーを作りたい");
  await page.getByTestId("supplemental-notes").fill("餃子に合う副菜を作りたい");
  await page.getByTestId("recipe-item-toggle-cookingTools").click();
  await page.getByTestId("combo-input-cookingTools").fill("電子レンジ");
  await page.getByTestId("combo-input-cookingTools").press("Enter");
  await page.clock.runFor(10_000);
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-status")).toContainText("テスト用の失敗");
  expect(requests[1]?.["prompt"]).toContain("餃子に合う副菜を作りたい");
  expect(requests[1]?.["prompt"]).toContain("電子レンジ");
  expect(requests).toHaveLength(2);
  await page.getByTestId("supplemental-notes").fill("あ".repeat(11000));
  await page.clock.runFor(10_000);
  await page.getByTestId("mobile-ai-prompt-send").click();
  await expect(page.getByTestId("ai-prompt-status")).toContainText("送信上限");
  await expect(page.getByTestId("copy-prompt-sticky")).toBeEnabled();
  await expect(page.getByTestId("prompt-output")).toHaveValue(/電子レンジ/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(new RegExp("あ".repeat(11000)));
  expect(requests).toHaveLength(2);
});
