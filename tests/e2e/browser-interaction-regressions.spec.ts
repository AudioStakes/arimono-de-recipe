import { expect, type Page, test } from "@playwright/test";
import { cookTimeOptions } from "../../src/data";
import { openRequestOptions, pressCommittedEnter } from "./helpers/combo";

async function addMaterial(page: Page, name: string): Promise<void> {
  await page.getByTestId("combo-input-materials").fill(name);
  await pressCommittedEnter(page.getByTestId("combo-input-materials"));
}

for (const item of [
  "materials",
  "cookTime",
  "ngFoodsAndSeasonings",
  "supplementalNotes",
] as const) {
  test(`条件サマリーの${item}をキーボードで削除しても編集位置を保持する`, async ({ page }) => {
    let sends = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/recipe")
        sends += 1;
    });
    await page.goto("/");
    await addMaterial(page, "豆腐");
    let target = page.getByTestId("combo-input-materials");
    let label = /家にある食材・材料.*を削除/;
    let removedText = "### 家にある食材・材料";
    if (item !== "materials") await openRequestOptions(page);
    if (item === "cookTime") {
      await page.getByTestId("recipe-item-toggle-cookTime").click();
      target = page.getByTestId("cook-time-range");
      await target.focus();
      await target.press("ArrowRight");
      label = /調理時間.*を削除/;
      removedText = "### 調理時間";
    } else if (item === "ngFoodsAndSeasonings") {
      const toggle = page.getByTestId("recipe-item-toggle-ngFoodsAndSeasonings");
      await toggle.click();
      const input = page.getByTestId("combo-input-ngFoodsAndSeasonings");
      await input.fill("卵");
      await pressCommittedEnter(input);
      await toggle.click();
      target = toggle;
      label = /使えない・持っていない.*を削除/;
      removedText = "### 使えない・持っていない食材・調味料";
    } else if (item === "supplementalNotes") {
      await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
      await page.getByTestId("supplemental-notes").fill("洗い物を減らす");
      target = page.getByTestId("recipe-item-toggle-requestOptions");
      await target.click();
      label = /その他の要望ありを削除/;
      removedText = "洗い物を減らす";
    }
    const remove = page.getByTestId("condition-chips").getByRole("button", { name: label });
    await remove.focus();
    await remove.press("Enter");
    await expect(remove).toHaveCount(0);
    await expect(target).toBeFocused();
    await expect(target).toBeInViewport();
    await expect(page.getByTestId("prompt-output")).not.toHaveValue(new RegExp(removedText));
    if (item !== "materials") await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐/);
    expect(sends).toBe(0);
  });
}

