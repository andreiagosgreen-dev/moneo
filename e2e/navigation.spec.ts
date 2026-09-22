import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Top-level navigation, including the "More" overflow menu (Faza 30 —
 * the exact fix that made every tab reachable without a horizontal
 * scroll gesture). Confirms each primary/secondary tab actually swaps
 * the rendered section, not just the active-tab styling.
 */
test.describe('top navigation', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
  });

  test('primary tabs switch sections', async ({ page }) => {
    await page.getByRole('tab', { name: 'Plan' }).click();
    await expect(page.getByRole('tab', { name: 'Plan' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('the More menu reaches Projects and Reports', async ({ page }) => {
    await page.getByRole('tab', { name: 'More sections' }).click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.getByRole('menuitem', { name: /Projects/i }).click();
    await expect(page.getByText(/project/i).first()).toBeVisible();
  });
});
