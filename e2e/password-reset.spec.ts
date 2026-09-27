import { test, expect } from '@playwright/test';

/**
 * Password reset entry points — reachable without a backend. Sending the
 * email and the recovery session need live Supabase and stay manual.
 */
test.describe('password reset', () => {
  test('sign-in offers "Forgot password?" and switches to the reset form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeDisabled();
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
  });

  test('/reset-password without a recovery session explains the link is invalid', async ({
    page,
  }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('invalid or has expired');
    await expect(page).toHaveTitle('Reset password — Moneo');
  });
});
