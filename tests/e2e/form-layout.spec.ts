import { expect, test } from "@playwright/test";
import { openRequestOptions, pressCommittedEnter } from "./helpers/combo";

for (const [width, fontSize] of [
  [320, 16],
  [390, 16],
  [1280, 16],
  [320, 20],
  [360, 32],
] as const) {
  test(`${width}px・文字${fontSize}pxで材料の編集欄と量の例が読める`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.addStyleTag({ content: `html { font-size: ${fontSize}px; }` });
    const add = page.getByTestId("combo-input-materials");
    await add.fill("豆腐");
    await pressCommittedEnter(add);
    const card = page.getByTestId(/^material-card-/);
    const name = card.getByTestId("combo-pill-label-materials");
    const amount = card.getByTestId(/^material-amount-/);
    const hint = card.getByTestId(/^material-example-/);
    await expect(hint).toHaveText("量の例：150g、1/2個");
    await expect(amount).toHaveAccessibleDescription(/量の例：150g、1\/2個/);
    await expect(amount).not.toHaveAttribute("placeholder");
    const nameBox = await name.boundingBox();
    const amountBox = await amount.boundingBox();
    if (!nameBox || !amountBox) throw new Error("Both material fields must be visible");
    expect(Math.abs(nameBox.height - amountBox.height)).toBeLessThanOrEqual(1);
    expect(nameBox.height).toBeGreaterThanOrEqual(46);
    if (amountBox.x > nameBox.x + nameBox.width) {
      expect(Math.abs(nameBox.y - amountBox.y)).toBeLessThanOrEqual(1);
    } else {
      expect(amountBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height);
    }
    expect(await hint.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    expect(await hint.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(
      true,
    );
    await amount.fill("150g");
    await name.click();
    const edit = page.getByTestId("combo-pill-edit-materials");
    const editBox = await edit.boundingBox();
    if (!editBox) throw new Error("Name editor must be visible");
    expect(Math.abs(editBox.height - amountBox.height)).toBeLessThanOrEqual(1);
    await edit.fill("木綿豆腐");
    await pressCommittedEnter(edit);
    await expect(amount).toHaveValue("150g");
    await expect(name).toHaveText("木綿豆腐");
    await expect(hint).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const [width, fontSize] of [
  [320, 16],
  [320, 32],
  [360, 32],
  [1280, 32],
] as const) {
  test(`${width}px・文字${fontSize}pxで人数・モデル・操作文言が欠けない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.addStyleTag({ content: `html { font-size: ${fontSize}px; }` });
    await page.getByTestId("recipe-item-toggle-servings").click();
    await page.getByRole("radio", { name: "詳しく指定", exact: true }).check();
    const stepper = page.getByTestId("serving-stepper-adultCount");
    for (let i = 0; i < 10; i += 1) await stepper.getByRole("button").last().click();
    const count = stepper.getByText("10人", { exact: true });
    expect(
      await count.evaluate(
        (element) =>
          element.getBoundingClientRect().height <=
          Number.parseFloat(getComputedStyle(element).lineHeight) + 1,
      ),
    ).toBe(true);
    const select = page.getByTestId("ai-model-select");
    expect(
      await select.evaluate((element) => {
        const styles = getComputedStyle(element);
        const contentHeight =
          element.clientHeight -
          Number.parseFloat(styles.paddingTop) -
          Number.parseFloat(styles.paddingBottom);
        return contentHeight >= Number.parseFloat(styles.fontSize) * 1.5 - 1;
      }),
    ).toBe(true);
    for (const id of [
      "ai-prompt-send",
      "copy-prompt",
      "mobile-ai-prompt-send",
      "copy-prompt-sticky",
    ]) {
      const button = page.getByTestId(id);
      const label = button.getByText(id.includes("copy") ? "依頼文をコピー" : "AIへ送信", {
        exact: true,
      });
      expect(
        await label.evaluate(
          (element) =>
            element.getBoundingClientRect().height <=
            Number.parseFloat(getComputedStyle(element).lineHeight) + 1,
        ),
      ).toBe(true);
      const bounds = await button.boundingBox();
      if (!bounds) throw new Error("Actions must be visible");
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    }
    const footer = page.getByTestId("site-footer");
    await footer.scrollIntoViewIfNeeded();
    const footerBox = await footer.boundingBox();
    const actionsBox = await page.getByTestId("mobile-action-footer").boundingBox();
    if (!footerBox || !actionsBox) throw new Error("Both footers must be visible");
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(actionsBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const id of ["targetDish", "recipeRoles"] as const) {
  test(`${id}の入力確定後に指定値の編集へキーボードで移れる`, async ({ page }) => {
    await page.goto("/");
    await openRequestOptions(page);
    if (id === "targetDish") {
      await page.getByRole("radio", { name: "作りたい料理がある", exact: true }).check();
    } else {
      await page.getByTestId("recipe-item-toggle-recipeCount").click();
      await page.getByRole("radio", { name: "1品だけ", exact: true }).check();
    }
    const input = page.getByTestId(`combo-input-${id}`);
    await input.fill(id === "targetDish" ? "カレー" : "副菜");
    await pressCommittedEnter(input);
    const value = page.getByTestId(`combo-pill-label-${id}`);
    await expect(value).toBeFocused();
    await value.press("Enter");
    await expect(page.getByTestId(`combo-pill-edit-${id}`)).toBeFocused();
  });
}

test("材料名の編集中でもカードの削除は対象材料だけを取り除く", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("combo-input-materials");
  for (const name of ["豆腐", "キャベツ"]) {
    await input.fill(name);
    await pressCommittedEnter(input);
  }
  const card = page.getByTestId(/^material-card-/).filter({ hasText: "豆腐" });
  await card.getByTestId("combo-pill-label-materials").click();
  await card.getByTestId("combo-pill-edit-materials").fill("木綿豆腐");
  await card.getByRole("button", { name: "豆腐を材料から削除", exact: true }).click();
  await expect(page.getByTestId("combo-pill-label-materials")).toHaveText(["キャベツ"]);
  await expect(input).toBeFocused();
  await expect(page.getByTestId("prompt-output")).not.toHaveValue(/木綿豆腐/);
});

test("名前編集から前カードの削除へ戻っても確定後のfocusを保持する", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const input = page.getByTestId("combo-input-materials");
  for (const name of ["豆腐", "キャベツ"]) {
    await input.fill(name);
    await pressCommittedEnter(input);
  }
  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "豆腐" }).click();
  await page.getByTestId("combo-pill-edit-materials").fill("木綿豆腐");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByTestId("combo-pill-label-materials")).toHaveText(["キャベツ", "木綿豆腐"]);
  const cabbage = page.getByTestId(/^material-card-/).filter({ hasText: "キャベツ" });
  const remove = cabbage.getByRole("button", { name: "キャベツを材料から削除", exact: true });
  await expect(cabbage.locator(":focus")).toHaveCount(1);
  // Safari's native Tab preference can skip buttons; the earlier input must retain focus.
  if (browserName !== "webkit") await expect(remove).toBeFocused();
  // Exercise the delete target in every engine independently of that native preference.
  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "木綿豆腐" }).click();
  await page.getByTestId("combo-pill-edit-materials").fill("絹豆腐");
  await remove.focus();
  await expect(page.getByTestId("combo-pill-label-materials")).toHaveText(["キャベツ", "絹豆腐"]);
  await expect(remove).toBeFocused();
});
