import { expect, type Page, test } from "@playwright/test";
import { cookTimeOptions } from "../../src/data";
import { pressCommittedEnter } from "./helpers/combo";

async function addMaterial(page: Page, name: string): Promise<void> {
  await page.getByTestId("combo-input-materials").fill(name);
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
}

test("材料名の編集中はBackspaceとDeleteで文字だけを削除する", async ({ page }) => {
  await page.goto("/");
  await addMaterial(page, "豆腐");
  await addMaterial(page, "キャベツ");
  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "豆腐" }).click();
  const edit = page.getByTestId("combo-pill-edit-materials");
  await edit.fill("木綿豆腐");
  await edit.press("End");
  await edit.press("Backspace");
  await expect(edit).toHaveValue("木綿豆");
  await edit.press("ArrowLeft");
  await edit.press("ArrowLeft");
  await edit.press("ArrowLeft");
  await edit.press("Delete");
  await expect(edit).toHaveValue("綿豆");
  await expect(page.getByTestId("combo-pill-materials")).toHaveCount(2);
  await pressCommittedEnter(edit);
  await expect(page.getByTestId("combo-pill-label-materials")).toHaveText(["綿豆", "キャベツ"]);
});

test("材料の使い方を矢印キーで続けて変更できる", async ({ page }) => {
  await page.goto("/");
  await addMaterial(page, "豆腐");
  const card = page.getByTestId(/^material-card-/);
  const auto = card.getByRole("radio", { name: "おまかせ", exact: true });
  const required = card.getByRole("radio", { name: "必ず使う", exact: true });
  const useUp = card.getByRole("radio", { name: "使い切る", exact: true });
  await auto.focus();
  await auto.press("ArrowRight");
  await expect(required).toBeChecked();
  await expect(required).toBeFocused();
  await required.press("ArrowRight");
  await expect(useUp).toBeChecked();
  await expect(useUp).toBeFocused();
  await useUp.press("ArrowLeft");
  await expect(required).toBeChecked();
  await expect(required).toBeFocused();
});

test("矢印キーで移動した候補を候補パネル内に表示する", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("combo-input-materials");
  await input.click();
  const options = page.getByTestId("combo-option-materials");
  const count = await options.count();
  expect(count).toBeGreaterThan(16);
  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press("ArrowDown");
  }
  const selected = options.nth(15);
  await expect(selected).toBeFocused();
  const visibleWithinPanel = await selected.evaluate((element) => {
    const panel = element.parentElement;
    if (!panel) return false;
    const bounds = element.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    return (
      bounds.top >= panelBounds.top - 1 &&
      bounds.bottom <= panelBounds.bottom + 1 &&
      panel.scrollTop > 0
    );
  });
  expect(visibleWithinPanel).toBe(true);
  await selected.press("Enter");
  await expect(page.getByTestId("combo-pill-materials")).toHaveCount(1);
});

