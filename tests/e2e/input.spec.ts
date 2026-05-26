import { expect, test } from "@playwright/test";

test("独自候補リストを開き、候補クリックでピル化できる", async ({ page }) => {
  await page.goto("/");

  const materialField = page.locator('[data-combo="materials"]');
  await materialField.locator(".combo-picker").click();
  await expect(materialField.locator(".suggestions")).toBeVisible();
  await materialField.getByRole("option", { name: "豆腐" }).click();

  await expect(materialField.locator(".pill")).toContainText("豆腐");
  await expect(materialField.locator("input")).toHaveValue("");
});

test("自由入力してEnterでピル化し、重複追加しない", async ({ page }) => {
  await page.goto("/");

  const input = page.locator('[data-combo="materials"] input');
  await input.fill("しろ菜");
  await input.press("Enter");
  await input.fill("しろ菜");
  await input.press("Enter");

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(1);
  await expect(input).toHaveValue("");
});

test("IME変換中と変換直後のEnterではピル化せず、変換後のEnterでピル化する", async ({
  page,
}) => {
  await page.goto("/");

  const input = page.locator('[data-combo="materials"] input');
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

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);

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

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);

  await page.waitForTimeout(100);

  await input.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
  });

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(1);
  await expect(input).toHaveValue("");
});

test("空入力欄のBackspaceは直前ピルにフォーカスし、再度Backspaceで削除する", async ({ page }) => {
  await page.goto("/");

  const input = page.locator('[data-combo="materials"] input');
  await input.fill("豆腐");
  await input.press("Enter");
  await input.press("Backspace");

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveClass(/pending-delete/);
  await page.keyboard.press("Backspace");
  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);
});

test("人数を+と-ボタンで増減でき、プロンプトにも反映される", async ({ page }) => {
  await page.goto("/");

  const adultStepper = page.locator('[data-serving-id="adultCount"]');
  const adultCount = adultStepper.locator(".serving-count");
  const decrease = adultStepper.getByRole("button", { name: "大人を1人減らす" });
  const increase = adultStepper.getByRole("button", { name: "大人を1人増やす" });

  await expect(adultCount).toHaveText("0人");
  await expect(decrease).toBeDisabled();

  await increase.click();

  await expect(adultCount).toHaveText("1人");
  await expect(decrease).toBeEnabled();
  await expect(page.locator("#output")).toHaveValue(/【人数・分量】\n大人1人/);

  await decrease.click();

  await expect(adultCount).toHaveText("0人");
  await expect(decrease).toBeDisabled();
});
