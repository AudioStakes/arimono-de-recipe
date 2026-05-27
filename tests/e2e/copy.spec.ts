import { expect, test } from "@playwright/test";

test("コピーアイコンは本文をクリップボードに書き込み、トーストを出す", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: page.url(),
  });

  await page.locator('[data-combo="materials"] .combo-input').fill("豆腐");
  await page.locator('[data-combo="materials"] .combo-input').press("Enter");

  await page.locator("#copyPrompt").click();
  await expect(page.locator("#copyPrompt .copy-toast")).toHaveClass(/show/);
  await expect(page.locator("#copyPrompt .copy-toast")).toHaveText("コピーしました");
  const clipboardText1 = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText1).toContain("【食材・材料】");

  await page.locator("#copyPromptSticky").dispatchEvent("click");
  await expect(page.locator("#copyPromptSticky .copy-toast")).toHaveClass(/show/);
  const clipboardText2 = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText2).toContain("【食材・材料】");

  await page.waitForTimeout(1600);
  await expect(page.locator("#copyPrompt .copy-toast")).not.toHaveClass(/show/);
  await expect(page.locator("#copyPromptSticky .copy-toast")).not.toHaveClass(/show/);
  await expect(page.locator("#notice")).toHaveCount(0);
});
