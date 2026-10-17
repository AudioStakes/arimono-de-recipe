import { expect, test } from "@playwright/test";

test("320pxで標準文字を大きくしてもコピー文言と両操作が収まる", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  // Exercise wider text metrics on every OS, including macOS where the default font fits.
  const session = await page.context().newCDPSession(page);
  await session.send("Page.setFontSizes", { fontSizes: { standard: 18 } });
  await page.goto("/");
  await expect(page.locator("html")).toHaveCSS("font-size", "18px");
  const copy = page.getByTestId("copy-prompt-sticky");
  const labelBounds = await copy
    .getByText("依頼文をコピー", { exact: true })
    .evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return Array.from(range.getClientRects(), (rect) => ({ left: rect.left, right: rect.right }));
    });
  expect(labelBounds).toHaveLength(1);
  const copyBounds = await copy.boundingBox();
  if (!copyBounds) throw new Error("Copy action must be rendered");
  for (const rect of labelBounds) {
    expect(rect.left).toBeGreaterThanOrEqual(copyBounds.x);
    expect(rect.right).toBeLessThanOrEqual(copyBounds.x + copyBounds.width);
  }
  for (const action of [copy, page.getByTestId("mobile-ai-prompt-send")]) {
    const bounds = await action.boundingBox();
    if (!bounds) throw new Error("Both actions must be rendered");
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

for (const width of [1280, 390, 320]) {
  test(`${width}pxでAIを先に案内し、同じ画面からコピーと明示AI送信を選べる`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let apiCalls = 0;
    await page.route("**/api/recipe", async (route) => {
      apiCalls += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "ai_binding_unavailable", message: "AI設定を確認してください。" },
        }),
      });
    });
    await page.goto("/");
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"], { origin: page.url() });
    const mobile = width < 1024;
    const ai = page.getByTestId(mobile ? "mobile-ai-prompt-send" : "ai-prompt-send");
    const copy = page.getByTestId(mobile ? "copy-prompt-sticky" : "copy-prompt");
    await expect(ai).toBeVisible();
    await expect(ai).toBeEnabled();
    await expect(copy).toBeVisible();
    await expect(copy).toBeEnabled();
    await expect(copy.getByText("依頼文をコピー", { exact: true })).toBeVisible();
    await expect(ai).toHaveAccessibleName("この依頼文をAIへ送信");
    await expect(ai).toHaveAccessibleDescription(
      "「AIへ送信」を押すと、依頼文全文をCloudflareのAIへ送信します。依頼文は入力やコピーだけでは送信しません。",
    );
    await expect(
      page.getByTestId(mobile ? "mobile-ai-transmission-notice" : "ai-transmission-notice"),
    ).toHaveText("Cloudflare AIへ送信");
    await expect(copy).toHaveAccessibleName("AI向けレシピ依頼文をコピー");
    const { aiPosition, copyPosition } = await ai.evaluate(
      (element, copyId) => {
        const secondary = document.querySelector(`[data-testid="${copyId}"]`);
        return {
          aiPosition: element.getBoundingClientRect().toJSON(),
          copyPosition: secondary?.getBoundingClientRect().toJSON(),
        };
      },
      mobile ? "copy-prompt-sticky" : "copy-prompt",
    );
    if (!aiPosition || !copyPosition) throw new Error("Both choices must be rendered");
    expect(
      aiPosition.y < copyPosition.y ||
        (aiPosition.y === copyPosition.y && aiPosition.x < copyPosition.x),
    ).toBe(true);
    if (mobile) {
      const label = copy.getByText("依頼文をコピー", { exact: true });
      expect(
        await label.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        }),
      ).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
    expect(apiCalls).toBe(0);

    await page.getByTestId("combo-input-materials").fill("豆腐");
    await page.getByTestId("combo-input-materials").press("Enter");
    await page.evaluate(() => navigator.clipboard.writeText("before-choice-copy"));
    await copy.click();
    const prompt = await page.getByTestId("prompt-output").inputValue();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(prompt).toContain("豆腐");
    expect(apiCalls).toBe(0);
    if (mobile) {
      await page.getByRole("button", { name: "依頼文を見る", exact: true }).click();
      await expect(page.getByTestId("copy-prompt-mobile-panel")).toBeVisible();
      await page.evaluate(() => navigator.clipboard.writeText("before-preview-copy"));
      await page.getByTestId("copy-prompt-mobile-panel").click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
    } else {
      await page.getByTestId("prompt-preview-toggle").click();
    }
    expect(apiCalls).toBe(0);
    await ai.click();
    await expect(page.getByTestId("ai-prompt-status")).toBeVisible();
    expect(apiCalls).toBe(1);
    const errorCopy = copy;
    await expect(errorCopy).toBeVisible();
    await expect(errorCopy).toBeEnabled();
    await page.evaluate(() => navigator.clipboard.writeText("before-keyboard-copy"));
    await errorCopy.focus();
    await errorCopy.press("Enter");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(apiCalls).toBe(1);
  });
}
