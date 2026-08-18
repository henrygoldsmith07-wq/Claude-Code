import { expect, test } from "@playwright/test";

test("question evidence database exposes searchable provenance", async ({ page }) => {
  await page.goto("/");

  const onboarding = page.getByText(/Revision that knows what to do next/i);
  if (await onboarding.isVisible()) {
    await page.getByRole("button", { name: /Continue/i }).first().click();
    await page.waitForTimeout(300);

    const subjectCard = page.locator("button.card").first();
    if (await subjectCard.isVisible()) await subjectCard.click();
    const subjectContinue = page.getByRole("button", { name: /Continue/i }).first();
    if (await subjectContinue.isVisible()) await subjectContinue.click();

    await page.waitForTimeout(300);
    const examContinue = page.getByRole("button", { name: /Continue/i }).first();
    if (await examContinue.isVisible()) await examContinue.click();

    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Build my plan|Continue/i }).first().click();
  }

  await page.goto("/question-evidence");
  const main = page.locator("main#main");
  await expect(main).toContainText("Question Evidence Database");
  await expect(page.getByRole("textbox", { name: "Search the evidence database" })).toBeVisible();
  await expect(page.getByLabel("Evidence status")).toBeVisible();
  await expect(main).toContainText(/Evidence records|No matching evidence records/);

  const evidenceDetails = page.getByText("Inspect evidence and history").first();
  if (await evidenceDetails.isVisible()) {
    await evidenceDetails.click();
    await expect(main).toContainText("Specification evidence");
  }
});
