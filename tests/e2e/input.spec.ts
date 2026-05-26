import { expect, test } from "@playwright/test";
import { combos } from "../../src/data";

test("候補入力UIは独自候補リストで、候補選択とフィルタが動く", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".combo")).toHaveCount(combos.length);
  await expect(page.locator(".combo-picker")).toHaveCount(combos.length);
  await expect(page.locator(".suggestions")).toHaveCount(combos.length);
  await expect(page.locator('input[list]')).toHaveCount(0);
  await expect(page.locator("datalist")).toHaveCount(0);

  const materialField = page.locator('[data-combo="materials"]');
  const input = materialField.locator("input");

  await input.click();
  await expect(materialField.locator(".suggestions")).toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "true");

  await input.press("Escape");
  await expect(materialField.locator(".suggestions")).not.toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "false");

  await input.press("ArrowDown");
  await expect(materialField.locator(".suggestions")).toBeVisible();

  await input.fill("豆腐");
  await expect(materialField.getByRole("option", { name: "豆腐" })).toBeVisible();
  await input.fill("存在しない材料");
  await expect(materialField.getByText("候補がありません")).toBeVisible();

  await input.fill("");
  await input.press("ArrowDown");
  await expect(materialField.locator(".suggestion-option")).toHaveCount(40);

  await input.fill("卵");
  await materialField.locator(".suggestion-option").first().click();
  await expect(materialField.locator(".pill")).toContainText("卵");

  await input.fill("");
  await input.press("ArrowDown");
  await expect(materialField.getByRole("option", { name: "卵" })).toHaveCount(0);
});

test("候補クリック、自由入力Enter、blur でピル化し、重複追加しない", async (
  { page },
  testInfo,
) => {
  if (testInfo.project.name === "mobile-chrome") {
    test.skip(true, "mobile-chrome では blur の commit が不安定なため chromium で確認する");
  }

  await page.goto("/");

  const materialField = page.locator('[data-combo="materials"]');
  const input = materialField.locator("input");

  await materialField.locator(".combo-picker").click();
  await input.fill("豆腐");
  await materialField.locator(".suggestion-option").first().click();
  await expect(materialField.locator(".pill")).toContainText("豆腐");
  await expect(input).toHaveValue("");

  await input.fill("しめじ");
  await input.press("Enter");
  await expect(materialField.locator(".pill > span")).toHaveText(["豆腐", "しめじ"]);
  await expect(input).toHaveValue("");

  await input.fill("しめじ");
  await input.press("Enter");
  await expect(materialField.locator(".pill")).toHaveCount(2);

  await input.fill("しろ菜");
  await input.evaluate((element) => {
    const output = document.querySelector<HTMLTextAreaElement>("#output");
    output?.focus();
    element.blur();
  });
  await page.waitForTimeout(180);
  await expect(materialField.locator(".pill > span")).toHaveText([
    "豆腐",
    "しめじ",
    "しろ菜",
  ]);
  await expect(input).toHaveValue("");
});

test("IME変換中と変換確定直後のEnterではピル追加しない", async ({ page }) => {
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

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(1);
  await expect(input).toHaveValue("");
});

test("空入力欄のBackspace/Deleteで直前ピルが選択され、再押下で削除される", async ({
  page,
}) => {
  await page.goto("/");

  const input = page.locator('[data-combo="materials"] input');
  await input.fill("豆腐");
  await input.press("Enter");

  await input.press("Backspace");
  const pill = page.locator('[data-combo="materials"] .pill').first();
  await expect(pill).toHaveClass(/pending-delete/);

  await page.waitForTimeout(150);
  await page.keyboard.press("Backspace");
  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);
  await expect(input).toBeFocused();

  await input.fill("しめじ");
  await input.press("Enter");
  await input.press("Delete");
  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(1);
  await expect(page.locator('[data-combo="materials"] .pill').first()).toHaveClass(/pending-delete/);

  await page.waitForTimeout(150);
  await page.keyboard.press("Delete");
  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);
  await expect(input).toBeFocused();
});
