import { expect, test } from "@playwright/test";
import { buildPrompt, makeEmptyPromptData } from "../src/prompt";

test("未指定項目をプロンプトに出力しない", () => {
  const prompt = buildPrompt(makeEmptyPromptData());

  expect(prompt).not.toContain("【材料】");
  expect(prompt).not.toContain("【人数・分量】");
  expect(prompt).not.toContain("【調理時間】");
  expect(prompt).not.toContain("【補足】");
  expect(prompt).not.toContain("【必ず使いたい材料】");
  expect(prompt).not.toContain("【優先条件】");
});

test("指定済み項目と条件付き形式を出力する", () => {
  const prompt = buildPrompt(
    makeEmptyPromptData({
      materials: ["豆腐", "しめじ"],
      servings: "大人2人、子供(12歳以下)1人",
      pairingTargets: ["餃子"],
      cookTime: "20分以内",
      supplementalNotes: "子ども用に辛くしない。",
    }),
  );

  expect(prompt).toContain("【材料】\n- 豆腐\n- しめじ");
  expect(prompt).toContain("【人数・分量】\n大人2人、子供(12歳以下)1人");
  expect(prompt).toContain("【一緒に出す料理、合わせたい料理】\n餃子");
  expect(prompt).toContain("【調理時間】\n20分以内");
  expect(prompt).toContain("【補足】\n子ども用に辛くしない。");
  expect(prompt).toContain("2. 一緒に出す料理との相性");
});

test("フォーム入力に応じてプロンプト欄が自動更新される", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-combo="materials"] input').fill("豆腐");
  await page.locator('[data-combo="materials"] input').press("Enter");

  await expect(page.locator("#output")).toHaveValue(/【材料】\n- 豆腐/);
});
