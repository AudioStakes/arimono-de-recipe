import { expect, type Locator } from "@playwright/test";

export async function pressCommittedEnter(input: Locator): Promise<void> {
  // Firefox's fill() completes a composition. Wait for the real IME guard, rather than
  // treating its immediate confirmation Enter as a separate form submission.
  await expect(input).not.toHaveAttribute("data-just-composed", "true");
  await input.press("Enter");
}
