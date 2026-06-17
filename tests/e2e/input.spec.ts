import { expect, type Locator, type Page, test } from "@playwright/test";
import { combos } from "../../src/data";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exactText = (value: string): RegExp => new RegExp(`^${escapeRegExp(value)}$`);
const emptySuggestionText = exactText("候補がありません");

const comboField = (page: Page, comboId: string): Locator => page.getByTestId(`combo-${comboId}`);
const comboInput = (page: Page, comboId: string): Locator =>
  page.getByTestId(`combo-input-${comboId}`);
const comboPicker = (page: Page, comboId: string): Locator =>
  page.getByTestId(`combo-picker-${comboId}`);
const comboSuggestions = (page: Page, comboId: string): Locator =>
  page.getByTestId(`combo-suggestions-${comboId}`);
const comboOptions = (page: Page, comboId: string): Locator =>
  comboSuggestions(page, comboId).getByRole("option").filter({ hasNotText: emptySuggestionText });
const comboOption = (page: Page, comboId: string, value: string): Locator =>
  comboSuggestions(page, comboId).getByRole("option", { name: exactText(value) });
const comboPills = (page: Page, comboId: string): Locator =>
  page.getByTestId(`combo-pill-${comboId}`);
const comboPillLabels = (page: Page, comboId: string): Locator =>
  page.getByTestId(`combo-pill-label-${comboId}`);
const comboPillEditInputs = (page: Page, comboId: string): Locator =>
  page.getByTestId(`combo-pill-edit-${comboId}`);
const comboPillRemoveButtons = (page: Page, comboId: string): Locator =>
  page.getByTestId(`combo-pill-remove-${comboId}`);

test("候補入力UIは独自候補リストで、候補選択とフィルタが動く", async ({ page }) => {
  await page.goto("/");

  for (const combo of combos) {
    await expect(comboField(page, combo.id)).toHaveCount(1);
    await expect(comboPicker(page, combo.id)).toHaveCount(1);
    await expect(comboSuggestions(page, combo.id)).toHaveCount(1);
  }
  await expect(page.locator("input[list]")).toHaveCount(0);
  await expect(page.locator("datalist")).toHaveCount(0);

  const input = comboInput(page, "materials");
  const suggestions = comboSuggestions(page, "materials");

  await input.click();
  await expect(suggestions).toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(input).toHaveAttribute("aria-controls", "materialsSuggestions");

  await input.press("Escape");
  await expect(suggestions).not.toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "false");

  await input.press("ArrowDown");
  await expect(suggestions).toBeVisible();

  await input.fill("豆腐");
  await expect(comboOption(page, "materials", "豆腐")).toBeVisible();
  await input.fill("存在しない材料");
  await expect(page.getByTestId("combo-empty-materials")).toBeVisible();

  await input.fill("");
  await input.press("ArrowDown");
  await expect(comboOptions(page, "materials")).toHaveCount(40);

  await input.fill("卵");
  await comboOption(page, "materials", "卵").click();
  await expect(comboPills(page, "materials")).toContainText("卵");

  await input.fill("");
  await input.press("ArrowDown");
  await expect(comboOption(page, "materials", "卵")).toHaveCount(0);
});

