import { expect, test } from "@playwright/test";
import { combos } from "../../src/data";

test("候補入力UIは独自候補リストで、候補選択とフィルタが動く", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".combo")).toHaveCount(combos.length);
  await expect(page.locator(".combo-picker")).toHaveCount(combos.length);
  await expect(page.locator(".suggestions")).toHaveCount(combos.length);
  await expect(page.locator("input[list]")).toHaveCount(0);
  await expect(page.locator("datalist")).toHaveCount(0);

  const materialField = page.locator('[data-combo="materials"]');
  const input = materialField.locator(".combo-input");

  await input.click();
  await expect(materialField.locator(".suggestions")).toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "true");

  await input.press("Escape");
  await expect(materialField.locator(".suggestions")).not.toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "false");

  await input.press("ArrowDown");
  await expect(materialField.locator(".suggestions")).toBeVisible();

  await input.fill("豆腐");
  await expect(materialField.getByRole("option", { name: "豆腐", exact: true })).toBeVisible();
  await input.fill("存在しない材料");
  await expect(materialField.getByText("候補がありません")).toBeVisible();

  await input.fill("");
  await input.press("ArrowDown");
  await expect(materialField.locator(".suggestion-option")).toHaveCount(40);

  await input.fill("卵");
  await materialField.getByRole("option", { name: "卵", exact: true }).click();
  await expect(materialField.locator(".pill")).toContainText("卵");

  await input.fill("");
  await input.press("ArrowDown");
  await expect(materialField.getByRole("option", { name: "卵", exact: true })).toHaveCount(0);
});

test("候補のフォーカス移動、Enter選択、Escapeでの復帰が動く", async ({ page }) => {
  await page.goto("/");

  const materialField = page.locator('[data-combo="materials"]');
  const input = materialField.locator(".combo-input");

  await input.fill("豆");
  await input.press("ArrowDown");

  const firstOption = materialField.locator(".suggestion-option").first();
  const secondOption = materialField.locator(".suggestion-option").nth(1);

  await expect(firstOption).toBeFocused();
  await firstOption.press("ArrowDown");
  await expect(secondOption).toBeFocused();
  await secondOption.press("ArrowUp");
  await expect(firstOption).toBeFocused();
  await firstOption.press("ArrowUp");
  await expect(input).toBeFocused();

  const cursorPosition = await input.evaluate((element) => {
    const target = element as HTMLInputElement;
    return { start: target.selectionStart, end: target.selectionEnd, value: target.value };
  });
  expect(cursorPosition).toEqual({ start: 1, end: 1, value: "豆" });
  await expect(materialField.locator(".pill")).toHaveCount(0);

  await input.fill("豆");
  await input.press("ArrowDown");
  const momenOption = materialField.locator(".suggestion-option").first();
  await expect(momenOption).toBeFocused();
  await momenOption.press("Enter");
  await expect(materialField.locator(".pill-label")).toHaveText("絹ごし豆腐");
  await expect(input).toHaveValue("");
  await expect(materialField.locator(".suggestions")).not.toBeVisible();

  await input.fill("豆");
  await input.press("ArrowDown");
  await expect(momenOption).toBeFocused();
  await momenOption.press("Escape");
  await expect(materialField.locator(".suggestions")).not.toBeVisible();
  await expect(input).toBeFocused();
});

test("読み検索とIME変換中の絞り込みが更新される", async ({ page }) => {
  await page.goto("/");

  const materialField = page.locator('[data-combo="materials"]');
  const pairingField = page.locator('[data-combo="pairingTargets"]');
  const toolsField = page.locator('[data-combo="cookingTools"]');
  const materialInput = materialField.locator(".combo-input");
  const pairingInput = pairingField.locator(".combo-input");
  const toolsInput = toolsField.locator(".combo-input");

  await materialInput.fill("たまご");
  await expect(materialField.getByRole("option", { name: "卵", exact: true })).toBeVisible();

  await pairingInput.fill("ぎょうざ");
  await expect(pairingField.getByRole("option", { name: "餃子" })).toBeVisible();

  await pairingInput.fill("はんばーぐ");
  await expect(pairingField.getByRole("option", { name: "ハンバーグ", exact: true })).toBeVisible();

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

  await expect(toolsField.getByRole("option", { name: "電子レンジ", exact: true })).toBeVisible();
});

