import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Move tab: pick a ready-made routine, log a set, finish, save — the workout
 * lands in History and creates/ticks the "Workout" habit.
 */
test.describe('move (fitness)', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
  });

  test('plays a routine and saves it with a habit', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.getByRole('tab', { name: 'More', exact: true }).click();
      await page.locator('.mono-more-item', { hasText: 'Move' }).click();
    } else {
      await page.getByRole('tab', { name: 'Move', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Move' })).toBeVisible();

    await page.getByRole('button', { name: 'Yoga', exact: true }).click();
    await expect(page.getByText('Downward dog')).toBeVisible();

    await page.getByRole('button', { name: 'Start Home 20 min, no equipment' }).click();
    const player = page.getByTestId('fit-player');
    await expect(player.getByText('Exercise 1 of 7 · Set 1 of 3')).toBeVisible();
    await player.getByRole('button', { name: 'Set done' }).click();
    await expect(page.getByTestId('fit-rest')).toBeVisible();
    await page.getByRole('button', { name: 'Skip rest' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    const done = page.getByTestId('fit-done');
    await expect(done.getByRole('heading', { name: 'Workout done' })).toBeVisible();
    await done.getByRole('button', { name: 'Save workout' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Workout saved.' })).toBeVisible();
    await expect(page.getByTestId('fit-history').locator('li')).toHaveCount(1);
    await expect(page.getByText('1 workout', { exact: true })).toBeVisible();

    const stored = await page.evaluate(() => ({
      habits: localStorage.getItem('moneo:habits') ?? '',
      workouts: JSON.parse(localStorage.getItem('moneo:workouts') ?? '{"log":[]}').log.length,
    }));
    expect(stored.habits).toContain('Workout');
    expect(stored.workouts).toBe(1);
  });
});
