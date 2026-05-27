import { expect, test } from "@playwright/test";

test("タイトルロゴ画像とビルド済みアセットが参照できる", async ({ page }) => {
  await page.goto("/");

  const titleImage = page.locator("img.title-image");
  await expect(titleImage).toBeVisible();
  await expect(titleImage).toHaveAttribute("alt", "ありもの de レシピ プロンプトメーカー");
  await expect(page.locator('img[src="/title-banner.webp"]')).toHaveCount(1);
});

test("OGP 画像と meta が出力される", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
});
