import { expect, test } from "@playwright/test";
import { combos } from "../../src/data";

test("ページ基本表示と詳細条件の開閉が現在仕様どおり", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("ありもの de レシピ プロンプトメーカー");
  await expect(page.locator("img.title-image")).toBeVisible();
  await expect(page.locator("img.title-image")).toHaveAttribute(
    "alt",
    "ありもの de レシピ プロンプトメーカー",
  );
  await expect(
    page.getByText("冷蔵庫にある材料と条件から、AI にレシピ提案を依頼する文章を作ります。"),
  ).toBeVisible();
  await expect(page.getByText("Recipe Prompt Maker")).toHaveCount(0);
  await expect(page.getByText("入力内容は外部送信されません。")).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);

  await expect(page.locator("#basicFields .field")).toHaveCount(5);
  await expect(page.locator("#basicFields .field-title")).toHaveText([
    "材料",
    "人数・分量",
    "作りたいもの",
    "調理方法・器具",
    "一緒に出す料理、合わせたい料理",
  ]);

  await expect(page.locator("details.advanced")).toHaveCount(1);
  await expect(page.locator("#advancedDetails")).not.toHaveAttribute("open");
  await expect(page.locator("#advancedTitle")).toHaveText("こだわり条件を追加");

  await page.locator("#advancedDetails summary").click();
  await expect(page.locator("#advancedTitle")).toHaveText("こだわり条件");
  await expect(page.locator("#advancedFields .field-title, #advancedFields label")).toHaveText([
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

  await page.locator("#advancedDetails summary").click();
  await expect(page.locator("#advancedTitle")).toHaveText("こだわり条件を追加");
});

test("詳細条件の件数表示が入力に応じて変わる", async ({ page }) => {
  await page.goto("/");

  await page.locator("#advancedDetails summary").click();
  await expect(page.locator("#advancedCount")).toHaveText("");

  await page.locator("#cookTimeRange").evaluate((input) => {
    const range = input as HTMLInputElement;
    range.value = "4";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#advancedCount")).toHaveText("(1件指定中)");

  await page.locator('[data-combo="difficulty"] input').fill("時短");
  await page.locator('[data-combo="difficulty"] input').press("Enter");
  await expect(page.locator("#advancedCount")).toHaveText("(2件指定中)");

  await page.locator("#supplementalNotes").fill("子ども用に辛くしない。");
  await expect(page.locator("#advancedCount")).toHaveText("(3件指定中)");
});

test("基本項目の DOM 順序がフォーム定義と一致する", async ({ page }) => {
  await page.goto("/");

  const labels = await page.locator("#basicFields .field-title").allTextContents();
  expect(labels.map((text) => text.trim())).toEqual([
    "材料",
    "人数・分量",
    ...combos
      .filter((combo) => combo.basic && combo.id !== "materials")
      .map((combo) => combo.label),
  ]);
});
