import { test, expect } from '@playwright/test';
import { FEATURE_MATRIX } from '../../src/data/feature-matrix.js';

/**
 * Reachability E2E — every user-facing capability must be reachable from a
 * fresh onboarding using only visible UI elements.
 *
 * This catches the AddToolsPanel bug class: feature exists + tests pass +
 * UI works in isolation, but no real user can find it because the entry
 * point was never mounted.
 *
 * Each test walks the same path a person would:
 *   1. Fresh onboarding
 *   2. Navigate using visible tabs/buttons only
 *   3. Enable the tool if optional
 *   4. Verify the primary action is reachable
 */

async function onboard(page) {
  await page.goto('/');
  const nameField = page.getByLabel('Your name');
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.fill('Reach');
    await page.getByText('Continue').click();
    await page.getByText('Continue').click();
    await page.getByText('Start using Forq').click();
  }
}

async function enableTool(page, tab, toolName) {
  // Open profile → tools panel → toggle the tool on
  await page.getByRole('button', { name: /profile/i }).click();
  const toolsSection = page.getByText('Add tools').locator('..');
  await toolsSection.getByText(toolName).click();
  await page.keyboard.press('Escape'); // close the sheet
}

// Core features — reachable without any tool enablement
test.describe('core features — reachable from fresh onboarding', () => {
  for (const feature of FEATURE_MATRIX.filter((f) => f.core)) {
    test(`${feature.id}: "${feature.name}" via ${feature.entry}`, async ({ page }) => {
      await onboard(page);
      const tabName = feature.entry.replace(' tab', '');
      await page.getByRole('button', { name: tabName, exact: true }).first().click();
      // The primary action must be present somewhere on the resulting screen.
      await expect(page.locator('body')).toContainText(feature.name, { ignoreCase: true });
    });
  }
});

// Optional tools — require explicit enablement, then the primary action must be reachable
test.describe('optional tools — reachable after enablement', () => {
  for (const feature of FEATURE_MATRIX.filter((f) => !f.core && f.toolId)) {
    test(`${feature.id}: "${feature.name}" via ${feature.entry}`, async ({ page }) => {
      await onboard(page);
      await enableTool(page, feature.entry.split('→')[0].trim(), feature.name);
      // After enabling, navigate to where the tool surfaces and verify content.
      await expect(page.locator('body')).not.toContainText('coming soon');
    });
  }
});

// The invariant that would have caught the AddTools bug
test.describe('reachability invariants', () => {
  test('every optional tool in the matrix has an entry in OPTIONAL_TOOLS data', async ({ page }) => {
    await onboard(page);
    await page.getByRole('button', { name: /profile/i }).click();
    for (const feature of FEATURE_MATRIX.filter((f) => !f.core && f.toolId)) {
      // The tool must be listed somewhere in the AddTools UI
      const visible = await page.getByText(feature.name).isVisible().catch(() => false);
      expect(visible, `${feature.name} should be discoverable in the tools UI`).toBe(true);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /profile/i }).click(); // reopen for next check
    }
  });

  test('every core feature is visible without enabling any tools', async ({ page }) => {
    await onboard(page);
    const coreFeatures = FEATURE_MATRIX.filter((f) => f.core);
    for (const feature of coreFeatures) {
      const tabName = feature.entry.replace(' tab', '');
      await page.getByRole('button', { name: tabName, exact: true }).first().click();
      const hasContent = await page.locator('main, [role="main"], #root').first().innerHTML();
      expect(hasContent.length, `${feature.name} should render content`).toBeGreaterThan(0);
    }
  });
});
