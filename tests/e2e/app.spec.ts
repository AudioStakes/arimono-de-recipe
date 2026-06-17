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
  await expect(basicFields.locator(".field-title:visible")).toHaveText([
    "今回やりたいこと",
    "家にある食材・材料",
    "材料の使い方",
    "人数・分量",
  ]);
  await expect(page.getByTestId("recipe-item-targetDish")).toBeHidden();
  await expect(page.getByTestId("recipe-item-pairingTargets")).toBeHidden();
  await expect(page.getByTestId("recipe-item-recipeCount")).toBeVisible();
  await expect(page.getByTestId("recipe-item-recipeCount")).toHaveAttribute("data-state", "closed");

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
    "今回やりたいこと",
    "作りたい料理",
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
  await page.getByTestId("combo-targetDish").locator(".pill-label").click();
  await page.getByTestId("combo-targetDish").locator(".pill-edit-input").fill("オムライス");
  await page.getByTestId("combo-targetDish").locator(".pill-edit-input").press("Enter");
  await expect(page.getByTestId("combo-targetDish").locator(".pill-label")).toHaveText(
    "オムライス",
  );
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 作りたい料理\n\n- オムライス/);
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/- カレー/);

  await page.getByLabel("一緒に出す料理に合わせたい").check();
  await expect(page.getByTestId("recipe-item-targetDish")).toBeHidden();
  await expect(page.getByTestId("recipe-item-pairingTargets")).toBeVisible();
  await expect(page.getByTestId("basic-fields").locator(".field-title:visible")).toHaveText([
    "今回やりたいこと",
    "一緒に出す料理",
    "家にある食材・材料",
    "材料の使い方",
    "人数・分量",
  ]);
  await expect(page.getByTestId("recipe-item-recipeCount")).toBeVisible();
  await expect(page.getByTestId("recipe-item-recipeRoles")).toBeVisible();
  await expect(page.getByTestId("prompt-output")).toHaveValue(/### 作りたい品数\n\n1品だけ/);
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

  await page.getByLabel("必ず使う・使い切りたい食材・材料がある").check();
  await expect(page.getByTestId("material-use-panel")).toBeVisible();
  await expect(page.getByTestId("material-use-panel")).toContainText("豆腐");

  const tofuRow = page.locator("[data-material-request-id]").filter({ hasText: "豆腐" });
  await expect(tofuRow.getByLabel("家にある食材・材料に書いた量を使う")).toBeHidden();
  await expect(tofuRow.getByLabel("量を別で指定する")).toBeHidden();
  await tofuRow.locator('input[value="required"]').check();
  await expect(tofuRow.getByLabel("家にある食材・材料に書いた量を使う")).toBeVisible();
  await expect(tofuRow.getByLabel("家にある食材・材料に書いた量を使う")).toBeChecked();
  await expect(tofuRow.getByLabel("使う量")).toBeHidden();
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 必ず使う食材・材料\n\n- 豆腐（家にある食材・材料に書いた量を使う）/,
  );

  await page.getByTestId("combo-materials").locator(".pill-label").click();
  const editInput = page.getByTestId("combo-materials").locator(".pill-edit-input");
  await editInput.fill("豆腐150g");
  await editInput.press("Enter");
  await expect(page.getByTestId("material-use-panel")).toContainText("豆腐150g");
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 必ず使う食材・材料\n\n- 豆腐150g（家にある食材・材料に書いた量を使う）/,
  );

  await tofuRow.locator('input[value="use-up"]').check();
  await expect(tofuRow.getByLabel("家にある食材・材料に書いた量を使う")).toBeChecked();
  await expect(tofuRow.getByLabel("使い切りたい量")).toBeHidden();
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 使い切りたい食材・材料\n\n- 豆腐150g（家にある食材・材料に書いた量を使う）/,
  );
  await tofuRow.getByLabel("量を別で指定する").check();
  await expect(tofuRow.getByLabel("使い切りたい量")).toBeVisible();
  await tofuRow.getByLabel("使い切りたい量").fill("120g");
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 使い切りたい食材・材料\n\n- 豆腐150g（使い切りたい量: 120g）/,
  );

  await page.getByTestId("combo-materials").locator(".pill-remove").click();
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

  await page.getByLabel("必ず使う・使い切りたい食材・材料がある").check();
  const tofuRow = page.locator("[data-material-request-id]").filter({ hasText: "豆腐" });
  const cabbageRow = page.locator("[data-material-request-id]").filter({ hasText: "キャベツ" });
  await tofuRow.locator('input[value="required"]').check();
  await cabbageRow.locator('input[value="use-up"]').check();
  await cabbageRow.getByLabel("量を別で指定する").check();
  await cabbageRow.getByLabel("使い切りたい量").fill("1/4玉");

  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 必ず使う食材・材料\n\n- 豆腐（家にある食材・材料に書いた量を使う）/,
  );
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 使い切りたい食材・材料\n\n- キャベツ（使い切りたい量: 1\/4玉）/,
  );

  await page
    .getByTestId("combo-materials")
    .locator(".pill-label")
    .filter({ hasText: "豆腐" })
    .click();
  const tofuEditInput = page.getByTestId("combo-materials").locator(".pill-edit-input");
  await tofuEditInput.fill("豆腐150g");
  await tofuEditInput.press("Enter");
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 必ず使う食材・材料\n\n- 豆腐150g（家にある食材・材料に書いた量を使う）/,
  );

  await page
    .getByTestId("combo-materials")
    .locator(".pill-label")
    .filter({ hasText: "キャベツ" })
    .click();
  const cabbageEditInput = page.getByTestId("combo-materials").locator(".pill-edit-input");
  await cabbageEditInput.fill("もやし");
  await cabbageEditInput.press("Enter");
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/### 使い切りたい食材・材料/);
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/1\/4玉/);
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 家にある食材・材料\n\n- 豆腐150g\n- もやし/,
  );

  await page
    .getByTestId("recipe-item-materialUse")
    .locator('input[name="materialUseMode"][value="auto"]')
    .check();
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
  await expect(page.getByTestId("combo-recipeRoles").locator(".pill-label")).toHaveText(
    "副菜・一品",
  );

  await page.getByLabel("複数品を指定").check();
  await expect(page.getByTestId("combo-input-recipeRoles")).toBeVisible();
  await page.getByTestId("combo-input-recipeRoles").fill("汁物");
  await page.getByTestId("combo-input-recipeRoles").press("Enter");
  await expect(page.getByTestId("combo-recipeRoles").locator(".pill-label")).toHaveText([
    "副菜・一品",
    "汁物",
  ]);
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
    "今回やりたいこと",
    "家にある食材・材料",
    "材料の使い方",
    "人数・分量",
  ]);
});