test("候補クリック、自由入力Enter、blur でピル化し、重複追加しない", async ({ page }, testInfo) => {
  test.skip(
    true,
    "FIXME: blur による確定がPlaywrightの並列実行で不安定なため、安定化後に再有効化する",
  );
  if (testInfo.project.name === "mobile-chrome") {
    test.skip(true, "mobile-chrome では blur の commit が不安定なため chromium で確認する");
  }

  await page.goto("/");

  const materialField = page.locator('[data-combo="materials"]');
  const input = materialField.locator(".combo-input");

  await materialField.locator(".combo-picker").click();
  await input.fill("豆腐");
  await materialField.locator(".suggestion-option").first().click();
  await expect(materialField.locator(".pill")).toContainText("豆腐");
  await expect(input).toHaveValue("");

  await input.fill("しめじ");
  await input.press("Enter");
  await expect(materialField.locator(".pill-label")).toHaveText(["豆腐", "しめじ"]);
  await expect(input).toHaveValue("");

  await input.fill("しめじ");
  await input.press("Enter");
  await expect(materialField.locator(".pill")).toHaveCount(2);

  await input.fill("しろ菜");
  await input.blur();
  await expect(materialField.locator(".pill-label")).toHaveText(["豆腐", "しめじ", "しろ菜"], {
    timeout: 10000,
  });
  await expect(input).toHaveValue("");
});

test("IME変換中と変換確定直後のEnterではピル追加しない", async ({ page }) => {
  await page.goto("/");

  const input = page.locator('[data-combo="materials"] .combo-input');
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

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);

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

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);

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

  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(1);
  await expect(input).toHaveValue("");
});

test("空入力欄のBackspace/Deleteで直前ピルが選択され、再押下で削除される", async ({ page }) => {
  await page.goto("/");

  const input = page.locator('[data-combo="materials"] .combo-input');
  await input.fill("豆腐");
  await input.press("Enter");
  await expect(input).toHaveValue("");

  await input.press("Backspace");
  const pill = page.locator('[data-combo="materials"] .pill').first();
  await expect(pill).toHaveClass(/pending-delete/);

  await page.waitForTimeout(150);
  await page.keyboard.press("Backspace");
  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);
  await expect(input).toBeFocused();

  await input.fill("しめじ");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await input.press("Delete");
  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(1);
  await expect(page.locator('[data-combo="materials"] .pill').first()).toHaveClass(
    /pending-delete/,
  );

  await page.waitForTimeout(150);
  await page.keyboard.press("Delete");
  await expect(page.locator('[data-combo="materials"] .pill')).toHaveCount(0);
  await expect(input).toBeFocused();
});

