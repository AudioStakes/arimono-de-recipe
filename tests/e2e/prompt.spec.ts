import { expect, test } from "@playwright/test";

test("依頼文欄は初期表示と自動更新の両方が機能する", async ({ page }) => {
  await page.goto("/");

  const output = page.locator("#output");
  await expect(page.locator(".prompt-heading h2")).toHaveText("AIへ渡すレシピ依頼文");
  await expect(output).toHaveAttribute("readonly");
  await expect(output).toHaveValue(
    /家にある食材を使って、今日の食事に合うレシピを考えてください。/,
  );

  await page.locator('[data-combo="materials"] .combo-input').fill("豆腐");
  await page.locator('[data-combo="materials"] .combo-input').press("Enter");
  await expect(output).toHaveValue(/【材料】\n- 豆腐/);

  await page.locator('[data-collapsible="dishTypes"] .field-toggle').click();
  await page.locator('[data-combo="dishTypes"] .combo-input').fill("副菜");
  await page.locator('[data-combo="dishTypes"] .combo-input').press("Enter");
  await page.locator('[data-collapsible="pairingTargets"] .field-toggle').click();
  await page.locator('[data-combo="pairingTargets"] .combo-input').fill("餃子");
  await page.locator('[data-combo="pairingTargets"] .combo-input').press("Enter");
  await page.locator('[data-collapsible="cookTime"] .field-toggle').click();
  await page.locator("#cookTimeRange").evaluate((input) => {
    const range = input as HTMLInputElement;
    range.value = "4";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const prompt = await output.inputValue();
  expect(prompt).toContain("【材料】\n- 豆腐");
  expect(prompt).toContain("【料理区分・作りたいもの】\n副菜");
  expect(prompt).toContain("【合わせたい料理・一緒に出す料理】\n餃子");
  expect(prompt).toContain("【調理時間】\n15分以内");
  expect(prompt).toContain("1. レシピ名");
  expect(prompt).toContain("2. 一緒に出す料理との相性");
  expect(prompt).toContain("5. 調理のポイント");

  await page.locator('[data-combo="pairingTargets"] .pill-remove').click();
  const promptWithoutPairing = await output.inputValue();
  expect(promptWithoutPairing).not.toContain("一緒に出す料理との相性");
  expect(promptWithoutPairing).toContain("2. 使う材料");
  expect(promptWithoutPairing).toContain("4. 調理のポイント");
});
