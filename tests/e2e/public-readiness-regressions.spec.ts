import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`${width}pxでコピーAPIと代替コピーが例外でも手動コピーを案内する`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    let apiCalls = 0;
    await page.route("**/api/recipe", async (route) => {
      apiCalls += 1;
      await route.abort();
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException("Clipboard denied", "NotAllowedError");
          },
        },
      });
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: () => {
          throw new DOMException("Copy denied", "SecurityError");
        },
      });
    });
    await page.goto("/");
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await page.getByTestId("combo-input-materials").press("Enter");
    const mobile = width < 1024;
    await page.getByTestId(mobile ? "copy-prompt-sticky" : "copy-prompt").click();
    const feedback = page.getByTestId(mobile ? "copy-prompt-mobile-panel" : "copy-prompt");
    await expect(feedback).toContainText("本文を選択してコピーしてください");
    await expect(page.getByTestId(mobile ? "mobile-prompt-output" : "prompt-output")).toHaveValue(
      /豆腐/,
    );
    expect(pageErrors).toEqual([]);
    expect(apiCalls).toBe(0);
  });
}

test("料理の目的と品数を実際のフォーム操作から送信し、上限時はコピーを残す", async ({ page }) => {
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
  await page.getByRole("radio", { name: "作りたい料理がある", exact: true }).check();
  await page.getByTestId("combo-input-targetDish").fill("カレー");
  await page.getByTestId("combo-input-targetDish").press("Enter");
  await page.getByTestId("generate-recipe").click();
  await expect(page.getByTestId("ai-recipe-error")).toBeVisible();
  expect(requests[0]?.["notes"]).toContain("作りたい料理");

  await page.getByRole("radio", { name: "一緒に出す料理に合わせたい", exact: true }).check();
  await page.getByTestId("combo-input-pairingTargets").fill("カレー");
  await page.getByTestId("combo-input-pairingTargets").press("Enter");
  await page.getByRole("radio", { name: "複数品を指定", exact: true }).check();
  await page.getByTestId("generate-recipe").click();
  await expect(page.getByTestId("ai-recipe-error")).toBeVisible();
  expect(requests[1]?.["notes"]).toContain("一緒に出す料理");
  expect(requests[1]?.["notes"]).toContain("複数品");
  expect(requests).toHaveLength(2);

  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page.getByTestId("supplemental-notes").fill("あ".repeat(180));
  await page.getByTestId("generate-recipe").click();
  await expect(page.getByTestId("ai-recipe-error")).toContainText("長すぎます");
  await expect(page.getByTestId("copy-prompt")).toBeEnabled();
  await expect(page.getByTestId("prompt-output")).toHaveValue(/カレー/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(new RegExp("あ".repeat(180)));
  expect(requests).toHaveLength(2);
});
