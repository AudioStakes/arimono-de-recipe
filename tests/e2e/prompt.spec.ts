import { expect, test } from "@playwright/test";

test("フォーム入力に応じてプロンプト欄が自動更新される", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-combo="materials"] input').fill("豆腐");
  await page.locator('[data-combo="materials"] input').press("Enter");

  await expect(page.locator("#output")).toHaveValue(/【材料】\n- 豆腐/);
});
