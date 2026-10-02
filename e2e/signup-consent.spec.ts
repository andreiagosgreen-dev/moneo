import { test, expect } from '@playwright/test';

/**
 * Creating an account needs an explicit "I agree" to the Terms and the
 * Privacy Policy: the box starts unticked and the button stays disabled
 * until it is ticked. Signing in never asks for it. Needs no backend.
 */
test.describe('sign-up consent', () => {
  test('Create account stays disabled until the Terms box is ticked', async ({ page }) => {
    await page.goto('/login?upgrade=pro-monthly');
    await expect(page.getByRole('tab', { name: 'Create account' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.locator('#account-email').fill('new.user@example.com');
    await page.locator('#account-password').fill('a-long-password');

    const consent = page.getByTestId('signup-consent');
    await expect(consent).not.toBeChecked();
    const create = page.getByRole('button', { name: 'Create account', exact: true });
    await expect(create).toBeDisabled();

    const label = page.locator('label').filter({ has: consent });
    await expect(label.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms',
    );
    await expect(label.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );

    await consent.check();
    await expect(consent).toBeChecked();

    await page.getByRole('tab', { name: 'Sign in' }).click();
    await expect(page.getByTestId('signup-consent')).toHaveCount(0);
  });
});
