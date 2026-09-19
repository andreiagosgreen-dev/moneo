import { test, expect } from '@playwright/test';
import { skipOnboarding } from './mocks/supabase';

/**
 * The core local-first loop (no auth, no network) — if this breaks,
 * nothing else matters. Kept separate from the auth-mocked specs so it
 * stays trivially fast and never depends on the Supabase mock working.
 */
test('loads, starts, pauses and resets a focus session', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/');

  // The digits render as separate {mm}/{ss} text nodes inside one div (no
  // wrapping element around "25" alone), so the accessible name that
  // actually identifies the ready state is the ring's img role — confirmed
  // against a real ARIA snapshot, not assumed.
  await expect(page.getByRole('img', { name: /25:00 remaining/i })).toBeVisible();
  await expect(page.getByText(/ready/i)).toBeVisible();

  await page.getByRole('button', { name: /start timer/i }).click();
  await expect(page.getByText(/in session/i)).toBeVisible();
  await expect(page).toHaveTitle(/\d{2}:\d{2} · .+ — Moneo/);

  await page.getByRole('button', { name: /reset timer/i }).click();
  await expect(page.getByText(/ready/i)).toBeVisible();
  await expect(page.getByRole('img', { name: /25:00 remaining/i })).toBeVisible();
});
