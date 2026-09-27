import { test, expect } from '@playwright/test';

/**
 * A logged-out visitor who picks a paid plan must land on sign-in with the
 * plan preserved (no blocking alert), so they can resume checkout after
 * logging in. Needs no backend — the redirect happens before any auth call.
 */
test.describe('upgrade without an account', () => {
  test('Upgrade on /pricing opens sign-in and keeps the chosen plan', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });

    await page.goto('/pricing');
    const upgrade = page.getByRole('button', { name: 'Upgrade', exact: true });
    await expect(upgrade).toHaveCount(2);
    // Monthly first, yearly second (pricingConfig order).
    await upgrade.nth(1).click();

    await expect(page).toHaveURL(/\/login\?upgrade=pro-yearly$/);
    await expect(page.getByText('Please sign in to upgrade to Pro')).toBeVisible();
    await expect(page.getByRole('textbox').first()).toBeVisible();
    expect(dialogs).toEqual([]);
  });
});
