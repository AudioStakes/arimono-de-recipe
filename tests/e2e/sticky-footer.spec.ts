import { expect, test } from "@playwright/test";

test("モバイルでは固定ボトムシートが表示され、展開と収納ができる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");

  const footer = page.locator("#bottomActions");
  const mobilePromptPanel = page.getByTestId("mobile-prompt-panel");
  await expect(footer).toHaveClass(/show/);
  await expect(mobilePromptPanel).toHaveAttribute("data-state", "closed");

  const input = page.getByTestId("combo-input-materials");
  await input.fill("豆腐");
  await input.press("Enter");

  await expect(page.getByTestId("mobile-ai-transmission-notice")).toHaveText("Cloudflare AIへ送信");
  await expect(page.getByRole("button", { name: "依頼文を見る" })).toHaveText("依頼文を見る");
  await page.getByRole("button", { name: "依頼文を見る" }).click();
  await expect(footer).toHaveAttribute("data-state", "open");
  await expect(mobilePromptPanel).toHaveAttribute("data-state", "open");
  await expect(footer).toHaveClass(/is-open/);
  await expect(mobilePromptPanel).toBeVisible();
  await expect(page.locator(".mobile-prompt-head h2")).toHaveText("AIに渡す依頼文");
  await expect(page.getByTestId("copy-prompt-sticky")).toBeVisible();
  await expect(page.getByTestId("mobile-ai-prompt-send")).toBeVisible();
  await expect(page.getByTestId("copy-prompt-mobile-panel")).toBeVisible();
  await page.locator("#sheetClose").click();
  await expect(footer).toHaveAttribute("data-state", "closed");
  await expect(mobilePromptPanel).toHaveAttribute("data-state", "closed");
  await expect(footer).not.toHaveClass(/is-open/);
});
