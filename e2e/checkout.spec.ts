import { test, expect } from '@playwright/test';
import { mockSupabaseAuth, signInViaUi, E2E_USER } from './mocks/supabase';

/**
 * Covers the launch blocker fixed in the 2026-09-18 audit: monthly and
 * yearly plans must open checkout with their own distinct Lemon Squeezy
 * variant id, not the same URL (see lib/billing/lemonSqueezy.ts).
 * Unit tests already cover buildCheckoutUrl()'s string logic in isolation;
 * this exercises the real button click -> real window.open() path.
 */
test.beforeEach(async ({ page }) => {
  await mockSupabaseAuth(page);
  await page.goto('/');
  await signInViaUi(page);
});

test('monthly plan opens checkout with the monthly variant', async ({ page, context }) => {
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Upgrade' }).first().click(),
  ]);
  await popup.waitForLoadState('domcontentloaded').catch(() => {
    // The popup target (e2e-fake-store.lemonsqueezy.com) isn't a real host
    // and won't resolve — we only care about the URL Moneo asked it to open.
  });
  const url = new URL(popup.url());
  expect(url.pathname).toBe('/checkout/buy/e2e-monthly-variant');
  expect(url.searchParams.get('checkout[custom][user_id]')).toBe(E2E_USER.id);
});

test('yearly plan opens checkout with a different, yearly variant', async ({ page, context }) => {
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Upgrade' }).last().click(),
  ]);
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  const url = new URL(popup.url());
  expect(url.pathname).toBe('/checkout/buy/e2e-yearly-variant');
  expect(url.pathname).not.toBe('/checkout/buy/e2e-monthly-variant');
});
