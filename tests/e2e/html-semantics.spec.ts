import { expect, test } from "@playwright/test";
import { FileSystemConfigLoader, HtmlValidate } from "html-validate/node";

type HtmlWrite = { target: string; value: string };
type CaptureWindow = Window & { htmlWrites?: HtmlWrite[] };

test("描画前の初期HTMLにラベルと有効なコントロール構造がある", async ({ page }) => {
  await page.addInitScript(() => {
    const captureWindow = window as CaptureWindow;
    const writes: HtmlWrite[] = [];
    captureWindow.htmlWrites = writes;
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
    const nativeSetter = descriptor?.set;
    if (!descriptor || !nativeSetter) throw new Error("innerHTML setter is unavailable.");
    Object.defineProperty(Element.prototype, "innerHTML", {
      ...descriptor,
      set(value: string) {
        const element = this as Element;
        if (["app", "basicFields", "advancedFields"].includes(element.id)) {
          writes.push({ target: element.id, value });
        }
        nativeSetter.call(element, value);
      },
    });
  });
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  const writes = await page.evaluate(() => (window as CaptureWindow).htmlWrites ?? []);
  expect(writes.map((write) => write.target)).toEqual(["app", "basicFields", "advancedFields"]);
  const validator = new HtmlValidate(new FileSystemConfigLoader());
  for (const write of writes) {
    const report = await validator.validateString(write.value, "index.html");
    expect(
      report.valid,
      JSON.stringify({
        target: write.target,
        messages: report.results.flatMap((result) => result.messages),
      }),
    ).toBe(true);
  }
  // Browser parsing preserves duplicate IDs; check references across all captured chunks.
  const documentIssues = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    const missingReferences: string[] = [];
    for (const element of document.querySelectorAll(
      "[aria-controls], [aria-labelledby], [aria-describedby], label[for]",
    )) {
      for (const attribute of ["aria-controls", "aria-labelledby", "aria-describedby", "for"]) {
        for (const id of (element.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) missingReferences.push(id);
        }
      }
    }
    return {
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      missingReferences,
    };
  });
  expect(documentIssues).toEqual({ duplicateIds: [], missingReferences: [] });
  await expect(page.getByRole("group", { name: "実行方法", exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("mobile-prompt-panel")).toBeHidden();
  await page.getByTestId("combo-input-materials").focus();
  for (let count = 0; count < 15; count += 1) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[data-testid="mobile-prompt-panel"]')),
      ),
    ).toBe(false);
  }
});
