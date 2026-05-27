import { expect, test } from "@playwright/test";

test.describe("combo controller harness", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/combo-harness.html");
  });

  test("Enter でピル化し、入力欄を空にする", async ({ page }) => {
    const input = page.locator(".combo-input");

    await input.fill("豆腐");
    await input.press("Enter");

    await expect(page.locator(".pill-label")).toHaveText("豆腐");
    await expect(input).toHaveValue("");
    await expect(page.locator("#values")).toHaveText("豆腐");
  });

  test("blur で確定する", async ({ page }) => {
    const input = page.locator(".combo-input");

    await input.fill("しめじ");
    await page.locator("#outside").click();

    await expect(page.locator(".pill-label")).toHaveText("しめじ");
    await expect(page.locator("#values")).toHaveText("しめじ");
  });

  test("IME中と確定直後のEnterでは確定しない", async ({ page }) => {
    const input = page.locator(".combo-input");
    await input.fill("にんじん");

    await input.evaluate((element) => {
      element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
          isComposing: true,
        }),
      );
    });

    await expect(page.locator(".pill")).toHaveCount(0);

    await input.evaluate((element) => {
      element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
    });

    await expect(page.locator(".pill")).toHaveCount(0);

    await page.waitForTimeout(120);
    await input.evaluate((element) => {
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
    });

    await expect(page.locator(".pill-label")).toHaveText("にんじん");
  });

  test("空入力欄のBackspace/Deleteで2段階削除になる", async ({ page }) => {
    const input = page.locator(".combo-input");

    await input.fill("豆腐");
    await input.press("Enter");
    await input.press("Backspace");
    await expect(page.locator(".pill")).toHaveClass(/pending-delete/);

    await page.waitForTimeout(150);
    await page.keyboard.press("Backspace");
    await expect(page.locator(".pill")).toHaveCount(0);

    await input.fill("しめじ");
    await input.press("Enter");
    await input.press("Delete");
    await expect(page.locator(".pill")).toHaveClass(/pending-delete/);

    await page.waitForTimeout(150);
    await page.keyboard.press("Delete");
    await expect(page.locator(".pill")).toHaveCount(0);
  });

  test("ピル編集のEnter保存、Escape cancel、blur保存が動く", async ({ page }) => {
    const input = page.locator(".combo-input");

    await input.fill("豆腐");
    await input.press("Enter");
    await page.locator(".pill-label").click();
    const editInput = page.locator(".pill-edit-input");
    await editInput.fill("木綿豆腐");
    await editInput.press("Enter");
    await expect(page.locator(".pill-label")).toHaveText("木綿豆腐");

    await page.locator(".pill-label").click();
    await editInput.fill("絹ごし豆腐");
    await editInput.press("Escape");
    await expect(page.locator(".pill-label")).toHaveText("木綿豆腐");

    await page.locator(".pill-label").click();
    await editInput.fill("厚揚げ");
    await page.locator("#outside").click();
    await expect(page.locator(".pill-label")).toHaveText("厚揚げ");
  });
});
