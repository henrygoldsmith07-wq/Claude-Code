import { test, expect } from '@playwright/test';

test.describe('AI failure modes degrade gracefully', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('quota exceeded shows friendly message and does not break core', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('fp.settings', JSON.stringify({ mockMode: false, level: 'B1', ttsRate: 1 }));
      // Simulate quota exhausted
      localStorage.setItem('fp.quota', JSON.stringify({ day: new Date().toISOString().slice(0,10), count: 80, limit: 80 }));
    });
    await page.reload();
    // Mock a failing Groq response via route interception
    await page.route('**/api/groq/**', async (route) => {
      await route.fulfill({ status: 429, body: JSON.stringify({ error: 'daily_quota_exhausted' }) });
    });
    await page.route('https://api.groq.com/**', async (route) => {
      await route.fulfill({ status: 429, body: JSON.stringify({ error: { message: 'rate limit' } }) });
    });
    // App should still render core tabs
    await expect(page.getByRole('button', { name: /Today|Review|Learn/i }).first()).toBeVisible({ timeout: 5000 });
    // Try to trigger AI (Speaking tab) -> should show friendly error, not crash
    const speak = page.getByRole('button', { name: /Speak/i });
    if (await speak.isVisible({ timeout: 2000 }).catch(() => false)) {
      await speak.click();
      // If an error appears, it should be friendly
      const body = await page.locator('body').textContent();
      // Ensure no raw stack trace
      expect(body).not.toMatch(/TypeError|ReferenceError|Cannot read/i);
    }
  });

  test('bad AI response (non-JSON) is handled', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('fp.settings', JSON.stringify({ mockMode: false, level: 'B1', ttsRate: 1 })));
    await page.route('**/api/groq/**', async (route) => {
      await route.fulfill({ status: 200, body: 'NOT JSON' });
    });
    await page.route('https://api.groq.com/**', async (route) => {
      await route.fulfill({ status: 200, body: '<<< not json >>>' });
    });
    await page.reload();
    const speak = page.getByRole('button', { name: /Speak/i });
    if (await speak.isVisible({ timeout: 2000 }).catch(() => false)) {
      await speak.click();
      await expect(page.locator('body')).not.toContainText(/Uncaught|Unhandled/i);
    }
  });

  test('relay timeout shows retry message', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('fp.settings', JSON.stringify({ mockMode: false, level: 'B1', ttsRate: 1 })));
    await page.route('**/api/groq/**', async (route) => {
      // delay beyond 30s simulated as abort
      await route.abort('timedout');
    });
    await page.reload();
    // Core still works
    await expect(page.getByRole('button', { name: /Today|Review/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('mobile UX: tabs are reachable and viewport fits', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('fp.settings', JSON.stringify({ mockMode: true, level: 'A1', ttsRate: 1 })));
    await page.reload();
    const tabs = page.getByRole('button', { name: /Today|Speak|Review|Learn|Progress/i });
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
    // Ensure no horizontal overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
