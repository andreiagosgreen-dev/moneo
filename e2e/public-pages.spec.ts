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
    // Match the real Lemon Squeezy prices ($5.99/mo, $59.99/yr), not
    // placeholders, so this test catches drift between the two again.
    for (const plan of ['Free', 'Pro (Monthly)', 'Pro (Yearly)']) {
      await expect(page.getByRole('heading', { name: plan, exact: true })).toBeVisible();
    }
    const body = await page.locator('body').innerText();
    expect(body).toContain('$0');
    expect(body).toContain('$5.99');
    expect(body).toContain('$59.99');
    // Account sync row: free accounts sync sessions/areas/settings, Pro saves everything.
    const syncRow = page.getByRole('row', { name: /sync between devices/i });
    await expect(syncRow).toContainText('Sessions, areas & settings');
    await expect(syncRow).toContainText('All your data');

    await page.getByRole('link', { name: /back to moneo/i }).click();
    await expect(page).toHaveURL('/');

    expect(errors).toEqual([]);
  });

  test('/login renders the auth form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('/privacy, /terms, /refund and /help load with real content', async ({ page }) => {
    for (const path of ['/privacy', '/terms', '/refund', '/help']) {
      await page.goto(path);
      // Legal pages are a lazy chunk — wait for the heading before reading text.
      await expect(page.locator('h1').first()).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(200);
    }
  });

  test('/refund is the refund policy, not the app, and links support by email', async ({
    page,
  }) => {
    await page.goto('/refund');
    await expect(page.getByRole('heading', { level: 1, name: 'Refund Policy' })).toBeVisible();
    await expect(page.locator('.atm-root')).toHaveCount(0);
    await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
    await expect(page).toHaveTitle('Refund Policy — Moneo');
  });
});
