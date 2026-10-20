import { expect, test } from "@playwright/test";

test("依頼文欄は初期表示と自動更新の両方が機能する", async ({ page }) => {
  let apiCalls = 0;
  await page.route("**/api/recipe", async (route) => {
    apiCalls += 1;
    await route.abort();
  });
  await page.goto("/");
  const output = page.getByTestId("prompt-output");
  await expect(
    page.getByRole("heading", { name: "ありもので、何を作る？", exact: true }),
  ).toBeVisible();
  await page.getByTestId("prompt-preview-toggle").click();
  await expect(output).toHaveAccessibleName("コピーするレシピ依頼文");
  await expect(output).toHaveAttribute("readonly");
  await expect(output).toHaveValue(/## 役割/);
  await expect(output).toHaveValue(/## 出力形式/);
  await page.getByTestId("combo-input-materials").fill("豆腐");
  await page.getByTestId("combo-input-materials").press("Enter");
  await expect(output).toHaveValue(/### 家にある食材・材料\n\n- 豆腐/);
  await expect(output).not.toHaveValue(/### 調理時間|### 一緒に出す料理|### 作りたい品数/);
  await page.getByTestId("recipe-item-toggle-cookingTools").click();
  await page.getByTestId("combo-input-cookingTools").fill("電子レンジ");
  await page.getByTestId("combo-input-cookingTools").press("Enter");
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page.getByTestId("supplemental-notes").fill("20分以内に副菜を作りたい。");
  const prompt = await output.inputValue();
  expect(prompt).toContain("### 調理方法・調理器具\n\n- 電子レンジ");
  expect(prompt).toContain("### その他の要望\n\n20分以内に副菜を作りたい。");
  expect(prompt).toContain("### レシピ名");
  expect(prompt).toContain("### 調理のポイント");
  await page.getByTestId("combo-pill-remove-cookingTools").click();
  await expect(output).not.toHaveValue(/### 調理方法・調理器具/);
  await expect(output).toHaveValue(/豆腐/);
  await expect(output).toHaveValue(/20分以内に副菜を作りたい。/);
  expect(apiCalls).toBe(0);
});
