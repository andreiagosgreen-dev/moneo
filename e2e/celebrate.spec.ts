import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Celebration moments: finishing a focus session shows a calm, dismissable
 * card. Instead of waiting 5 real minutes, boot from a paused snapshot with
 * two seconds left, resume, and let the real timer finish.
 */
async function bootNearlyDone(page: Page, extra?: () => void): Promise<void> {
  await skipOnboarding(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      'solanum:snapshot',
      JSON.stringify({ mode: 'focus', total: 1500, remaining: 2, cycle: 0 }),
    );
    // Keep the post-session reflection out of the way.
    localStorage.setItem(
      'moneo:notification-prefs',
      JSON.stringify({ sessionReflection: false, deadlineReminders: false }),
    );
  });
  if (extra) await page.addInitScript(extra);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Focus', exact: true }).click();
  await expect(page.locator('.atm-time').first()).toHaveText('00:02');
}

test.describe('celebration moments', () => {
  test('session complete shows a celebration that can be dismissed', async ({ page }) => {
    await bootNearlyDone(page);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();

    const card = page.locator('.mono-celebrate');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('Session complete');

    await card.getByRole('button', { name: 'Close' }).click();
    await expect(card).toHaveCount(0);
  });

  test('stays quiet when celebrations are turned off', async ({ page }) => {
    await bootNearlyDone(page, () => {
      localStorage.setItem('moneo:celebrate-prefs', JSON.stringify({ enabled: false }));
    });
    await page.getByRole('button', { name: 'Resume', exact: true }).click();

    // The session summary proves the round finished; no celebration came with it.
    await expect(page.getByText('Focus session complete', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('.mono-celebrate')).toHaveCount(0);
  });
});
