import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * The core loop: Moneo is a Pomodoro timer first. If this breaks, nothing
 * else matters. Mono Focus replaces the old Focus/Short/Long tabs with
 * duration presets (5 / 25 / 45 min) and a Start → Pause → Resume control,
 * all local-first (no signed-in session needed).
 *
 * Empty first-run boots land on Today; open Focus before asserting the clock.
 */
test.describe('focus timer', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Focus', exact: true }).click();
    await expect(page.locator('.atm-time').first()).toBeVisible();
  });

  const clock = (page: import('@playwright/test').Page) => page.locator('.atm-time').first();

  test('loads with a 25:00 clock and a start control', async ({ page }) => {
    await expect(clock(page)).toHaveText('25:00');
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  });

  test('duration presets change the clock', async ({ page }) => {
    await page.getByRole('button', { name: '5 min', exact: true }).click();
    await expect(clock(page)).toHaveText('05:00');

    await page.getByRole('button', { name: '45 min', exact: true }).click();
    await expect(clock(page)).toHaveText('45:00');

    await page.getByRole('button', { name: '25 min', exact: true }).click();
    await expect(clock(page)).toHaveText('25:00');
  });

  test('start flips the control to pause and the clock counts down', async ({ page }) => {
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

    await expect(clock(page)).not.toHaveText('25:00', { timeout: 5_000 });

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  });
});