for (const width of [320, 390, 1280]) {
  test(`${width}pxで作者リンクとプライバシーを固定操作欄に隠さず表示する`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/");
    await addMaterial(page, "豆腐");
    const footer = page.getByTestId("site-footer");
    const creator = footer.getByTestId("creator-link");
    const privacy = footer.getByTestId("privacy-open");
    await privacy.scrollIntoViewIfNeeded();
    await expect(creator).toHaveAttribute("href", "https://x.com/AudioStakes");
    await expect(creator).toHaveAttribute("target", "_blank");
    await expect(creator).toHaveAttribute("rel", "noopener noreferrer");
    await expect(creator).toBeInViewport();
    await expect(privacy).toBeInViewport();
    if (width < 1024) {
      const footerBounds = await footer.boundingBox();
      const actionsBounds = await page.getByTestId("mobile-action-footer").boundingBox();
      expect(footerBounds).not.toBeNull();
      expect(actionsBounds).not.toBeNull();
      expect((footerBounds?.y ?? 0) + (footerBounds?.height ?? 0)).toBeLessThanOrEqual(
        actionsBounds?.y ?? 0,
      );
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test("カードの量入力と使い方のキー操作を材料追加として扱わない", async ({ page }) => {
  await page.goto("/");
  let requests = 0;
  await page.route("**/api/recipe", async (route) => {
    requests += 1;
    await route.abort();
  });
  await addMaterial(page, "豆腐");
  const card = page.getByTestId(/^material-card-/);
  const amount = card.getByTestId(/^material-amount-/);
  await amount.click();
  await page.keyboard.type("150g");
  await page.keyboard.press("Backspace");
  await expect(amount).toHaveValue("150");
  await expect(amount).toBeFocused();
  for (let step = 0; step < 3; step += 1) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Delete");
  await expect(amount).toHaveValue("50");
  await expect(amount).toBeFocused();
  await expect(page.getByTestId("combo-suggestions-materials")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  const auto = card.getByRole("radio", { name: "おまかせ", exact: true });
  await auto.focus();
  await page.keyboard.press("ArrowRight");
  const required = card.getByRole("radio", { name: "必ず使う", exact: true });
  await expect(required).toBeChecked();
  await expect(required).toBeFocused();
  await expect(amount).toHaveValue("50");
  await expect(page.getByTestId("combo-pill-materials")).toHaveCount(1);
  expect(requests).toBe(0);
});

test("要望を閉じても品数と役割の指定が入口に表示される", async ({ page }) => {
  await page.goto("/");
  await openRequestOptions(page);
  await page.getByLabel("一緒に出す料理に合わせたい").check();
  await page.getByTestId("combo-input-recipeRoles").fill("副菜・一品");
  await pressCommittedEnter(page.getByTestId("combo-input-recipeRoles"));
  const toggle = page.getByTestId("recipe-item-toggle-requestOptions");
  await toggle.click();
  await expect(toggle).toContainText("1品だけ・副菜・一品");
  await expect(page.getByTestId("combo-input-recipeRoles")).toBeHidden();
  await expect(page.getByTestId("prompt-output")).toHaveValue(
    /### 料理の役割・量感\n\n- 副菜・一品/,
  );
});

test("矢印で候補へ進んでTabで退出すると通常の候補パネルを閉じる", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("combo-input-materials");
  await input.fill("卵");
  await input.press("ArrowDown");
  await expect(page.getByTestId("combo-option-materials").first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("combo-suggestions-materials")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  // The native Tab destination depends on the browser/OS keyboard-navigation setting.
  expect(
    await page.evaluate(() => document.activeElement?.closest('[role="listbox"]') === null),
  ).toBe(true);
});

test("材料のblur確定中も、別カードで入力し始めた量とフォーカスを保つ", async ({ page }) => {
  await page.goto("/");
  await addMaterial(page, "豆腐");
  const tofu = page.getByTestId(/^material-card-/).filter({ hasText: "豆腐" });
  const amount = tofu.getByTestId(/^material-amount-/);
  await page.getByTestId("combo-input-materials").fill("追加の材料");
  await amount.click();
  // Typing spans the existing delayed blur commit; it must keep targeting this amount.
  await page.keyboard.type("150グラム", { delay: 75 });
  await expect(page.getByTestId("combo-pill-label-materials")).toHaveText(["追加の材料", "豆腐"]);
  await expect(amount).toBeFocused();
  await expect(amount).toHaveValue("150グラム");
  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐（量: 150グラム）/);
});

test("材料のblur確定と名称編集を続けても編集途中の文字やフォーカスを失わない", async ({ page }) => {
  await page.goto("/");
  await addMaterial(page, "豆腐");
  await page.getByTestId("combo-input-materials").fill("追加の材料");
  await page.getByTestId("combo-input-materials").press("Escape");
  await page.getByTestId("combo-pill-label-materials").click();
  const editor = page.getByTestId("combo-pill-edit-materials");
  await page.keyboard.type("Tofu", { delay: 75 });
  await expect(editor).toHaveValue("Tofu");
  await expect(editor).toBeFocused();
  await pressCommittedEnter(editor);
  await expect(page.getByTestId("combo-pill-label-materials")).toHaveText(["追加の材料", "Tofu"]);
});

test("プライバシーをアプリ内で開き、背景操作を防いで閉じた位置へ戻れる", async ({
  page,
  browserName,
  isMobile,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  let apiCalls = 0;
  await page.route("**/api/recipe", async (route) => {
    apiCalls += 1;
    await route.abort();
  });
  await page.goto("/");
  const opener = page.getByTestId("privacy-open");
  const dialog = page.getByRole("dialog", { name: "プライバシー", exact: true });
  const close = page.getByTestId("privacy-close");
  await opener.scrollIntoViewIfNeeded();
  const originalScrollY = await page.evaluate(() => window.scrollY);
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(dialog).toContainText("食材・要望・依頼文・AI回答はアクセス解析へ送信しません。");
  await expect(dialog).toContainText("Cloudflare Web Analytics");
  await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
  const lockedScrollY = await page.evaluate(() => window.scrollY);
  const lastLink = dialog.getByRole("link").last();
  await close.press("Shift+Tab");
  await expect(lastLink).toBeFocused();
  await lastLink.press("Tab");
  await expect(close).toBeFocused();
  await page.getByTestId("combo-input-materials").evaluate((element) => {
    (element as HTMLElement).focus();
  });
  await expect(close).toBeFocused();
  const supportsWheel = browserName !== "webkit" || !isMobile;
  if (supportsWheel) {
    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, 500);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(lockedScrollY);
  }
  await close.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(originalScrollY);
  await opener.click();
  await close.click();
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.mouse.click(4, 4);
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(apiCalls).toBe(0);
});

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
  await expect(page.getByTestId("combo-pill-label-materials")).toHaveText(["キャベツ", "綿豆"]);
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
  await openRequestOptions(page);
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
  { width: 1280, height: 390 },
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

test("分量から使い方・削除・次の材料へTabで進み、入力を続けられる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await addMaterial(page, "豆腐");
  await addMaterial(page, "キャベツ");
  const tofu = page.getByTestId(/^material-card-/).filter({ hasText: "豆腐" });
  const cabbage = page.getByTestId(/^material-card-/).filter({ hasText: "キャベツ" });
  // The new UI displays the newest material first, with usage below its amount.
  await cabbage.getByRole("radio", { name: "使い切る", exact: true }).check();
  const amount = cabbage.getByTestId(/^material-amount-/);
  await amount.fill("1/2玉");
  await page.keyboard.press("Tab");
  // Safari's native keyboard setting may skip the radio group; other profiles visit it.
  const usage = cabbage.getByRole("radio", { name: "使い切る", exact: true });
  if (await usage.evaluate((element) => element === document.activeElement)) {
    await expect(usage).toBeFocused();
    await page.keyboard.press("Tab");
  }
  // The separate delete action follows usage; native settings can also skip buttons.
  if (await cabbage.locator(":focus").count()) {
    await expect(
      cabbage.getByRole("button", { name: "キャベツを材料から削除", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
  }
  await expect(tofu.locator(":focus")).toHaveCount(1);
  const nextAmount = tofu.getByTestId(/^material-amount-/);
  // Native Tab can include buttons and the checked radio, depending on OS/settings.
  // Every step must remain in the next material; losing focus or skipping it fails.
  for (let tabs = 0; tabs < 3; tabs += 1) {
    if (await nextAmount.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
    await expect(tofu.locator(":focus")).toHaveCount(1);
  }
  await expect(nextAmount).toBeFocused();
  await page.keyboard.type("1丁");
  await expect(nextAmount).toHaveValue("1丁");
  await expect(nextAmount).toBeFocused();
  await expect(page.getByTestId("prompt-output")).toHaveValue(/豆腐（量: 1丁）/);
  await expect(amount).not.toHaveAttribute("aria-invalid", "true");
  await expect(cabbage.getByTestId(/^material-use-up-error-/)).toBeHidden();
  await expect(page.getByTestId("prompt-output")).toHaveValue(/キャベツ（使い切りたい量: 1\/2玉）/);
});

for (const width of [320, 390, 1280]) {
  test(`${width}pxで最新材料を先頭表示し、依頼文順序と固定操作・最後の項目への到達性を保つ`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await addMaterial(page, "豆腐");
    await addMaterial(page, "キャベツ");
    await expect(page.getByTestId("combo-pill-label-materials")).toHaveText(["キャベツ", "豆腐"]);
    await expect(page.getByTestId("prompt-output")).toHaveValue(
      /### 家にある食材・材料\n\n- 豆腐\n- キャベツ/,
    );
    const footer = page.getByTestId("mobile-action-footer");
    await expect(page.getByTestId("mobile-ai-prompt-send")).toBeVisible();
    await expect(page.getByTestId("copy-prompt-sticky")).toBeVisible();
    const cards = page.getByTestId(/^material-card-/);
    for (const card of await cards.all()) {
      for (const target of await card.getByRole("button").all()) {
        const bounds = await target.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(44);
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }
    }
    await openRequestOptions(page);
    await page.getByTestId("recipe-item-toggle-supplementalNotes").click();
    const notes = page.getByTestId("supplemental-notes");
    await notes.fill("最後の項目まで操作する");
    await notes.scrollIntoViewIfNeeded();
    const noteBounds = await notes.boundingBox();
    const footerBounds = await footer.boundingBox();
    if (!noteBounds || !footerBounds) throw new Error("Notes and fixed actions must be visible");
    expect(noteBounds.y + noteBounds.height).toBeLessThanOrEqual(footerBounds.y);
    await page.getByTestId("privacy-open").scrollIntoViewIfNeeded();
    await page.getByTestId("privacy-open").click();
    await expect(page.getByTestId("privacy-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("privacy-open")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}
