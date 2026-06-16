import { expect, test } from "@playwright/test";

test("ページ基本表示と折りたたみ項目の開閉が新UIどおり", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("ありもの de レシピ");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.locator(".brand-fridge")).toBeVisible();
  await expect(page.locator(".brand-title-text")).toHaveText("ありもの de レシピ");
  await expect(
    page.getByText("「ありもので何作ろう？」を、AIへそのまま渡せるレシピ依頼文に。"),
  ).toBeVisible();
  await expect(page.locator(".use-flow")).toContainText("1. 条件を入力");
  await expect(page.locator(".use-flow")).toContainText("3. コピーしてAIへ渡す");

  const basicFields = page.getByTestId("basic-fields");
  await expect(basicFields.locator(".field, .fieldset")).toHaveCount(2);
  await expect(basicFields.locator(".field-title")).toHaveText(["家にある食材", "食べる人数"]);

  const toggles = page.locator('[data-testid^="recipe-item-toggle-"]');
  await expect(toggles).toHaveCount(8);
  await expect(toggles.nth(0)).toHaveText(/料理区分・作りたいもの/);
  await expect(toggles.nth(1)).toHaveText(/使いたい調理器具・調理方法/);
  await expect(toggles.nth(7)).toHaveText(/その他の要望/);
  await expect(page.getByTestId("recipe-item-dishTypes")).toHaveAttribute("data-state", "closed");
  await expect(toggles.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(toggles.nth(0).locator(".field-toggle-chevron")).toHaveText("⌄");

  await toggles.nth(0).click();
  await expect(page.getByTestId("recipe-item-dishTypes")).toHaveAttribute("data-state", "open");
  await expect(toggles.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(toggles.nth(0).locator(".field-toggle-chevron")).toHaveText("⌃");
  await expect(page.getByTestId("recipe-item-panel-dishTypes")).not.toBeHidden();
  await toggles.nth(0).click();
  await expect(page.getByTestId("recipe-item-dishTypes")).toHaveAttribute("data-state", "closed");
  await expect(toggles.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(toggles.nth(0).locator(".field-toggle-chevron")).toHaveText("⌄");
  await expect(page.getByTestId("recipe-item-panel-dishTypes")).toBeHidden();
});

test("折りたたみ項目は開いた中で入力できる", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("recipe-item-toggle-cookTime").click();
  await page.getByTestId("cook-time-range").evaluate((input) => {
    const range = input as HTMLInputElement;
    range.value = "4";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByTestId("recipe-item-toggle-difficulty").click();
  await page.getByTestId("combo-input-difficulty").fill("時短");
  await page.getByTestId("combo-input-difficulty").press("Enter");

  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page.getByTestId("supplemental-notes").fill("子ども用に辛くしない。");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 調理時間\n\n15分以内/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 作りやすさ・手軽さ\n\n- 時短/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### その他の要望\n\n子ども用に辛くしない。/,
  );
});

test("基本項目の DOM 順序がフォーム定義と一致する", async ({ page }) => {
  await page.goto("/");

  const labels = await page.getByTestId("basic-fields").locator(".field-title").allTextContents();
  expect(labels.map((text) => text.trim())).toEqual(["家にある食材", "食べる人数"]);
});
