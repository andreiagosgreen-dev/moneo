import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * The core loop: Moneo is a Pomodoro timer first. If this breaks, nothing
 * else matters. Covers the exact flow ROADMAP.md flags as untested:
 * mode switching + start/pause, without needing a signed-in session
 * (the timer is fully local-first).
 */
test.describe('focus timer', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
  });

  // The mode switcher is its own `role="tablist"` (aria-label "Timer
  // mode"), separate from the top nav's tablist — both contain a tab
  // literally named "Focus", so scope to this tablist to disambiguate.
  // The duration suffix ("25m") is hidden below the `sm:` breakpoint and,
  // when visible, may or may not have a space before it in the computed
  // accessible name — so match on the mode word as a prefix, nothing more.
  const modeTab = (page: import('@playwright/test').Page, mode: string) =>
    page
      .getByRole('tablist', { name: 'Timer mode' })
      .getByRole('tab', { name: new RegExp(`^${mode}`) });

  test('loads with Focus mode selected and a start control', async ({ page }) => {
    await expect(modeTab(page, 'Focus')).toBeVisible();
    await expect(modeTab(page, 'Focus')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
  });

  test('switches between Focus, Short and Long modes', async ({ page }) => {
    await modeTab(page, 'Short').click();
    await expect(modeTab(page, 'Short')).toHaveAttribute('aria-selected', 'true');

    await modeTab(page, 'Long').click();
    await expect(modeTab(page, 'Long')).toHaveAttribute('aria-selected', 'true');

    await modeTab(page, 'Focus').click();
    await expect(modeTab(page, 'Focus')).toHaveAttribute('aria-selected', 'true');
  });

  test('start flips the control to pause and the clock counts down', async ({ page }) => {
    const startButton = page.getByRole('button', { name: 'Start timer' });
    await startButton.click();
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();

    // The ring's aria-label embeds "mm:ss remaining" and updates as the clock ticks.
    const ring = page.getByRole('img', { name: /remaining/ });
    const before = await ring.getAttribute('aria-label');
    await page.waitForTimeout(2200);
    const after = await ring.getAttribute('aria-label');
    expect(before).not.toBe(after);

    await page.getByRole('button', { name: 'Pause timer' }).click();
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
  });
});