test("候補のフォーカス移動、Enter選択、Escapeでの復帰が動く", async ({ page }) => {
  await page.goto("/");

  const input = comboInput(page, "materials");
  const suggestions = comboSuggestions(page, "materials");

  await input.fill("豆");
  await input.press("ArrowDown");

  const firstOption = comboOptions(page, "materials").first();
  const secondOption = comboOptions(page, "materials").nth(1);

  await expect(firstOption).toBeFocused();
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
  await firstOption.press("ArrowDown");
  await expect(secondOption).toBeFocused();
  await expect(secondOption).toHaveAttribute("aria-selected", "true");
  await secondOption.press("ArrowUp");
  await expect(firstOption).toBeFocused();
  await firstOption.press("ArrowUp");
  await expect(input).toBeFocused();

  const cursorPosition = await input.evaluate((element) => {
    const target = element as HTMLInputElement;
    return { start: target.selectionStart, end: target.selectionEnd, value: target.value };
  });
  expect(cursorPosition).toEqual({ start: 1, end: 1, value: "豆" });
  await expect(comboPills(page, "materials")).toHaveCount(0);

  await input.fill("豆");
  await input.press("ArrowDown");
  const momenOption = comboOptions(page, "materials").first();
  await expect(momenOption).toBeFocused();
  await momenOption.press("Enter");
  await expect(comboPillLabels(page, "materials")).toHaveText("絹ごし豆腐");
  await expect(input).toHaveValue("");
  await expect(suggestions).not.toBeVisible();

  await input.fill("豆");
  await input.press("ArrowDown");
  await expect(momenOption).toBeFocused();
  await momenOption.press("Escape");
  await expect(suggestions).not.toBeVisible();
  await expect(input).toBeFocused();
});

test("読み検索とIME変換中の絞り込みが更新される", async ({ page }) => {
  await page.goto("/");

  const materialInput = comboInput(page, "materials");
  const pairingInput = comboInput(page, "pairingTargets");
  const toolsInput = comboInput(page, "cookingTools");

  await materialInput.fill("たまご");
  await expect(comboOption(page, "materials", "卵")).toBeVisible();

  await page.getByLabel("一緒に出す料理に合わせたい").check();
  await pairingInput.fill("ぎょうざ");
  await expect(comboOption(page, "pairingTargets", "餃子")).toBeVisible();

  await pairingInput.fill("はんばーぐ");
  await expect(comboOption(page, "pairingTargets", "ハンバーグ")).toBeVisible();

  await page.getByTestId("recipe-item-toggle-cookingTools").click();
  await toolsInput.fill("でんしれんじ");
  await toolsInput.evaluate((element) => {
    const target = element as HTMLInputElement;
    target.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "で" }));
    target.value = "でんしれんじ";
    target.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: "でんしれんじ",
        inputType: "insertCompositionText",
      }),
    );
    target.dispatchEvent(
      new CompositionEvent("compositionupdate", { bubbles: true, data: "でんしれんじ" }),
    );
  });

  await expect(comboOption(page, "cookingTools", "電子レンジ")).toBeVisible();
});

test("候補クリック、自由入力Enter、blur でピル化し、重複追加しない", async ({ page }) => {
  await page.goto("/");

  const input = comboInput(page, "materials");

  await input.click();
  await input.fill("豆腐");
  await comboOption(page, "materials", "豆腐").click();
  await expect(comboPills(page, "materials")).toContainText("豆腐");
  await expect(input).toHaveValue("");

  await input.fill("しめじ");
  await input.press("Enter");
  await expect(comboPillLabels(page, "materials")).toHaveText(["豆腐", "しめじ"]);
  await expect(input).toHaveValue("");

  await input.fill("しめじ");
  await input.press("Enter");
  await expect(comboPills(page, "materials")).toHaveCount(2);
  await page.waitForTimeout(50);

  await input.fill("しろ菜");
  await expect(input).toHaveValue("しろ菜");
  await page.locator("header").click();
  await expect(comboPillLabels(page, "materials")).toHaveText(["豆腐", "しめじ", "しろ菜"], {
    timeout: 10000,
  });
  await expect(input).toHaveValue("");
});

test("IME変換中と変換確定直後のEnterではピル追加しない", async ({ page }) => {
  await page.goto("/");

  const input = comboInput(page, "materials");
  await input.fill("にんじん");

  await input.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        isComposing: true,
      }),
    );
  });

  await expect(comboPills(page, "materials")).toHaveCount(0);

  await input.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
  });

  await expect(comboPills(page, "materials")).toHaveCount(0);

  await page.waitForTimeout(120);

  await input.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
  });

  await expect(comboPills(page, "materials")).toHaveCount(1);
  await expect(input).toHaveValue("");
});