test("IME更新の予約描画は変換終了後の候補フォーカスを奪わない", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("combo-input-materials");
  await input.focus();
  await input.evaluate(async (element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    element.dispatchEvent(new CompositionEvent("compositionupdate", { bubbles: true }));
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  await expect(page.getByTestId("combo-option-materials").first()).toBeFocused();
  await expect(page.getByTestId("combo-option-materials").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("本文の選択操作で閉じず、見出しのドラッグでのみシートを開閉する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await addMaterial(page, "豆腐");
  const panel = page.getByTestId("mobile-prompt-panel");
  const summary = page.getByTestId("mobile-ai-transmission-notice");
  await summary.dispatchEvent("pointerdown", { clientY: 100 });
  await summary.dispatchEvent("pointermove", { clientY: 40 });
  await summary.dispatchEvent("pointerup", { clientY: 40 });
  await expect(panel).toHaveAttribute("data-state", "open");

  const output = page.getByTestId("mobile-prompt-output");
  await output.scrollIntoViewIfNeeded();
  const bounds = await output.boundingBox();
  if (!bounds) throw new Error("Prompt output must be visible");
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 80, bounds.y + 80, { steps: 8 });
  await page.mouse.up();
  await expect(panel).toHaveAttribute("data-state", "open");
  await expect(page.getByRole("dialog")).toBeVisible();

  const header = page.getByRole("heading", { name: "AIに渡す依頼文", exact: true });
  await header.dispatchEvent("pointerdown", { clientY: 100 });
  await header.dispatchEvent("pointermove", { clientY: 160 });
  await header.dispatchEvent("pointercancel", { clientY: 160 });
  await header.dispatchEvent("pointerup", { clientY: 160 });
  await expect(panel).toHaveAttribute("data-state", "open");
  await header.dispatchEvent("pointerdown", { clientY: 100 });
  await header.dispatchEvent("pointermove", { clientY: 160 });
  await header.dispatchEvent("pointerup", { clientY: 160 });
  await expect(panel).toHaveAttribute("data-state", "closed");
});

test("モバイル本文の展開中は背景をスクロールせず、閉じた位置を復元する", async ({
  page,
  browserName,
  isMobile,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  await addMaterial(page, "豆腐");
  await page.evaluate(() => window.scrollTo(0, 250));
  const originalScrollY = await page.evaluate(() => window.scrollY);
  expect(originalScrollY).toBeGreaterThan(0);
  const opener = page.getByRole("button", { name: "依頼文を見る", exact: true });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const lockedScrollY = await page.evaluate(() => window.scrollY);
  const supportsWheel = browserName !== "webkit" || !isMobile;
  if (supportsWheel) {
    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, 600);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  } else {
    // Playwright mobile WebKit does not implement mouse.wheel or touch swipes.
    await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
    await expect(page.getByTestId("bottom-sheet-backdrop")).toHaveCSS("touch-action", "none");
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(lockedScrollY);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(originalScrollY);
  if (supportsWheel) {
    await page.mouse.wheel(0, 100);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(originalScrollY);
  } else {
    await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");
  }
  await opener.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.locator("body").evaluate((element) => getComputedStyle(element).position),
  ).not.toBe("fixed");
});

for (const width of [1280, 390]) {
  test(`${width}pxでコピーできないときは本文を展開して選択する`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new DOMException("Denied", "NotAllowedError");
          },
        },
      });
      Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
    });
    await page.goto("/");
    await addMaterial(page, "豆腐");
    const mobile = width < 1024;
    await page.getByTestId(mobile ? "copy-prompt-sticky" : "copy-prompt").click();
    const output = page.getByTestId(mobile ? "mobile-prompt-output" : "prompt-output");
    await expect(output).toBeVisible();
    await expect(output).toBeFocused();
    expect(
      await output.evaluate((element) => {
        const textarea = element as HTMLTextAreaElement;
        return textarea.selectionStart === 0 && textarea.selectionEnd === textarea.value.length;
      }),
    ).toBe(true);
    await expect(
      page.getByTestId(mobile ? "copy-prompt-mobile-panel" : "copy-prompt"),
    ).toContainText("本文を選択してコピーしてください");
  });

  test(`${width}pxでおまかせの分量をコピー本文と全文送信へ保持する`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      let copiedText = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            copiedText = text;
          },
          readText: async () => copiedText,
        },
      });
    });
    const requests: unknown[] = [];
    await page.route("**/api/recipe", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          recipe: "豆腐150gで調理します。",
          model: "test-model",
          usage: null,
        }),
      });
    });
    await page.goto("/");
    await addMaterial(page, "豆腐");
    const card = page.getByTestId(/^material-card-/);
    await card.getByTestId(/^material-amount-/).fill("150g");
    await expect(card.getByRole("radio", { name: "おまかせ", exact: true })).toBeChecked();
    const mobile = width < 1024;
    const prompt = await page.getByTestId("prompt-output").inputValue();
    expect(prompt).toContain("150g");
    await page.getByTestId(mobile ? "copy-prompt-sticky" : "copy-prompt").click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(prompt);
    expect(requests).toHaveLength(0);
    if (mobile) {
      await page.getByRole("button", { name: "依頼文を見る", exact: true }).click();
    } else {
      await page.getByTestId("prompt-preview-toggle").click();
    }
    await page.getByTestId(mobile ? "mobile-ai-prompt-send" : "ai-prompt-send").click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toEqual({ prompt });
  });
}

