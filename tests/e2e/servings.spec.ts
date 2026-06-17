import { expect, test } from "@playwright/test";

test("食べる人数は4区分のステッパーUIで増減できる", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("詳しく指定").check();
  const output = page.getByTestId("prompt-output");

  const groups = [
    {
      id: "adultCount",
      label: "大人",
      aria: "大人を1人増やす",
    },
    {
      id: "seniorCount",
      label: "シニア",
      aria: "シニアを1人増やす",
    },
    {
      id: "childCount",
      label: "子供",
      aria: "子供を1人増やす",
    },
    {
      id: "toddlerCount",
      label: "幼児",
      aria: "幼児を1人増やす",
    },
  ] as const;

  for (const group of groups) {
    const stepper = page.getByTestId(`serving-stepper-${group.id}`);
    await expect(page.getByTestId(`serving-label-${group.id}`)).toContainText(group.label);
    await expect(stepper.getByRole("button", { name: /減らす$/ })).toBeDisabled();
    await expect(stepper.getByRole("button", { name: group.aria })).toBeEnabled();
    await expect(page.getByTestId(`serving-count-${group.id}`)).toHaveText("0人");
  }

  await page.getByTestId("serving-plus-adultCount").click();
  await page.getByTestId("serving-plus-adultCount").click();
  await page.getByTestId("serving-plus-childCount").click();
  await page.getByTestId("serving-plus-toddlerCount").click();

  await expect(page.getByTestId("serving-count-adultCount")).toHaveText("2人");
  await expect(page.getByTestId("serving-count-childCount")).toHaveText("1人");
  await expect(page.getByTestId("serving-count-toddlerCount")).toHaveText("1人");
  await expect(output).toHaveValue(/### 人数・分量[\s\S]*大人2人、子供1人、幼児1人/);
  await expect(page.getByTestId("condition-chips")).toContainText("大人2人、子供1人、幼児1人");
  await expect(page.locator("select")).toHaveCount(0);

  for (let index = 0; index < 8; index += 1) {
    await page.getByTestId("serving-plus-adultCount").click();
  }

  await expect(page.getByTestId("serving-count-adultCount")).toHaveText("10人");
  await expect(page.getByTestId("serving-plus-adultCount")).toBeDisabled();
  await expect(output).toHaveValue(/### 人数・分量[\s\S]*大人10人、子供1人、幼児1人/);
});

test("人数・分量プリセットはステッパーなしで依頼文へ反映される", async ({ page }) => {
  await page.goto("/");
  const output = page.getByTestId("prompt-output");

  await page.getByLabel("2人分").check();
  await expect(page.getByTestId("custom-servings-panel")).toBeHidden();
  await expect(output).toHaveValue(/### 人数・分量\n\n2人分/);

  await page.getByLabel("作り置き多め").check();
  await expect(output).toHaveValue(/### 人数・分量\n\n作り置き多め/);

  await page.getByLabel("指定なし").check();
  await expect(output).not.toHaveValue(/### 人数・分量/);
});