test("空入力欄のBackspace/Deleteで直前ピルが選択され、再押下で削除される", async ({ page }) => {
  await page.goto("/");

  const input = comboInput(page, "materials");
  await input.fill("豆腐");
  await input.press("Enter");
  await expect(input).toHaveValue("");

  await input.press("Backspace");
  const pill = comboPills(page, "materials").first();
  await expect(pill).toHaveClass(/pending-delete/);

  await page.waitForTimeout(150);
  await page.keyboard.press("Backspace");
  await expect(comboPills(page, "materials")).toHaveCount(0);
  await expect(input).toBeFocused();

  await input.fill("しめじ");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await input.press("Delete");
  await expect(comboPills(page, "materials")).toHaveCount(1);
  await expect(comboPills(page, "materials").first()).toHaveClass(/pending-delete/);

  await page.waitForTimeout(150);
  await page.keyboard.press("Delete");
  await expect(comboPills(page, "materials")).toHaveCount(0);
  await expect(input).toBeFocused();
});

test("ピルのラベルから編集でき、Enterとblurで保存される", async ({ page }) => {
  await page.goto("/");

  const input = comboInput(page, "materials");
  const output = page.getByTestId("prompt-output");

  await input.fill("ハンバーグ");
  await input.press("Enter");
  await expect(comboPillLabels(page, "materials")).toHaveText("ハンバーグ");

  await comboPillLabels(page, "materials").click();
  const editInput = comboPillEditInputs(page, "materials");
  await expect(editInput).toHaveValue("ハンバーグ");

  await editInput.fill("デミグラスハンバーグ");
  await editInput.press("Enter");
  await expect(comboPillLabels(page, "materials")).toHaveText("デミグラスハンバーグ");
  await expect(output).toHaveValue(/### 家にある食材・材料\n\n- デミグラスハンバーグ/);
  await expect(page.getByTestId("condition-chips")).toContainText(
    "家にある食材・材料: デミグラスハンバーグ",
  );

  await comboPillLabels(page, "materials").click();
  const secondEditInput = comboPillEditInputs(page, "materials");
  await expect(secondEditInput).toBeVisible();
  await secondEditInput.fill("和風ハンバーグ");
  await page.locator("header").click();
  await expect(comboPillLabels(page, "materials")).toHaveText("和風ハンバーグ");
  await expect(output).toHaveValue(/### 家にある食材・材料\n\n- 和風ハンバーグ/);
  await expect(page.getByTestId("condition-chips")).toContainText(
    "家にある食材・材料: 和風ハンバーグ",
  );
});

test("編集中の空欄Enterとblurはキャンセルになる", async ({ page }) => {
  await page.goto("/");

  const input = comboInput(page, "materials");

  await input.fill("ハンバーグ");
  await input.press("Enter");

  await comboPillLabels(page, "materials").click();
  const enterEditInput = comboPillEditInputs(page, "materials");
  await expect(enterEditInput).toBeVisible();
  await enterEditInput.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "";
  });
  await enterEditInput.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
  });
  await expect(comboPillLabels(page, "materials")).toHaveText("ハンバーグ");

  await comboPillLabels(page, "materials").click();
  const blurEditInput = comboPillEditInputs(page, "materials");
  await expect(blurEditInput).toBeVisible();
  await blurEditInput.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "";
  });
  await blurEditInput.blur();
  await expect(comboPillLabels(page, "materials")).toHaveText("ハンバーグ");
});

