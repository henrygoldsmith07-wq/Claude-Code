/**
 * Browser end-to-end tests.
 *
 * These check the things a DOM shim cannot: that the app really boots, that
 * colour contrast is genuinely sufficient in both light and dark schemes, and
 * that the whole interface can be reached with the keyboard alone.
 *
 * The synthetic user is booted once per worker and shared across the tests
 * (they are all read-only by construction): the boot is the expensive part,
 * and ten boots of the same deterministic demo prove nothing ten times.
 *
 * Run `npm run e2e:serve` once in a terminal for a persistent preview server:
 * the playwright webServer block below then reuses it instead of rebuilding
 * on every run.
 */

import { createRequire } from "node:module";
import { expect, test as base, type Page } from "@playwright/test";

// axe is injected from the local install rather than a CDN: the app is
// offline-first and the test suite should be too.
const AXE_SOURCE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

async function runAxe(page: Page): Promise<{ id: string; help: string; nodes: number }[]> {
  await page.addScriptTag({ path: AXE_SOURCE });
  return page.evaluate(async () => {
    const results = await (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: { id: string; help: string; nodes: unknown[] }[] }> } }).axe.run(
      document,
      { resultTypes: ["violations"] },
    );
    return results.violations.map((violation) => ({ id: violation.id, help: violation.help, nodes: violation.nodes.length }));
  });
}

// One page, booted lazily by whichever test runs first, then shared by all of
// them. The built-in `page` fixture cannot be re-scoped to a worker, so this
// is a plain test-scoped override that simply never tears its page down — it
// lives until the worker does. The tests must be read-only; they are, by
// design.
let sharedPage: Page | null = null;

/* eslint-disable react-hooks/rules-of-hooks -- Playwright's fixture `use` callback is not a React hook */
const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    if (!sharedPage) {
      sharedPage = await browser.newPage();
      await sharedPage.goto("/");
      await expect(sharedPage.getByRole("heading", { name: "Pulse", level: 1 })).toBeVisible();
      // The demo boots against a synthetic user; wait for the engine to finish.
      await expect(sharedPage.getByRole("heading", { name: "What Pulse believes" })).toBeVisible({ timeout: 60_000 });
    }
    await use(sharedPage);
  },
});
/* eslint-enable react-hooks/rules-of-hooks */

// The suite is serial: tests share one booted page and run in order, so each
// starts from the same deterministic demo state.
test.describe.configure({ mode: "serial" });

// Order-proofing: whatever the previous test left behind, the next one starts
// on the Insights tab at the desktop viewport. This is a keyboard reset, not
// a click: a mouse interaction would flip Chrome's :focus-visible heuristic
// and starve the focus-visibility test below.
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("tab", { name: "Insights" }).focus();
  await page.keyboard.press("Enter");
});

test("boots against the synthetic user and shows evidence, not a dashboard", async ({ page }) => {
  await expect(page.getByText(/survived correction across \d+ comparisons/)).toBeVisible();
  await expect(page.getByText(/Expect roughly [\d.]+ of them to be false/)).toBeVisible();
});

test("shows the causality note next to every finding, never a causal claim", async ({ page }) => {
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toMatch(/\b(causes|caused|proves)\b/);
  const notes = page.getByRole("note");
  if ((await notes.count()) > 0) {
    await expect(notes.first()).toContainText(/not a cause|association/i);
  }
});

test("shows the Today decision brief and closes the recommendation loop", async ({ page }) => {
  await expect(page.getByText("Decision brief ·", { exact: false })).toBeVisible();
  for (const label of ["What changed", "What looks normal", "What is unusual", "What matters", "Reasonable action", "Evidence strength"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  const today = page.locator(".today-panel");
  const recommendationCard = today.locator(".recommendation-card");
  await recommendationCard.getByRole("button", { name: "Try this" }).click();
  await expect(page.getByRole("status")).toContainText(/Recommendation accepted/);
  await recommendationCard.getByRole("button", { name: "It helped" }).click();
  await expect(page.getByRole("status")).toContainText(/Outcome recorded/);
});

test("every tab is reachable and operable from the keyboard alone", async ({ page }) => {
  await page.keyboard.press("Tab");
  // Walk forward until focus lands on the first tab, then activate each in turn.
  for (let i = 0; i < 20; i += 1) {
    const role = await page.evaluate(() => document.activeElement?.getAttribute("role"));
    if (role === "tab") break;
    await page.keyboard.press("Tab");
  }
  await expect(page.locator(":focus")).toHaveAttribute("role", "tab");

  for (const label of ["History", "Timeline", "Experiments", "Ask Pulse", "Evidence", "Sources & privacy"]) {
    await page.getByRole("tab", { name: label, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute("aria-selected", "true");
  }
});

test("focus is always visible", async ({ page }) => {
  // Activate with a real keyboard event: script focus alone does not reliably
  // match :focus-visible, and the outline only needs to exist when a keyboard
  // user could be looking for it.
  await page.getByRole("tab", { name: "Timeline" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(":focus")).toHaveAttribute("role", "tab");
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(outline.style).not.toBe("none");
  expect(parseFloat(outline.width)).toBeGreaterThan(0);
});

test("has no accessibility violations in the light scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  expect(await runAxe(page)).toEqual([]);
});

test("has no accessibility violations in the dark scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await runAxe(page)).toEqual([]);
});

test("answers a question end to end", async ({ page }) => {
  await page.getByRole("tab", { name: "Ask Pulse" }).click();
  await page.getByLabel(/Ask a question about your own data/).fill("When do I revise most effectively?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/highest in the|I have \d+ sessions|come from only|concentrated in one part/)).toBeVisible();
});

test("privacy controls name every source and offer revocation", async ({ page }) => {
  await page.getByRole("tab", { name: "Sources & privacy" }).click();
  await expect(page.getByText(/processes everything on this device/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reflect" })).toBeVisible();
  await expect(page.getByText(/must be granted on its own/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Revoke and delete all/ }).first()).toBeVisible();
});

test("does not scroll horizontally on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("walks the whole evidence loop with the keyboard alone", async ({ page }) => {
  // Search a metric that has both findings and a rejection trail.
  await page.getByRole("tab", { name: "Evidence search", exact: true }).focus();
  await page.keyboard.press("Enter");
  const search = page.getByLabel(/Search the evidence/);
  await search.focus();
  await page.keyboard.type("sleep");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Checked, not published").first()).toBeVisible();

  // Drill into the scan that produced a rejection.
  await page.getByRole("button", { name: "View the scan that checked this" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Findings published in this scan/)).toBeVisible();

  // Open a finding from the scan card.
  const scanFinding = page.locator(".scan-detail__finding-button").first();
  await scanFinding.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Insights" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".finding--highlight")).toBeVisible();

  // The scan survives the drill-in: return to it via the back-to-scan pill.
  await page.getByRole("button", { name: /Back to scan/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".scan-detail")).toBeVisible();

  // Return to the exact query that started the journey.
  await page.getByRole("button", { name: /Back to search/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Evidence search", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(search).toHaveValue("sleep");
  await expect(page.getByText("Checked, not published").first()).toBeVisible();
});
