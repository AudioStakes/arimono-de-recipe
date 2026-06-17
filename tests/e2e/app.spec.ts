import { expect, type Locator, type Page, test } from "@playwright/test";

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
  await expect(page.locator(".brand-fridge")).toBeVisible();
  await expect(page.locator(".brand-title-text")).toHaveText("ありもの de レシピ");
  await expect(
    page.getByText("冷蔵庫にある食材を入れて、今日作る料理候補をすぐ見つけます。"),
  ).toBeVisible();

  const basicFields = page.getByTestId("basic-fields");
  await expect(basicFields.locator(".field-title:visible")).toHaveText([
    "家にある食材・材料",
    "材料の使い方",
    "人数・分量",
  ]);
  await expect(page.getByTestId("recipe-item-targetDish")).toBeHidden();
  await expect(page.getByTestId("recipe-item-pairingTargets")).toBeHidden();
  await expect(page.getByTestId("recipe-item-recipeCount")).toBeVisible();
  await expect(page.getByTestId("recipe-item-recipeCount")).toHaveAttribute("data-state", "closed");
  await expect(page.getByTestId("generate-recipe")).toContainText("今日の候補を見る");

  const visibleToggles = page.locator('[data-testid^="recipe-item-toggle-"]:visible');
  await expect(visibleToggles).toHaveCount(6);
  await expect(visibleToggles.nth(0)).toHaveText(/作りたい品数/);
  await expect(visibleToggles.nth(1)).toHaveText(/調理方法・調理器具/);
  await expect(visibleToggles.nth(5)).toHaveText(/その他の要望/);
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

test("intent 切り替えで主要フィールドが切り替わる", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("作りたい料理がある").check();
  await expect(page.getByTestId("recipe-item-targetDish")).toBeVisible();
  await expect(page.getByTestId("basic-fields").locator(".field-title:visible")).toHaveText([
    "家にある食材・材料",
    "材料の使い方",
    "人数・分量",
  ]);
  await expect(page.getByTestId("recipe-item-recipeCount")).toBeHidden();
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 今回やりたいこと\n\n作りたい料理がある/,
  );

  await page.getByTestId("combo-input-targetDish").fill("カレー");
  await page.getByTestId("combo-input-targetDish").press("Enter");
  await expect(page.getByTestId("combo-input-targetDish")).toBeHidden();
  await page.getByTestId("combo-pill-label-targetDish").click();
  await page.getByTestId("combo-pill-edit-targetDish").fill("オムライス");
  await page.getByTestId("combo-pill-edit-targetDish").press("Enter");
  await expect(page.getByTestId("combo-pill-label-targetDish")).toHaveText("オムライス");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 作りたい料理\n\n- オムライス/);
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/- カレー/);

  await page.getByLabel("一緒に出す料理に合わせたい").check();
  await expect(page.getByTestId("recipe-item-targetDish")).toBeHidden();
  await expect(page.getByTestId("recipe-item-pairingTargets")).toBeVisible();
  await expect(page.getByTestId("basic-fields").locator(".field-title:visible")).toHaveText([
    "家にある食材・材料",
    "材料の使い方",
    "人数・分量",
  ]);
  await expect(page.getByTestId("recipe-item-recipeCount")).toBeVisible();
  await expect(page.getByTestId("recipe-item-recipeRoles")).toBeVisible();
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 作りたい品数\n\n1品だけ/);
});

test("モバイル初期表示は材料入力と今日の候補CTAを優先する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");

  const materialInput = page.getByTestId("combo-input-materials");
  const generate = page.getByTestId("generate-recipe-mobile");
  await expect(materialInput).toBeVisible();
  await expect(generate).toContainText("今日の候補を見る");

  await expect
    .poll(async () => (await materialInput.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(520);
  await expect
    .poll(async () => (await generate.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(700);
  await expect(page.getByTestId("prompt-output")).not.toBeVisible();
  await expect(page.getByTestId("copy-prompt")).toBeVisible();
});

test("intent 往復で対象外の値が依頼文とチップに残らない", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("一緒に出す料理に合わせたい").check();
  await page.getByTestId("combo-input-pairingTargets").fill("餃子");
  await page.getByTestId("combo-input-pairingTargets").press("Enter");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 一緒に出す料理/);

  await page.getByLabel("作りたい料理がある").check();
  await page.getByTestId("combo-input-targetDish").fill("カレー");
  await page.getByTestId("combo-input-targetDish").press("Enter");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 作りたい料理\n\n- カレー/);
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/### 一緒に出す料理/);
  await expect(page.getByTestId("condition-chips")).not.toContainText("餃子");

  await page.getByLabel("ありものでおまかせ").check();
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/### 作りたい料理/);
  await expect(page.getByTestId("condition-chips")).not.toContainText("カレー");
});

test("おまかせでもこだわり条件から品数と役割を指定できる", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("recipe-item-toggle-recipeCount").click();
  await page.getByLabel("複数品を指定").check();
  await expect(page.getByTestId("recipe-item-recipeRoles")).toBeVisible();

  await page.getByTestId("combo-input-recipeRoles").fill("副菜・一品");
  await page.getByTestId("combo-input-recipeRoles").press("Enter");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 作りたい品数\n\n複数品を指定/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 料理の役割・量感\n\n- 副菜・一品/,
  );
});

