import { test, expect } from '@playwright/test';

/**
 * Public routes reachable without a session — no auth, no backend needed.
 * Guards against broken routing/build regressions on pages a visitor
 * might land on directly (shared links, search results, marketing).
 */
test.describe('public pages', () => {
  test('/pricing shows plans and a working back link, no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /pricing/i })).toBeVisible();
    await expect(page.getByText('$0')).toBeVisible();
    await expect(page.getByText('$9')).toBeVisible();
    await expect(page.getByText('$90')).toBeVisible();

    await page.getByRole('link', { name: /back to moneo/i }).click();
    await expect(page).toHaveURL('/');

    expect(errors).toEqual([]);
  });

  test('/login renders the auth form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('/privacy, /terms and /help load with real content', async ({ page }) => {
    for (const path of ['/privacy', '/terms', '/help']) {
      await page.goto(path);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(200);
    }
  });
});
