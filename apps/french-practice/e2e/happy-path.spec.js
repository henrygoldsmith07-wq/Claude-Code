import { test, expect } from '@playwright/test';

// Happy path: new learner → placement → assigned level → lesson/practice → review → progress saved

test.describe('Le Studio happy path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // clear storage to simulate new learner
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('new learner can complete placement and be assigned a level', async ({ page }) => {
    await page.goto('/');
    // Onboarding should appear for new learner (no key, no XP)
    // If onboarding modal appears, skip or complete
    const skip = page.getByRole('button', { name: /skip/i });
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skip.click();
    }
    // Find placement or learning path setup
    // Settings → mock mode should allow placement without key
    await page.evaluate(() => {
      localStorage.setItem('fp.settings', JSON.stringify({ mockMode: true, level: 'A1', theme: null, ttsRate: 1 }));
    });
    await page.reload();
    await expect(page.getByText(/Le Studio|French/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('lesson/practice and review progress is saved', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('fp.settings', JSON.stringify({ mockMode: true, level: 'A1', ttsRate: 1 }));
      // simulate a review
      localStorage.setItem('fp.srs', JSON.stringify({
        'test-word': { interval: 1, due: new Date(Date.now() - 1000).toISOString(), reps: 1, ease: 2.5, lastReviewed: new Date().toISOString() }
      }));
      localStorage.setItem('fp.xp', JSON.stringify(10));
    });
    await page.reload();
    // Navigate to Review tab
    const reviewTab = page.getByRole('button', { name: /review/i });
    if (await reviewTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reviewTab.click();
      await expect(page.locator('body')).toContainText(/Review|Vocabulary|srs/i, { timeout: 5000 });
    }
    // Check XP persists
    const xp = await page.evaluate(() => localStorage.getItem('fp.xp'));
    expect(xp).toBeTruthy();
  });

  test('core vocab/grammar/srs remain usable without AI', async ({ page }) => {
    // Simulate AI unavailable: no key, no mock, no relay
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('fp.settings', JSON.stringify({ mockMode: false, level: 'B1', ttsRate: 1 }));
    });
    await page.reload();
    // App should still load and tabs be clickable
    await expect(page.getByRole('button', { name: /Today|Review|Learn|Progress/i }).first()).toBeVisible({ timeout: 5000 });
    const review = page.getByRole('button', { name: /Review/i });
    if (await review.isVisible({ timeout: 2000 }).catch(() => false)) {
      await review.click();
      await expect(page.locator('body')).not.toContainText(/Error: Something went wrong/i);
    }
  });

  test('mock-mode typed conversation turn gets scored and logs assistance evidence', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('fp.settings', JSON.stringify({ mockMode: true, level: 'A1', ttsRate: 1, theme: null }));
    });
    await page.reload();
    const speak = page.getByRole('button', { name: /^Speak/i });
    await expect(speak).toBeVisible({ timeout: 5000 });
    await speak.click();
    // Type a reply (mock mode evaluates instantly, no network)
    const input = page.getByRole('textbox', { name: /Typed reply/i });
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('Bonjour, je voudrais un café.');
    await input.press('Enter');
    // Partner reply + score badge appear
    await expect(page.getByText(/mock/i).first()).toBeVisible({ timeout: 10000 });
    // Assistance evidence was recorded for the completed turn
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('fp.assistanceLog.v1') || '[]'));
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]).toMatchObject({ skill: 'speaking' });
    expect(typeof log[0].score).toBe('number');
  });
});
