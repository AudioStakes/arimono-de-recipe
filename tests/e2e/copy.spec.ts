import { expect, test } from "@playwright/test";

test("コピー操作は本文をクリップボードに書き込み、一時的に成功文言へ変わる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: page.url(),
  });

  await page.locator('[data-combo="materials"] .combo-input').fill("豆腐");
  await page.locator('[data-combo="materials"] .combo-input').press("Enter");

  await page.locator("#copyPrompt").click();
  await expect(page.locator("#copyPrompt .copy-label")).toHaveText(
    "コピーしました。AIへ渡してください",
  );
  const clipboardText1 = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText1).toContain("### 家にある食材");

  await page.setViewportSize({ width: 390, height: 700 });
  await page.reload();
  await page.locator('[data-combo="materials"] .combo-input').fill("豆腐");
  await page.locator('[data-combo="materials"] .combo-input').press("Enter");
  await page.locator("#copyPromptSticky").dispatchEvent("click");
  await expect(page.locator("#copyPromptSticky .copy-label")).toHaveText(
    "コピーしました。AIへ渡してください",
  );
  const clipboardText2 = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText2).toContain("### 家にある食材");

  await page.waitForTimeout(1900);
  await expect(page.locator("#copyPrompt .copy-label")).toHaveText("依頼文をコピー");
  await expect(page.locator("#copyPromptSticky .copy-label")).toHaveText(
    "AIへ渡す依頼文をコピーする",
  );
  await expect(page.locator("#notice")).toHaveCount(0);
});
