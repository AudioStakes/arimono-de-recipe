import { expect, test } from "@playwright/test";

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
    const ai = page.getByTestId(mobile ? "generate-recipe-mobile" : "generate-recipe");
    const copy = page.getByTestId(mobile ? "copy-prompt-sticky" : "copy-prompt");
    await expect(ai).toBeVisible();
    await expect(ai).toBeEnabled();
    await expect(copy).toBeVisible();
    await expect(copy).toBeEnabled();
    await expect(copy.getByText("AI向けレシピ依頼文をコピー", { exact: true })).toBeVisible();
    const aiPosition = await (mobile
      ? ai
      : page.getByRole("heading", { name: "このアプリでAIに聞く", exact: true })
    ).boundingBox();
    const copyPosition = await (mobile
      ? copy
      : page.getByRole("heading", { name: "依頼文を作ってコピー", exact: true })
    ).boundingBox();
    if (!aiPosition || !copyPosition) throw new Error("Both choices must be rendered");
    expect(
      aiPosition.y < copyPosition.y ||
        (aiPosition.y === copyPosition.y && aiPosition.x < copyPosition.x),
    ).toBe(true);
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
      await page.getByRole("button", { name: "レシピ依頼文全文を表示", exact: true }).click();
      await expect(page.getByTestId("copy-prompt-mobile-panel")).toBeVisible();
      await page.evaluate(() => navigator.clipboard.writeText("before-preview-copy"));
      await page.getByTestId("copy-prompt-mobile-panel").click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
      await page.getByRole("button", { name: "閉じる", exact: true }).click();
    } else {
      await page.getByText("コピーする依頼文を確認する", { exact: true }).click();
    }
    expect(apiCalls).toBe(0);
    await ai.click();
    await expect(
      page.getByTestId(mobile ? "mobile-ai-recipe-error" : "ai-recipe-error"),
    ).toBeVisible();
    expect(apiCalls).toBe(1);
    const errorCopy = mobile ? page.getByTestId("copy-prompt-mobile-panel") : copy;
    await expect(errorCopy).toBeVisible();
    await expect(errorCopy).toBeEnabled();
    await page.evaluate(() => navigator.clipboard.writeText("before-keyboard-copy"));
    await errorCopy.focus();
    await errorCopy.press("Enter");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(apiCalls).toBe(1);
  });
}
