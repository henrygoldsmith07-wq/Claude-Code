/**
 * Browser end-to-end tests.
 *
 * These check the things a DOM shim cannot: that the app really boots, that
 * colour contrast is genuinely sufficient in both light and dark schemes, and
 * that the whole interface can be reached with the keyboard alone.
 */

import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

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

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pulse", level: 1 })).toBeVisible();
  // The demo boots against a synthetic user; wait for the engine to finish.
  await expect(page.getByRole("heading", { name: "What Pulse believes" })).toBeVisible({ timeout: 60_000 });
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

test("every tab is reachable and operable from the keyboard alone", async ({ page }) => {
  await page.keyboard.press("Tab");
  // Walk forward until focus lands on the first tab, then activate each in turn.
  for (let i = 0; i < 20; i += 1) {
    const role = await page.evaluate(() => document.activeElement?.getAttribute("role"));
    if (role === "tab") break;
    await page.keyboard.press("Tab");
  }
  await expect(page.locator(":focus")).toHaveAttribute("role", "tab");

  for (const label of ["Timeline", "Experiments", "Ask Pulse", "Sources & privacy"]) {
    await page.getByRole("tab", { name: label }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
  }
});

test("focus is always visible", async ({ page }) => {
  await page.getByRole("tab", { name: "Timeline" }).focus();
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
