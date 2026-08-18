import { expect, test } from "@playwright/test";

test("Practice exposes five- and ten-minute question sprints", async ({ page }) => {
  await page.goto("/");

  const onboarding = page.getByText(/Revision that knows what to do next/i);
  const today = page.locator("main#main");
  await expect(onboarding.or(today).first()).toBeVisible({ timeout: 15_000 });
  if (await onboarding.isVisible()) {
    await page.getByText(/Skip — I will set this up later/i).click();
    await expect(today).toBeVisible({ timeout: 15_000 });
  }

  await page.goto("/practice");
  await expect(today).toContainText("Short on time?");
  await expect(today).toContainText("I Have 5 Minutes");
  await expect(today).toContainText("I Have 10 Minutes");

  await page.getByRole("button", { name: "I Have 5 Minutes" }).click();
  await expect(today).toContainText("Use the time you actually have.");
  await expect(today).toContainText("Start 5-minute sprint");
  await expect(today).toContainText("unseen questions and weaker topics first");
});
