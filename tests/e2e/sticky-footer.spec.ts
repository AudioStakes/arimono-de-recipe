import { expect, test } from "@playwright/test";

test("固定フッターは入力後に表示され、本文ボタンが見えると隠れる", async ({ page }) => {
  await page.goto("/");

  const footer = page.locator("#bottomActions");
  await expect(footer).toHaveClass(/suppress/);

  const input = page.locator('[data-combo="materials"] input');
  await input.fill("豆腐");
  await input.press("Enter");

  await expect(footer).toHaveClass(/show/);
  await expect(page.locator("#stickyChips")).toHaveClass(/show/);

  await page.locator("#generatePromptInline").scrollIntoViewIfNeeded();
  await expect(footer).toHaveClass(/suppress/);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(footer).toHaveClass(/suppress/);
});
