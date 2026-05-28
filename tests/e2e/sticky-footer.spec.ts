import { expect, test } from "@playwright/test";

test("モバイルでは固定ボトムシートが表示され、展開と収納ができる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");

  const footer = page.locator("#bottomActions");
  await expect(footer).toHaveClass(/show/);

  const input = page.locator('[data-combo="materials"] .combo-input');
  await input.fill("豆腐");
  await input.press("Enter");

  await expect(page.locator("#stickyChips")).toHaveClass(/show/);
  await expect(page.locator("#sheetToggle")).toContainText("レシピ依頼文を確認する");
  await expect(page.locator("#sheetExpand")).toHaveText("⌃");
  await page.locator("#sheetExpand").click();
  await expect(footer).toHaveClass(/is-open/);
  await expect(page.locator("#mobilePromptPanel")).toBeVisible();
  await expect(page.locator(".mobile-prompt-head h2")).toHaveText("AIに渡す依頼文");
  await expect(page.locator("#copyPromptSticky")).toBeHidden();
  await page.locator("#sheetClose").click();
  await expect(footer).not.toHaveClass(/is-open/);
});
