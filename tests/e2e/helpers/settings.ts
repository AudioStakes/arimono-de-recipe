import { expect, type Page } from "@playwright/test";

export async function openAiSettings(page: Page): Promise<void> {
  await page.getByTestId("privacy-open").click();
  await expect(page.getByTestId("privacy-dialog")).toBeVisible();
}

export async function openCopyFallback(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
  });
  await page.getByTestId("copy-prompt-sticky").click();
  await expect(page.getByTestId("mobile-prompt-panel")).toBeVisible();
}
