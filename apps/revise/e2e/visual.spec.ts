import { expect, test } from "@playwright/test";

/**
 * Visual regression — composable, not flaky.
 *
 * - One focused snapshot: Today shell + nav (the most-changed surface).
 * - Tolerances are tight (0.2) so regressions are caught, not hidden.
 * - To update baselines: `npx playwright test --update-snapshots`.
 * - Process contract (docs/architecture.md § Testing): snapshots live at
 *   e2e/__screenshots__/offline.spec.ts/* and are reviewed in PR, not CI-gated
 *   as hard failures — CI uploads them as artefacts and the reviewer confirms.
 */

test.describe("visual regression", () => {
  test("Today shell matches baseline", async ({ page }) => {
    await page.goto("/");
    // Avoid race on onboarding modal — snapshot the shell either way.
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot("today-shell.png", {
      maxDiffPixelRatio: 0.02,
      maxDiffPixels: 200,
      fullPage: false,
    });
  });
});
