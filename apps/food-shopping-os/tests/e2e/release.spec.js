import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const onboard = async (page, name = 'Ada') => {
  await page.goto('/');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start using Forq' }).click();
  await expect(page.getByText(new RegExp(`Good (morning|afternoon|evening), ${name}`))).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('onboards, navigates by keyboard and opens an accessible sheet', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: /^You — profile/ }).click();
  const goals = page.getByRole('button', { name: /^Maintenance 2,200/ });
  await goals.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Goals & targets' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(goals).toBeFocused();
});

test('exports and restores a complete backup from first run', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: /^You — profile/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  const backup = await download.path();

  await page.getByRole('button', { name: 'Reset app' }).click();
  await page.getByRole('button', { name: 'Tap to confirm' }).click();
  await expect(page.getByText('Welcome to Forq')).toBeVisible();

  await page.getByLabel('Restore Forq backup').setInputFiles(backup);
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await expect(page.getByText('Welcome to Forq')).toHaveCount(0);
});

test('preserves corrupt storage and offers recovery', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('forq-state-v2', '{broken'));
  await page.reload();

  await expect(page.getByText('Saved data needs attention')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download original data' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('forq-state-v2'))).toBe('{broken');
});

test('home has no automatically detectable accessibility violations', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('reopens offline after the service worker is ready', async ({ page, context }) => {
  await onboard(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Good (morning|afternoon|evening), Ada/)).toBeVisible();
});
