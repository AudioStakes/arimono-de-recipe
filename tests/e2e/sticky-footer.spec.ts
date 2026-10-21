import { expect, test } from "@playwright/test";
import { openCopyFallback } from "./helpers/settings";

test("固定フッターは操作と作者・プライバシーを表示し、通常プレビューはページ内で開く", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  const footer = page.getByTestId("mobile-action-footer");
  await expect(footer).toHaveClass(/show/);
  await expect(footer.getByTestId("site-footer")).toContainText("Created by AudioStakes");
  await expect(footer.getByTestId("privacy-open")).toBeVisible();
  await expect(footer.getByText("Cloudflare AIへ送信", { exact: true })).toHaveCount(0);
  await expect(footer.getByRole("button", { name: "依頼文を見る", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("ai-model-select")).toBeHidden();
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await page.getByTestId("prompt-preview-toggle").click();
  await expect(page.getByTestId("prompt-output")).toBeVisible();
  await expect(page.getByTestId("mobile-prompt-panel")).toBeHidden();
  await openCopyFallback(page);
  await expect(footer).toHaveAttribute("data-state", "open");
  await expect(page.getByTestId("copy-prompt-mobile-panel")).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(footer).toHaveAttribute("data-state", "closed");
  await expect(page.getByTestId("copy-prompt-sticky")).toBeFocused();
});