test("編集中のEscape、重複統合、IME Enter、×削除が動く", async ({ page }) => {
  await page.goto("/");

  const input = comboInput(page, "materials");

  await input.fill("ハンバーグ");
  await input.press("Enter");
  await input.fill("卵");
  await comboOption(page, "materials", "卵").click();

  await comboPillLabels(page, "materials").nth(1).click();
  const editInput = comboPillEditInputs(page, "materials");
  await expect(editInput).toBeVisible();
  await editInput.fill("オムハンバーグ");
  await page.keyboard.press("Escape");
  await expect(comboPillLabels(page, "materials").nth(1)).toHaveText("卵");

  await comboPillLabels(page, "materials").nth(1).click();
  const duplicateEditInput = comboPillEditInputs(page, "materials");
  await expect(duplicateEditInput).toBeVisible();
  await duplicateEditInput.fill("ハンバーグ");
  await duplicateEditInput.blur();
  await expect(comboPills(page, "materials")).toHaveCount(1);
  await expect(comboPillLabels(page, "materials")).toHaveText("ハンバーグ");

  await comboPillLabels(page, "materials").click();
  const imeEditInput = comboPillEditInputs(page, "materials");
  await expect(imeEditInput).toBeVisible();
  await imeEditInput.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        isComposing: true,
      }),
    );
  });
  await expect(comboPillEditInputs(page, "materials")).toHaveValue("ハンバーグ");

  await imeEditInput.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
      }),
    );
  });
  await expect(imeEditInput).toHaveValue("ハンバーグ");

  await page.waitForTimeout(120);
  await imeEditInput.press("Enter");
  await expect(comboPillLabels(page, "materials")).toHaveText("ハンバーグ");

  await comboPillRemoveButtons(page, "materials").click();
  await expect(comboPills(page, "materials")).toHaveCount(0);
  await expect(input).toBeFocused();
});

test("自由入力した値の追加と削除が全項目で依頼文へ反映される", async ({ page }) => {
  await page.goto("/");

  const cases = [
    {
      comboId: "materials",
      toggle: null,
      setup: null,
      value: "自由入力の食材",
      heading: "家にある食材・材料",
    },
    {
      comboId: "targetDish",
      toggle: null,
      setup: async () => {
        await page.getByLabel("作りたい料理がある").check();
      },
      value: "自由入力の作りたい料理",
      heading: "作りたい料理",
    },
    {
      comboId: "recipeRoles",
      toggle: null,
      setup: async () => {
        await page.getByLabel("一緒に出す料理に合わせたい").check();
        await page.getByLabel("複数品を指定").check();
      },
      value: "自由入力の役割",
      heading: "料理の役割・量感",
    },
    {
      comboId: "cookingTools",
      toggle: "cookingTools",
      setup: null,
      value: "自由入力の調理方法",
      heading: "調理方法・調理器具",
    },
    {
      comboId: "pairingTargets",
      toggle: null,
      setup: async () => {
        await page.getByLabel("一緒に出す料理に合わせたい").check();
      },
      value: "自由入力の合わせ料理",
      heading: "一緒に出す料理",
    },
    {
      comboId: "recipeDirections",
      toggle: "recipeDirections",
      setup: null,
      value: "自由入力の方向性",
      heading: "レシピの方向性",
    },
    {
      comboId: "ngFoodsAndSeasonings",
      toggle: "ngFoodsAndSeasonings",
      setup: null,
      value: "自由入力のNG条件",
      heading: "使えない・持っていない食材・調味料",
    },
  ] as const;

  const output = page.getByTestId("prompt-output");

  for (const { comboId, toggle, setup, value, heading } of cases) {
    await setup?.();
    if (toggle) {
      const toggleButton = page.getByTestId(`recipe-item-toggle-${toggle}`);
      if ((await toggleButton.getAttribute("aria-expanded")) !== "true") {
        await toggleButton.click();
      }
    }

    const input = comboInput(page, comboId);
    await input.fill(value);
    await input.press("Enter");

    await expect(comboPillLabels(page, comboId)).toContainText(value);
    const sectionValuePattern = new RegExp(
      `### ${escapeRegExp(heading)}\\n\\n(?:(?!\\n### ).)*- ${escapeRegExp(value)}`,
      "s",
    );
    await expect(output).toHaveValue(sectionValuePattern);

    await comboPillRemoveButtons(page, comboId).click();
    await expect(comboPills(page, comboId)).toHaveCount(0);
    await expect(output).not.toHaveValue(sectionValuePattern);
  }
});
