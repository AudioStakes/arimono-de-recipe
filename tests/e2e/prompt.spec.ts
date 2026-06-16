import { expect, test } from "@playwright/test";

test("依頼文欄は初期表示と自動更新の両方が機能する", async ({ page }) => {
  await page.goto("/");

  const output = page.getByTestId("prompt-output");
  await expect(page.locator(".prompt-heading h2")).toHaveText("AIへ渡すレシピ依頼文");
  await expect(output).toHaveAttribute("readonly");
  await expect(output).toHaveValue(/## 役割/);
  await expect(output).toHaveValue(/## 出力形式/);

  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await expect(output).toHaveValue(/### 家にある食材\n\n- 豆腐/);
  await expect(output).not.toHaveValue(/### 調理時間/);
  await expect(output).not.toHaveValue(/### 合わせたい料理・一緒に出す料理/);

  await page.getByTestId("recipe-item-toggle-dishTypes").click();
  await expect(page.getByTestId("recipe-item-dishTypes")).toHaveAttribute("data-state", "open");
  await page.getByTestId("combo-input-dishTypes").fill("副菜");
  await page.getByTestId("combo-input-dishTypes").press("Enter");
  await page.getByTestId("recipe-item-toggle-pairingTargets").click();
  await page.getByTestId("combo-input-pairingTargets").fill("餃子");
  await page.getByTestId("combo-input-pairingTargets").press("Enter");
  await page.getByTestId("recipe-item-toggle-cookTime").click();
  await page.getByTestId("cook-time-range").evaluate((input) => {
    const range = input as HTMLInputElement;
    range.value = "4";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const prompt = await output.inputValue();
  expect(prompt).toContain("### 家にある食材\n\n- 豆腐");
  expect(prompt).toContain("### 料理区分・作りたいもの\n\n- 副菜");
  expect(prompt).toContain("### 合わせたい料理・一緒に出す料理\n\n- 餃子");
  expect(prompt).toContain("### 調理時間\n\n15分以内");
  expect(prompt).toContain("### レシピ名");
  expect(prompt).toContain("### 一緒に出す料理との相性");
  expect(prompt).toContain("### 調理のポイント");

  await page.getByTestId("combo-pairingTargets").locator(".pill-remove").click();
  const promptWithoutPairing = await output.inputValue();
  expect(promptWithoutPairing).not.toContain("一緒に出す料理との相性");
  expect(promptWithoutPairing).toContain("### 使う材料");
  expect(promptWithoutPairing).toContain("### 調理のポイント");
});
