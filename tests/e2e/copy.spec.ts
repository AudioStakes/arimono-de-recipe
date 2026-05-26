import { expect, test } from "@playwright/test";

test("コピーアイコンを押すとコピー完了トーストが表示される", async ({ page }) => {
  await page.goto("/");

  await page.locator("#copyPrompt").click();
  await expect(page.locator("#copyPrompt .copy-toast")).toHaveClass(/show/);
});
