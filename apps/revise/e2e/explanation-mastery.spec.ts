import { expect, test } from "@playwright/test";

test("Study exposes an explanation mastery mode", async ({ page }) => {
  await page.goto("/");

  const onboarding = page.getByText(/Revision that knows what to do next/i);
  const today = page.locator("main#main");
  await expect(onboarding.or(today).first()).toBeVisible({ timeout: 15_000 });
  if (await onboarding.isVisible()) {
    await page.getByText(/Skip — I will set this up later/i).click();
    await expect(today).toBeVisible({ timeout: 15_000 });
  }

  await page.goto("/study");
  await expect(today).toContainText("Explain mastery");
  await page.getByRole("button", { name: "Start explain mastery" }).click();
  await expect(today).toContainText("Explain a topic from memory");
  await expect(today).toContainText("Check my explanation");

  await page.getByLabel("Your answer").fill("Force equals mass times acceleration.");
  await page.getByRole("button", { name: "Check my explanation" }).click();
  await expect(today).toContainText("Reference summary");
  await expect(today).toContainText("Still to add");
});
