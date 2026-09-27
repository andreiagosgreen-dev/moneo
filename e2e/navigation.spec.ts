import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Mono navigation: a left rail on desktop, a compact bottom bar + "More"
 * overflow on mobile. Confirms each destination actually swaps the
 * rendered section, not just the active-tab styling.
 */
test.describe('mono navigation', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
  });

  test('core tabs switch sections', async ({ page }) => {
    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText("Today's plan")).toBeVisible();

    await page.getByRole('tab', { name: 'Projects', exact: true }).click();
    // Empty state repeats the header CTA, so there are two — either proves the swap.
    await expect(page.getByRole('button', { name: '+ New Project' }).first()).toBeVisible();
  });

  test('Graph is reachable (rail on desktop, More on mobile)', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('tab', { name: 'More', exact: true }).click();
      await page.locator('.mono-more-item', { hasText: 'Graph' }).click();
    } else {
      await page.getByRole('tab', { name: 'Graph', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Graph' })).toBeVisible();
  });

  test('the command palette opens with Ctrl+K and navigates', async ({ page }) => {
    // Wait for the app shell (and its window keydown listener) before the shortcut.
    // Empty first-run boots land on Today, so Focus's .atm-time may be absent.
    await expect(page.getByRole('tab', { name: 'Today', exact: true })).toBeVisible();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByText('Go to Reports').click();
    await expect(page.getByRole('heading', { name: 'Reports' }).first()).toBeVisible();
  });
});
