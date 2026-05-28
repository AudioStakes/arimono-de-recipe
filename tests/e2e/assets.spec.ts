import { expect, test } from "@playwright/test";

test("ブランド見出しとビルド済みアセットが参照できる", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".brand-fridge")).toBeVisible();
  await expect(page.locator(".brand-title-text")).toHaveText("ありもの de レシピ");
});

test("OGP 画像と meta が出力される", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
});
