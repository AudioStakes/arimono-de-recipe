import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { pressCommittedEnter } from "./helpers/combo";

test("404ページからトップへ戻れる", async ({ page }) => {
  await page.goto("/404.html");
  await expect(page.getByRole("heading", { name: "404", level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("ページが見つかりません");
  await expect(page.locator("script")).toHaveCount(0);
  const home = page.getByRole("link", { name: "トップへ戻る" });
  await expect(home).toHaveAttribute("href", "/");
  await home.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("recipe-form")).toBeVisible();
});

async function serveBuiltAppAt(
  page: Page,
  origin: string,
  baseURL: string | undefined,
): Promise<void> {
  if (!baseURL) throw new Error("Test baseURL is required");
  const headersText = await readFile("public/_headers", "utf8");
  const csp = headersText.match(/Content-Security-Policy: (.+)/)?.[1];
  if (!csp) throw new Error("Production CSP is required");
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await page.request.get(new URL(url.pathname + url.search, baseURL).href);
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": csp },
    });
  });
}

for (const blocked of [false, true]) {
  test(`本番だけで解析を一度読み込み、解析の読込失敗=${blocked}でも操作できる`, async ({
    page,
    baseURL,
  }) => {
    let beaconRequests = 0;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://static.cloudflareinsights.com/beacon.min.js", async (route) => {
      beaconRequests += 1;
      if (blocked) {
        await route.abort();
      } else {
        await route.fulfill({
          contentType: "text/javascript",
          headers: { "access-control-allow-origin": "*" },
          body: 'document.documentElement.setAttribute("data-test-beacon-loaded", "true");',
        });
      }
    });
    const origin = "https://arimono-de-recipe.pages.dev";
    await serveBuiltAppAt(page, origin, baseURL);
    await page.goto(origin);
    const beacon = page.locator(
      'script[src="https://static.cloudflareinsights.com/beacon.min.js"]',
    );
    await expect(beacon).toHaveCount(1);
    await expect.poll(() => beaconRequests).toBe(1);
    if (!blocked) {
      await expect(page.locator("html")).toHaveAttribute("data-test-beacon-loaded", "true");
    }
    await page.getByTestId("combo-input-materials").fill("豆腐");
    await pressCommittedEnter(page.getByTestId("combo-input-materials"));
    await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐/);
    const config = await beacon.getAttribute("data-cf-beacon");
    expect(JSON.parse(config ?? "null")).toEqual({ token: "cbfdc0af97dc410f89024a9de8ecc87b" });
    await page.evaluate(() => window.dispatchEvent(new Event("load")));
    await expect(beacon).toHaveCount(1);
    expect(beaconRequests).toBe(1);
    await page.getByTestId("privacy-open").click();
    await expect(page.getByRole("dialog", { name: "プライバシー", exact: true })).toBeVisible();
    await page.getByTestId("privacy-close").click();
    expect(errors).toEqual([]);
  });
}

test("ローカルとPreviewではアクセス解析を読み込まない", async ({ page, baseURL }) => {
  let beaconRequests = 0;
  await page.route("https://static.cloudflareinsights.com/**", async (route) => {
    beaconRequests += 1;
    await route.abort();
  });
  await page.goto("/");
  await expect(page.getByTestId("privacy-open")).toBeAttached();
  await expect(page.locator("script[data-cf-beacon]")).toHaveCount(0);
  const preview = "https://preview.arimono-de-recipe.pages.dev";
  await serveBuiltAppAt(page, preview, baseURL);
  await page.goto(preview);
  await expect(page.getByTestId("privacy-open")).toBeAttached();
  await expect(page.locator("script[data-cf-beacon]")).toHaveCount(0);
  expect(beaconRequests).toBe(0);
});

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
        file: "/brand/arimono-title-logo.png",
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
