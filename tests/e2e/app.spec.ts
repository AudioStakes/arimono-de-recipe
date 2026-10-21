import { expect, type Locator, type Page, test } from "@playwright/test";
import { pressCommittedEnter } from "./helpers/combo";

function materialCard(page: Page, name: string): Locator {
  return page.getByTestId(/^material-card-/).filter({ hasText: name });
}

function materialUsageOption(card: Locator, usage: "auto" | "required" | "use-up"): Locator {
  return card.getByTestId(new RegExp(`^material-usage-option-.+-${usage}$`));
}

function materialAmountInput(card: Locator): Locator {
  return card.getByTestId(/^material-amount-/);
}

function materialUseUpError(card: Locator): Locator {
  return card.getByTestId(/^material-use-up-error-/);
}

test("ページ基本表示と折りたたみ項目の開閉が新UIどおり", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("ありもの de レシピ");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ありもの de レシピ", level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "ありもの de レシピ", exact: true })).toBeVisible();
  await expect(page.getByText("冷蔵庫にあるもので、今日のごはんを。")).toBeVisible();

  await expect(page.getByRole("heading", { name: /今日のリクエスト/ })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "ありもので、何を作る？", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "AIの回答", level: 2, exact: true }),
  ).toBeVisible();
  const form = page.getByTestId("recipe-form");
  await expect(form.getByRole("button", { name: "この依頼文をAIへ送信", exact: true })).toHaveCount(
    0,
  );
  await expect(
    form.getByRole("button", { name: "AI向けレシピ依頼文をコピー", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "実行方法", exact: true }).getByRole("button"),
  ).toHaveCount(2);
  const basicFields = page.getByTestId("basic-fields");
  await expect(basicFields.locator(".field-title:visible")).toHaveText(["家にある食材・材料"]);
  for (const id of [
    "requestOptions",
    "requestIntent",
    "targetDish",
    "pairingTargets",
    "recipeCount",
    "recipeRoles",
    "cookTime",
    "recipeDirections",
    "ngFoodsAndSeasonings",
  ]) {
    await expect(page.getByTestId(`recipe-item-${id}`)).toHaveCount(0);
  }
  await expect(page.getByTestId("mobile-ai-prompt-send")).toContainText("AIへ送信");

  const requestFields = page.getByTestId("advanced-fields");
  await expect(requestFields.getByTestId(/^recipe-item-panel-/)).toHaveCount(3);
  expect(
    await requestFields
      .getByTestId(/^recipe-item-(servings|cookingTools|supplementalNotes)$/)
      .evaluateAll((fields) => new Set(fields.map((field) => field.parentElement)).size),
  ).toBe(1);
  const visibleToggles = page.locator('[data-testid^="recipe-item-toggle-"]:visible');
  await expect(visibleToggles).toHaveCount(3);
  await expect(visibleToggles.nth(0)).toHaveText(/人数・分量/);
  await expect(visibleToggles.nth(1)).toHaveText(/調理方法・調理器具/);
  await expect(visibleToggles.nth(2)).toHaveText(/その他の要望/);
  await expect(page.getByTestId("recipe-item-cookingTools")).toHaveAttribute(
    "data-state",
    "closed",
  );
  await expect(page.getByTestId("recipe-item-toggle-cookingTools")).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  await page.getByTestId("recipe-item-toggle-cookingTools").click();
  await expect(page.getByTestId("recipe-item-cookingTools")).toHaveAttribute("data-state", "open");
  await expect(page.getByTestId("recipe-item-toggle-cookingTools")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByTestId("recipe-item-panel-cookingTools")).not.toBeHidden();
  await page.getByTestId("recipe-item-toggle-cookingTools").click();
  await expect(page.getByTestId("recipe-item-cookingTools")).toHaveAttribute(
    "data-state",
    "closed",
  );
  await expect(page.getByTestId("recipe-item-panel-cookingTools")).toBeHidden();
});

test("料理名・時間・こだわりはその他の要望に自由に記入できる", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  const notes = "カレーを作りたい。20分以内。\n辛くせず、卵は使わない。";
  await page.getByTestId("supplemental-notes").fill(notes);
  await expect(page.getByTestId("prompt-output")).toHaveValue(new RegExp(notes));
  await expect(page.getByTestId("condition-chips")).toContainText("その他の要望あり");
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(
    /### 作りたい料理|### 調理時間|### レシピの方向性/,
  );
});