test("320pxでも長い材料名が画面幅からはみ出さない", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await addMaterial(page, "A".repeat(200));
  await expect(page.getByTestId("combo-pill-materials")).toHaveCount(1);
  const card = page.getByTestId(/^material-card-/);
  const remove = card.getByRole("button", {
    name: `${"A".repeat(200)}を材料から削除`,
    exact: true,
  });
  const cardBounds = await card.boundingBox();
  const removeBounds = await remove.boundingBox();
  if (!cardBounds || !removeBounds) throw new Error("Material and delete control must be visible");
  expect(removeBounds.width).toBeLessThan(cardBounds.width / 2);
  expect(removeBounds.x).toBeGreaterThan(cardBounds.x + cardBounds.width / 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByTestId("combo-pill-label-materials").click();
  await expect(page.getByTestId("combo-pill-edit-materials")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("調理時間の読み上げに現在の候補ラベルを使う", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("recipe-item-toggle-cookTime").click();
  const range = page.getByTestId("cook-time-range");
  await expect(range).toHaveAttribute("aria-valuetext", "指定なし");
  await range.focus();
  await range.press("ArrowRight");
  await expect(range).toHaveAttribute("aria-valuetext", cookTimeOptions[1] ?? "");
  await range.press("End");
  await expect(range).toHaveAttribute("aria-valuetext", cookTimeOptions.at(-1) ?? "");
  await range.press("Home");
  await expect(range).toHaveAttribute("aria-valuetext", "指定なし");
});

test("材料名を置き換えても使い方と分量を保持し、既存名への統合は統合先を残す", async ({ page }) => {
  await page.goto("/");
  await addMaterial(page, "豆腐");
  const card = page.getByTestId(/^material-card-/).filter({ hasText: "豆腐" });
  const requestId = await card.getAttribute("data-testid");
  await card.getByRole("radio", { name: "必ず使う", exact: true }).check();
  await card.getByTestId(/^material-amount-/).fill("150g");
  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "豆腐" }).click();
  await page.getByTestId("combo-pill-edit-materials").fill("木綿豆腐");
  await pressCommittedEnter(page.getByTestId("combo-pill-edit-materials"));
  const renamed = page.getByTestId(requestId ?? "");
  await expect(renamed).toContainText("木綿豆腐");
  await expect(renamed.getByRole("radio", { name: "必ず使う", exact: true })).toBeChecked();
  await expect(renamed.getByTestId(/^material-amount-/)).toHaveValue("150g");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/木綿豆腐.*150g/);
  await addMaterial(page, "厚揚げ");
  const destination = page.getByTestId(/^material-card-/).filter({ hasText: "厚揚げ" });
  const destinationId = await destination.getAttribute("data-testid");
  await destination.getByTestId(/^material-amount-/).fill("200g");
  await page.getByTestId("combo-pill-label-materials").filter({ hasText: "木綿豆腐" }).click();
  await page.getByTestId("combo-pill-edit-materials").fill("厚揚げ");
  await pressCommittedEnter(page.getByTestId("combo-pill-edit-materials"));
  await expect(page.getByTestId(/^material-card-/)).toHaveCount(1);
  await expect(page.getByTestId(destinationId ?? "").getByTestId(/^material-amount-/)).toHaveValue(
    "200g",
  );
  await expect(
    page.getByTestId(destinationId ?? "").getByRole("radio", { name: "おまかせ", exact: true }),
  ).toBeChecked();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`${viewport.width}x${viewport.height}で材料・分量の入力エラーが固定操作に隠れない`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    let requests = 0;
    await page.route("**/api/recipe", async (route) => {
      requests += 1;
      await route.abort();
    });
    await page.goto("/");
    const send = page.getByTestId("mobile-ai-prompt-send");
    const input = page.getByTestId("combo-input-materials");
    const missingMaterials = page.getByTestId("materials-error");
    const footer = page.getByTestId("mobile-action-footer");
    await send.click();
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(/家にある食材を入れてください。/);
    await expect(missingMaterials).toBeVisible();
    expect((await missingMaterials.boundingBox())?.y).toBeGreaterThanOrEqual(0);
    const assertRevealed = async (
      field: ReturnType<Page["getByTestId"]>,
      feedback: ReturnType<Page["getByTestId"]>,
    ) => {
      const fieldBounds = await field.boundingBox();
      const feedbackBounds = await feedback.boundingBox();
      const footerBounds = await footer.boundingBox();
      if (!fieldBounds || !feedbackBounds || !footerBounds)
        throw new Error("Input, feedback and footer must be visible");
      expect(fieldBounds.y).toBeGreaterThanOrEqual(0);
      expect(feedbackBounds.y + feedbackBounds.height).toBeLessThanOrEqual(footerBounds.y);
    };
    await assertRevealed(input, missingMaterials);
    expect(requests).toBe(0);
    await input.fill("キャベツ");
    await pressCommittedEnter(input);
    await expect(missingMaterials).toBeHidden();
    await expect(input).not.toHaveAttribute("aria-invalid", "true");
    const card = page.getByTestId(/^material-card-/);
    await card.getByRole("radio", { name: "使い切る", exact: true }).check();
    await send.click();
    const amount = card.getByTestId(/^material-amount-/);
    const amountError = card.getByTestId(/^material-use-up-error-/);
    await expect(amount).toBeFocused();
    await expect(amountError).toBeVisible();
    await assertRevealed(amount, amountError);
    expect(requests).toBe(0);
  });
}
