import { expect, test } from "@playwright/test";

test("ブランド見出しとビルド済みアセットが参照できる", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "ありもの de レシピ", level: 1, exact: true }),
  ).toHaveCount(1);
  const logo = page.getByRole("img", { name: "ありもの de レシピ", exact: true });
  for (const width of [320, 390, 719, 720, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    await expect(logo).toBeVisible();
    await expect
      .poll(() =>
        logo.evaluate((image: HTMLImageElement) => ({
          loaded: image.complete && image.naturalWidth > 0,
          file: new URL(image.currentSrc).pathname,
        })),
      )
      .toEqual({
        loaded: true,
        file: "/brand/logo-horizontal.webp",
      });
    const bounds = await logo.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }

  for (const rel of ["icon", "apple-touch-icon"]) {
    const href = await page.locator(`link[rel="${rel}"]`).getAttribute("href");
    expect(href).toMatch(/^\/brand\/.+\.png$/);
    if (!href) throw new Error(`Missing ${rel} asset`);
    const response = await page.request.get(href);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("OGP 画像と meta が出力される", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://arimono-de-recipe.pages.dev/brand/logo-compact.webp",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://arimono-de-recipe.pages.dev/",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://arimono-de-recipe.pages.dev/",
  );
  const preview = await page.request.get("/brand/logo-compact.webp");
  expect(preview.ok()).toBe(true);
  expect(preview.headers()["content-type"]).toContain("image/webp");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
});
