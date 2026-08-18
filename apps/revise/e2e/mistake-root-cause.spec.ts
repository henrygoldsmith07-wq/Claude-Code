import { expect, test } from "@playwright/test";

test("Progress explains the evidence threshold for mistake root-cause diagnosis", async ({ page }) => {
  await page.goto("/");

  const onboarding = page.getByText(/Revision that knows what to do next/i);
  const today = page.locator("main#main");
  await expect(onboarding.or(today).first()).toBeVisible({ timeout: 15_000 });
  if (await onboarding.isVisible()) {
    await page.getByText(/Skip — I will set this up later/i).click();
    await expect(today).toBeVisible({ timeout: 15_000 });
  }

  await page.goto("/progress");
  await expect(today).toContainText("Mistake root-cause diagnosis");
  await expect(today).toContainText(/No open mistakes to diagnose|Marks to recover|Waiting for evidence|Early signal|Actionable pattern/i);
  await expect(today).toContainText(/early signal|Waiting for evidence|Actionable pattern/i);
});