test("モバイル初期表示は材料入力とAI送信CTAを優先する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");

  const materialInput = page.getByTestId("combo-input-materials");
  const generate = page.getByTestId("mobile-ai-prompt-send");
  await expect(materialInput).toBeVisible();
  await expect(generate).toContainText("AIへ送信");

  await expect
    .poll(async () => (await materialInput.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(520);
  await expect
    .poll(async () => (await generate.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(700);
  await expect(page.getByTestId("prompt-output")).not.toBeVisible();
  await expect(page.getByTestId("copy-prompt-sticky")).toBeVisible();
});

test("その他の要望を編集・消去すると依頼文とチップも更新される", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  const notes = page.getByTestId("supplemental-notes");
  await notes.fill("カレーを作りたい");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/カレーを作りたい/);
  await notes.fill("餃子に合う副菜を作りたい");
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/カレーを作りたい/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(/餃子に合う副菜を作りたい/);
  await notes.fill("  \n  ");
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/### その他の要望/);
  await expect(page.getByTestId("condition-chips")).not.toContainText("その他の要望あり");
  await expect(page.getByTestId("recipe-item-toggle-supplementalNotes")).toContainText("指定なし");
});

test("3項目を独立して開閉し、入力内容を保持できる", async ({ page }) => {
  await page.goto("/");
  const ids = ["servings", "cookingTools", "supplementalNotes"];
  for (const id of ids) {
    await expect(page.getByTestId(`recipe-item-toggle-${id}`)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await page.getByTestId(`recipe-item-toggle-${id}`).click();
    await expect(page.getByTestId(`recipe-item-panel-${id}`)).toBeVisible();
  }
  await page.getByTestId("supplemental-notes").fill("副菜を作りたい");
  await page.getByTestId("recipe-item-toggle-servings").click();
  await expect(page.getByTestId("recipe-item-panel-servings")).toBeHidden();
  await expect(page.getByTestId("recipe-item-panel-cookingTools")).toBeVisible();
  await expect(page.getByTestId("supplemental-notes")).toHaveValue("副菜を作りたい");
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await expect(page.getByTestId("recipe-item-toggle-supplementalNotes")).toContainText("入力あり");
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await expect(page.getByTestId("supplemental-notes")).toHaveValue("副菜を作りたい");
});

test("材料の使い方は食材・材料の同じリストに紐づく", async ({ page }) => {
  await page.goto("/");

  const materialInput = page.getByTestId("combo-input-materials");
  await materialInput.fill("豆腐");
  await pressCommittedEnter(materialInput);

  await expect(page.getByTestId("material-use-panel")).toBeVisible();
  await expect(page.getByTestId("material-use-panel")).toContainText("豆腐");

  const tofuRow = materialCard(page, "豆腐");
  await expect(materialAmountInput(tofuRow)).toBeVisible();
  await expect(materialUsageOption(tofuRow, "auto")).toBeChecked();
  await materialUsageOption(tofuRow, "required").check();
  await expect(materialAmountInput(tofuRow)).toBeVisible();
  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐（必ず使う・記載量を使う）/);

  await page.getByTestId("combo-pill-label-materials").click();
  const editInput = page.getByTestId("combo-pill-edit-materials");
  await editInput.fill("豆腐150g");
  await pressCommittedEnter(editInput);
  await expect(page.getByTestId("material-use-panel")).toContainText("豆腐150g");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐150g（必ず使う・記載量を使う）/);

  await materialUsageOption(tofuRow, "use-up").check();
  await expect(materialAmountInput(tofuRow)).toBeVisible();
  await expect(materialUseUpError(tofuRow)).toBeVisible();
  await materialAmountInput(tofuRow).fill("120g");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐150g（使い切る量: 120g）/);

  await tofuRow.getByRole("button", { name: "豆腐150gを材料から削除" }).click();
  await expect(page.getByTestId("material-use-panel")).toContainText(
    "家にある食材・材料を追加してください。",
  );
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/豆腐150g/);
});

