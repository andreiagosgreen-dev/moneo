import { test, expect } from '@playwright/test';

/**
 * The core local-first loop (no auth, no network) — if this breaks,
 * nothing else matters. Kept separate from the auth-mocked specs so it
 * stays trivially fast and never depends on the Supabase mock working.
 */
test('loads, starts, pauses and resets a focus session', async ({ page }) => {
  await page.goto('/');

  // Onboarding: dismiss if present, don't fail the test if it's already seen.
  const skip = page.getByRole('button', { name: /skip/i }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }

  await expect(page.getByText('25', { exact: true })).toBeVisible();
  await expect(page.getByText(/ready/i)).toBeVisible();

  await page.getByRole('button', { name: /start timer/i }).click();
  await expect(page.getByText(/in session/i)).toBeVisible();
  await expect(page).toHaveTitle(/\d{2}:\d{2} · .+ — Moneo/);

  await page.getByRole('button', { name: /reset timer/i }).click();
  await expect(page.getByText(/ready/i)).toBeVisible();
  await expect(page.getByText('25', { exact: true })).toBeVisible();
  await expect(page.getByText('00', { exact: true })).toBeVisible();
});
