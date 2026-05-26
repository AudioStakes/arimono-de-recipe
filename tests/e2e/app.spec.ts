import { expect, test } from "@playwright/test";

test("ページタイトル、説明文、基本項目が表示される", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("ありもの de レシピ プロンプトメーカー");
  await expect(page.getByRole("heading", { name: /ありもの de レシピ/ })).toBeVisible();
  await expect(
    page.getByText("冷蔵庫にある材料と条件から、AI にレシピ提案を依頼する文章を作ります。"),
  ).toBeVisible();

  const labels = await page.locator("#basicFields .field-title").allTextContents();
  expect(labels.map((text) => text.trim())).toEqual([
    "材料",
    "人数・分量",
    "作りたいもの",
    "調理方法・器具",
    "一緒に出す料理、合わせたい料理",
  ]);
});

test("こだわり条件の開閉文言と詳細項目順が正しい", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#advancedTitle")).toHaveText("こだわり条件を追加");
  await page.locator("#advancedDetails summary").click();
  await expect(page.locator("#advancedTitle")).toHaveText("こだわり条件");

  const labels = await page
    .locator("#advancedFields .field-title, #advancedFields label")
    .allTextContents();
  expect(labels.map((text) => text.trim())).toEqual([
    "調理時間",
    "作りやすさ",
    "栄養・健康",
    "味つけ",
    "ジャンル",
    "シーン",
    "NG材料",
    "NG調味料",
    "補足",
  ]);
});