test("材料の使い方は食材・材料の同じリストに紐づく", async ({ page }) => {
  await page.goto("/");

  const materialInput = page.getByTestId("combo-input-materials");
  await materialInput.fill("豆腐");
  await materialInput.press("Enter");

  await expect(page.getByTestId("material-use-panel")).toBeVisible();
  await expect(page.getByTestId("material-use-panel")).toContainText("豆腐");

  const tofuRow = materialCard(page, "豆腐");
  await expect(materialAmountInput(tofuRow)).toBeVisible();
  await expect(materialUsageOption(tofuRow, "auto")).toBeChecked();
  await materialUsageOption(tofuRow, "required").check();
  await expect(materialAmountInput(tofuRow)).toBeVisible();
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 必ず使う食材・材料\n\n- 豆腐（家にある食材・材料に書いた量を使う）/,
  );

  await page.getByTestId("combo-pill-label-materials").click();
  const editInput = page.getByTestId("combo-pill-edit-materials");
  await editInput.fill("豆腐150g");
  await editInput.press("Enter");
  await expect(page.getByTestId("material-use-panel")).toContainText("豆腐150g");
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 必ず使う食材・材料\n\n- 豆腐150g（家にある食材・材料に書いた量を使う）/,
  );

  await materialUsageOption(tofuRow, "use-up").check();
  await expect(materialAmountInput(tofuRow)).toBeVisible();
  await expect(materialUseUpError(tofuRow)).toBeVisible();
  await materialAmountInput(tofuRow).fill("120g");
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 使い切りたい食材・材料\n\n- 豆腐150g（使い切りたい量: 120g）/,
  );

  await tofuRow.getByRole("button", { name: "豆腐150gを材料から削除" }).click();
  await expect(page.getByTestId("material-use-panel")).toContainText(
    "先に「家にある食材・材料」を追加すると",
  );
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/豆腐150g/);
});

test("複数材料の使い方は編集後も別材料へ移らない", async ({ page }) => {
  await page.goto("/");

  const materialInput = page.getByTestId("combo-input-materials");
  await materialInput.fill("豆腐");
  await materialInput.press("Enter");
  await materialInput.fill("キャベツ");
  await materialInput.press("Enter");

  const tofuRow = materialCard(page, "豆腐");
  const cabbageRow = materialCard(page, "キャベツ");
  await materialUsageOption(tofuRow, "required").check();
  await materialUsageOption(cabbageRow, "use-up").check();
  await materialAmountInput(cabbageRow).fill("1/4玉");

  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 必ず使う食材・材料\n\n- 豆腐（家にある食材・材料に書いた量を使う）/,
  );
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 使い切りたい食材・材料\n\n- キャベツ（使い切りたい量: 1\/4玉）/,
  );

  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "豆腐" }).click();
  const tofuEditInput = page.getByTestId("combo-pill-edit-materials");
  await tofuEditInput.fill("豆腐150g");
  await tofuEditInput.press("Enter");
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 必ず使う食材・材料\n\n- 豆腐150g（家にある食材・材料に書いた量を使う）/,
  );

  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "キャベツ" }).click();
  const cabbageEditInput = page.getByTestId("combo-pill-edit-materials");
  await cabbageEditInput.fill("もやし");
  await cabbageEditInput.press("Enter");
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/### 使い切りたい食材・材料/);
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/1\/4玉/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 家にある食材・材料\n\n- 豆腐150g\n- もやし/,
  );

  const editedTofuRow = materialCard(page, "豆腐150g");
  await materialUsageOption(editedTofuRow, "auto").check();
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/### 必ず使う食材・材料/);
});

test("一緒に出す料理と複数品指定はブラウザ上で反映される", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("一緒に出す料理に合わせたい").check();
  await page.getByTestId("combo-input-pairingTargets").fill("餃子");
  await page.getByTestId("combo-input-pairingTargets").press("Enter");
  await page.getByTestId("combo-input-pairingTargets").fill("焼き魚");
  await page.getByTestId("combo-input-pairingTargets").press("Enter");
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 一緒に出す料理\n\n- 餃子\n- 焼き魚/,
  );

  await page.getByTestId("combo-input-recipeRoles").fill("副菜・一品");
  await page.getByTestId("combo-input-recipeRoles").press("Enter");
  await expect(page.getByTestId("combo-input-recipeRoles")).toBeHidden();
  await expect(page.getByTestId("combo-pill-label-recipeRoles")).toHaveText("副菜・一品");

  await page.getByLabel("複数品を指定").check();
  await expect(page.getByTestId("combo-input-recipeRoles")).toBeVisible();
  await page.getByTestId("combo-input-recipeRoles").fill("汁物");
  await page.getByTestId("combo-input-recipeRoles").press("Enter");
  await expect(page.getByTestId("combo-pill-label-recipeRoles")).toHaveText(["副菜・一品", "汁物"]);
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 作りたい品数\n\n複数品を指定/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /指定された料理の役割・量感ごとに、1品ずつ作り方を書いてください。/,
  );
});

test("折りたたみ項目は開いた中で入力できる", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("recipe-item-toggle-cookTime").click();
  await page.getByTestId("cook-time-range").evaluate((input) => {
    const range = input as HTMLInputElement;
    range.value = "2";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    range.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByTestId("recipe-item-toggle-recipeDirections").click();
  await page.getByTestId("combo-input-recipeDirections").fill("あっさり");
  await page.getByTestId("combo-input-recipeDirections").press("Enter");

  await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
  await page.getByTestId("supplemental-notes").fill("子ども用に辛くしない。");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 調理時間\n\n20分以内/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### レシピの方向性\n\n- あっさり/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### その他の要望\n\n子ども用に辛くしない。/,
  );
});

test("基本項目の DOM 順序がフォーム定義と一致する", async ({ page }) => {
  await page.goto("/");

  const labels = await page
    .getByTestId("basic-fields")
    .locator(".field-title:visible")
    .allTextContents();
  expect(labels.map((text) => text.trim())).toEqual([
    "家にある食材・材料",
    "材料の使い方",
    "人数・分量",
  ]);
});