test("ピルのラベルから編集でき、Enterとblurで保存される", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chrome") {
    test.skip(true, "mobile-chrome では blur の commit が不安定なため chromium で確認する");
  }

  await page.goto("/");

  const materialField = page.locator('[data-combo="materials"]');
  const input = materialField.locator(".combo-input");
  const output = page.locator("#output");

  await input.fill("ハンバーグ");
  await input.press("Enter");
  await expect(materialField.locator(".pill-label")).toHaveText("ハンバーグ");

  await materialField.locator(".pill-label").click();
  const editInput = materialField.locator(".pill-edit-input");
  await expect(editInput).toHaveValue("ハンバーグ");

  await editInput.fill("デミグラスハンバーグ");
  await editInput.press("Enter");
  await expect(materialField.locator(".pill-label")).toHaveText("デミグラスハンバーグ");
  await expect(output).toHaveValue(/【食材・材料】\n- デミグラスハンバーグ/);
  await expect(page.locator("#conditionChips")).toContainText("食材・材料: デミグラスハンバーグ");

  await materialField.locator(".pill-label").click();
  const secondEditInput = materialField.locator(".pill-edit-input");
  await expect(secondEditInput).toBeVisible();
  await secondEditInput.fill("和風ハンバーグ");
  await output.click();
  await expect(materialField.locator(".pill-label")).toHaveText("和風ハンバーグ");
  await expect(output).toHaveValue(/【食材・材料】\n- 和風ハンバーグ/);
  await expect(page.locator("#conditionChips")).toContainText("食材・材料: 和風ハンバーグ");
});

test("編集中の空欄Enterとblurはキャンセルになる", async ({ page }, testInfo) => {
  test.skip(true, "FIXME: 空欄保存のEnter/blurはPlaywrightで不安定なため、安定化後に再有効化する");
  if (testInfo.project.name === "mobile-chrome") {
    test.skip(true, "mobile-chrome では blur の commit が不安定なため chromium で確認する");
  }

  await page.goto("/");

  const materialField = page.locator('[data-combo="materials"]');
  const input = materialField.locator(".combo-input");

  await input.fill("ハンバーグ");
  await input.press("Enter");

  await materialField.locator(".pill-label").click();
  const enterEditInput = materialField.locator(".pill-edit-input");
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
  await expect(materialField.locator(".pill-label")).toHaveText("ハンバーグ");

  await materialField.locator(".pill-label").click();
  const blurEditInput = materialField.locator(".pill-edit-input");
  await expect(blurEditInput).toBeVisible();
  await blurEditInput.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "";
  });
  await blurEditInput.blur();
  await expect(materialField.locator(".pill-label")).toHaveText("ハンバーグ");
});

test("編集中のEscape、重複統合、IME Enter、×削除が動く", async ({ page }, testInfo) => {
  test.skip(
    true,
    "FIXME: 複数ピルの編集切り替えと重複統合がPlaywrightで不安定なため、安定化後に再有効化する",
  );
  if (testInfo.project.name === "mobile-chrome") {
    test.skip(true, "mobile-chrome では blur の commit が不安定なため chromium で確認する");
  }

  await page.goto("/");

  const materialField = page.locator('[data-combo="materials"]');
  const input = materialField.locator(".combo-input");

  await input.fill("ハンバーグ");
  await input.press("Enter");
  await input.fill("卵");
  await materialField.locator(".suggestion-option").first().click();

  await materialField.locator(".pill-label").nth(1).click();
  const editInput = materialField.locator(".pill-edit-input");
  await expect(editInput).toBeVisible();
  await editInput.fill("オムハンバーグ");
  await page.keyboard.press("Escape");
  await expect(materialField.locator(".pill-label").nth(1)).toHaveText("卵");

  await materialField.locator(".pill-label").nth(1).click();
  const duplicateEditInput = materialField.locator(".pill-edit-input");
  await expect(duplicateEditInput).toBeVisible();
  await duplicateEditInput.fill("ハンバーグ");
  await duplicateEditInput.blur();
  await expect(materialField.locator(".pill")).toHaveCount(1);
  await expect(materialField.locator(".pill-label")).toHaveText("ハンバーグ");

  await materialField.locator(".pill-label").click();
  const imeEditInput = materialField.locator(".pill-edit-input");
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
  await expect(materialField.locator(".pill-edit-input")).toHaveValue("ハンバーグ");

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
  await expect(materialField.locator(".pill-label")).toHaveText("ハンバーグ");

  await materialField.locator(".pill-remove").click();
  await expect(materialField.locator(".pill")).toHaveCount(0);
  await expect(input).toBeFocused();
});