test("複数材料の使い方と分量は材料名を編集しても元の材料ごとに保持する", async ({ page }) => {
  await page.goto("/");

  const materialInput = page.getByTestId("combo-input-materials");
  await materialInput.fill("豆腐");
  await pressCommittedEnter(materialInput);
  await materialInput.fill("キャベツ");
  await pressCommittedEnter(materialInput);

  const tofuRow = materialCard(page, "豆腐");
  const cabbageRow = materialCard(page, "キャベツ");
  await materialUsageOption(tofuRow, "required").check();
  await materialUsageOption(cabbageRow, "use-up").check();
  await materialAmountInput(cabbageRow).fill("1/4玉");

  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐（必ず使う・記載量を使う）/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(/キャベツ（使い切る量: 1\/4玉）/);

  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "豆腐" }).click();
  const tofuEditInput = page.getByTestId("combo-pill-edit-materials");
  await tofuEditInput.fill("豆腐150g");
  await pressCommittedEnter(tofuEditInput);
  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐150g（必ず使う・記載量を使う）/);

  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "キャベツ" }).click();
  const cabbageEditInput = page.getByTestId("combo-pill-edit-materials");
  await cabbageEditInput.fill("春キャベツ");
  await pressCommittedEnter(cabbageEditInput);
  await expect(page.getByTestId("prompt-output")).toHaveValue(/春キャベツ（使い切る量: 1\/4玉）/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 家にある食材・材料\n\n- 豆腐150g（必ず使う・記載量を使う）\n- 春キャベツ（使い切る量: 1\/4玉）/,
  );
  const editedCabbageRow = materialCard(page, "春キャベツ");
  await expect(materialUsageOption(editedCabbageRow, "use-up")).toBeChecked();
  await expect(materialAmountInput(editedCabbageRow)).toHaveValue("1/4玉");

  const editedTofuRow = materialCard(page, "豆腐150g");
  await materialUsageOption(editedTofuRow, "auto").check();
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/必ず使う・/);
});

test("調理方法・調理器具を複数指定して個別に削除できる", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("recipe-item-toggle-cookingTools").click();
  const input = page.getByTestId("combo-input-cookingTools");
  for (const value of ["電子レンジ", "フライパン"]) {
    await input.fill(value);
    await pressCommittedEnter(input);
  }
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 調理方法・調理器具\n\n- 電子レンジ\n- フライパン/,
  );
  await page.getByTestId("combo-pill-remove-cookingTools").first().click();
  await expect(page.getByTestId("combo-pill-label-cookingTools")).toHaveText("フライパン");
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/- 電子レンジ/);
});

test("人数・分量と器具とその他の要望が依頼文へ反映される", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("recipe-item-toggle-servings").click();
  await page.getByRole("radio", { name: "詳しく指定", exact: true }).check();
  await page.getByTestId("serving-plus-adultCount").click();
  await page.getByTestId("recipe-item-toggle-cookingTools").click();
  await page.getByTestId("combo-input-cookingTools").fill("電子レンジ");
  await pressCommittedEnter(page.getByTestId("combo-input-cookingTools"));
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page.getByTestId("supplemental-notes").fill("子ども用に辛くしない。");
  const output = page.getByTestId("prompt-output");
  await expect(output).toHaveValue(/### 人数・分量\n\n.*大人1人/);
  await expect(output).toHaveValue(/### 調理方法・調理器具\n\n- 電子レンジ/);
  await expect(output).toHaveValue(/### その他の要望\n\n子ども用に辛くしない。/);
});

test("基本項目の DOM 順序がフォーム定義と一致する", async ({ page }) => {
  await page.goto("/");

  const labels = await page
    .getByTestId("basic-fields")
    .locator(".field-title:visible")
    .allTextContents();
  expect(labels.map((text) => text.trim())).toEqual(["家にある食材・材料"]);
});

test("材料0件では送信とコピーを無効にし、追加と削除に追従する", async ({ page }) => {
  await page.goto("/");
  const send = page.getByTestId("mobile-ai-prompt-send");
  const copy = page.getByTestId("copy-prompt-sticky");
  await expect(send).toBeDisabled();
  await expect(copy).toBeDisabled();
  await expect(
    page.getByText("家にある食材・材料を追加してください。", { exact: true }),
  ).toBeVisible();
  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page.getByTestId("supplemental-notes").fill("温かい料理");
  await expect(send).toBeDisabled();
  await expect(copy).toBeDisabled();
  const input = page.getByTestId("combo-input-materials");
  await input.fill("豆腐");
  await expect(send).toBeDisabled();
  await expect(copy).toBeDisabled();
  await pressCommittedEnter(input);
  await expect(send).toBeEnabled();
  await expect(copy).toBeEnabled();
  await page
    .getByTestId(/^material-card-/)
    .getByRole("button", { name: /削除/ })
    .click();
  await expect(send).toBeDisabled();
  await expect(copy).toBeDisabled();
});
