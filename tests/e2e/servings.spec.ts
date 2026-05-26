import { expect, test } from "@playwright/test";

test("人数・分量は4区分のステッパーUIで増減できる", async ({ page }) => {
  await page.goto("/");

  const groups = [
    {
      id: "adultCount",
      label: "大人",
      aria: "大人を1人増やす",
    },
    {
      id: "seniorCount",
      label: "シニア(60歳以上)",
      aria: "シニア(60歳以上)を1人増やす",
    },
    {
      id: "childCount",
      label: "子供(12歳以下)",
      aria: "子供(12歳以下)を1人増やす",
    },
    {
      id: "toddlerCount",
      label: "幼児(5歳以下)",
      aria: "幼児(5歳以下)を1人増やす",
    },
  ] as const;

  for (const group of groups) {
    const stepper = page.locator(`[data-serving-id="${group.id}"]`);
    await expect(page.locator(`#${group.id}Label`)).toContainText(group.label);
    await expect(stepper.getByRole("button", { name: /減らす$/ })).toBeDisabled();
    await expect(stepper.getByRole("button", { name: group.aria })).toBeEnabled();
    await expect(stepper.locator(".serving-count")).toHaveText("0人");
  }

  await page.locator('[data-serving-id="adultCount"] .serving-plus').click();
  await page.locator('[data-serving-id="adultCount"] .serving-plus').click();
  await page.locator('[data-serving-id="childCount"] .serving-plus').click();
  await page.locator('[data-serving-id="toddlerCount"] .serving-plus').click();

  await expect(page.locator('[data-serving-id="adultCount"] .serving-count')).toHaveText("2人");
  await expect(page.locator('[data-serving-id="childCount"] .serving-count')).toHaveText("1人");
  await expect(page.locator('[data-serving-id="toddlerCount"] .serving-count')).toHaveText("1人");
  await expect(page.locator("#output")).toHaveValue(
    /【人数・分量】[\s\S]*大人2人、子供\(12歳以下\)1人、幼児\(5歳以下\)1人/,
  );
  await expect(page.locator(".chips")).toContainText(
    "大人2人、子供(12歳以下)1人、幼児(5歳以下)1人",
  );
  await expect(page.locator("select")).toHaveCount(0);

  for (let index = 0; index < 8; index += 1) {
    await page.locator('[data-serving-id="adultCount"] .serving-plus').click();
  }

  await expect(page.locator('[data-serving-id="adultCount"] .serving-count')).toHaveText("10人");
  await expect(page.locator('[data-serving-id="adultCount"] .serving-plus')).toBeDisabled();
  await expect(page.locator("#output")).toHaveValue(
    /【人数・分量】[\s\S]*大人10人、子供\(12歳以下\)1人、幼児\(5歳以下\)1人/,
  );
});
