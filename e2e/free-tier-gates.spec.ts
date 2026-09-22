import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Free/Pro gating (ROADMAP.md's "Free/Pro gates" E2E gap). Projects are
 * fully local-first, so the FREE_PROJECTS_LIMIT (3) upsell is reachable
 * without a session — a real regression here (e.g. the limit silently
 * not enforced) would be a monetization bug, not just a UI bug.
 */
test.describe('Free-tier project limit', () => {
  test('creating a 4th project on Free shows the upgrade notice instead', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');

    await page.getByRole('tab', { name: 'Projects', exact: true }).click();

    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: '+ New Project' }).first().click();
      const nameInput = page.getByPlaceholder('e.g. Client X App, Thesis, Mobile Redesign');
      await nameInput.fill(`Project ${i}`);
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(nameInput).toHaveCount(0);
    }

    await page.getByRole('button', { name: '+ New Project' }).first().click();
    await expect(page.getByText('Free limit reached (3 projects)')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Client X App, Thesis, Mobile Redesign')).toHaveCount(
      0,
    );
  });
});
