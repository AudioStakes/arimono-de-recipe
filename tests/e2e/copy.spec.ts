import { expect, test } from "@playwright/test";

test("コピー操作は本文をクリップボードに書き込み、一時的に成功文言へ変わる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: page.url(),
  });

  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");

  await page.getByTestId("copy-prompt-sticky").click();
  await expect(page.getByTestId("copy-prompt-sticky")).toContainText(
    "コピーしました。普段使っているAIに貼り付けてください。",
  );
  const clipboardText1 = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText1).toContain("### 家にある食材・材料");

  await page.setViewportSize({ width: 390, height: 700 });
  await page.reload();
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await expect(page.getByTestId("copy-prompt-sticky")).toBeVisible();
  await expect(page.getByTestId("copy-prompt-sticky")).toBeEnabled();
  await page.getByTestId("copy-prompt-sticky").click();
  await expect(page.getByTestId("copy-prompt-sticky")).toContainText(
    "コピーしました。普段使っているAIに貼り付けてください。",
  );
  const clipboardText2 = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText2).toContain("### 家にある食材・材料");

  await page.waitForTimeout(1900);
  await expect(page.getByTestId("copy-prompt-sticky")).toContainText("依頼文をコピー");
  await expect(page.locator("#notice")).toHaveCount(0);
});

test("入力を変更したあとの再コピーでクリップボード内容が上書きされる", async ({ page }) => {
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: page.url(),
  });

  const input = page.getByTestId("combo-input-materials");
  const copyButton = page.getByTestId("copy-prompt-sticky");

  await input.fill("最初の食材");
  await input.press("Enter");
  await copyButton.click();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("最初の食材");

  await input.fill("次の食材");
  await input.press("Enter");
  await copyButton.click();

  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("次の食材");
});

test("未確定の入力に変えた直後の再コピーでも最新内容が上書きされる", async ({ page }) => {
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: page.url(),
  });

  const input = page.getByTestId("combo-input-materials");
  const copyButton = page.getByTestId("copy-prompt-sticky");

  await input.fill("最初の食材");
  await input.press("Enter");
  await copyButton.click();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("最初の食材");

  await input.fill("未確定の次の食材");
  await copyButton.click();

  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("未確定の次の食材");
});

test("モバイルのページ内プレビューから最新の依頼文を確認・コピーできる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: page.url(),
  });

  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await page.getByTestId("prompt-preview-toggle").click();

  await expect(page.getByTestId("prompt-output")).toBeVisible();
  await page.getByTestId("copy-prompt-sticky").click();
  await expect(page.getByTestId("copy-prompt-sticky")).toContainText(
    "コピーしました。普段使っているAIに貼り付けてください。",
  );
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("### 家にある食材・材料");

  await page.waitForTimeout(2700);
  await expect(page.getByTestId("copy-prompt-sticky")).toContainText("依頼文をコピー");
});

test("モバイル固定コピーのフォールバックは展開パネルを開いてパネル側へ結果を表示する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard unavailable.");
        },
      },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => true,
    });
  });
  await page.goto("/");

  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");

  await page.getByTestId("copy-prompt-sticky").click();

  await expect(page.getByTestId("mobile-prompt-panel")).toHaveAttribute("data-state", "open");
  await expect(page.getByTestId("copy-prompt-sticky")).toBeVisible();
  await expect(page.getByTestId("copy-prompt-mobile-panel")).toContainText(
    "コピーしました。普段使っているAIに貼り付けてください。",
  );

  await page.getByTestId("mobile-prompt-panel").getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByTestId("mobile-prompt-panel")).toHaveAttribute("data-state", "closed");
  await expect
    .poll(() =>
      page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? ""),
    )
    .toBe("copy-prompt-sticky");
});
