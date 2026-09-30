import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

async function openMove(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('tab', { name: 'More', exact: true }).click();
    await page.locator('.mono-more-item', { hasText: 'Move' }).click();
  } else {
    await page.getByRole('tab', { name: 'Move', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Move' })).toBeVisible();
}

/**
 * Move tab: pick a ready-made routine, log a set, finish, save — the workout
 * lands in History and creates/ticks the "Workout" habit. The library filters
 * by place/type/muscle, opens an exercise, and routines can be scheduled.
 */
test.describe('move (fitness)', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
  });

  test('plays a routine and saves it with a habit', async ({ page, isMobile }) => {
    await openMove(page, isMobile);

    await page.getByRole('button', { name: 'Yoga', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open Downward dog' })).toBeVisible();

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

    const quads = page.locator('.mono-bmap [role="button"][data-muscle="quads"]');
    await expect(quads).toHaveAttribute('data-lv', '3');
  });

  test('filters the library, opens an exercise, schedules a routine for today', async ({
    page,
    isMobile,
  }) => {
    await openMove(page, isMobile);

    await page.getByRole('button', { name: 'Gym', exact: true }).click();
    await expect(page.getByTestId('fit-rt-gymFull')).toBeVisible();
    await expect(page.getByTestId('fit-rt-home20')).toHaveCount(0);
    await page.getByRole('button', { name: 'Anywhere', exact: true }).click();

    await page.getByRole('searchbox', { name: 'Search exercises' }).fill('push-up');
    await page.getByRole('button', { name: 'Open Push-up' }).click();
    const detail = page.getByTestId('fit-detail');
    await expect(detail.getByRole('heading', { name: 'Push-up', level: 2 })).toBeVisible();
    await expect(detail.getByText('Common mistake:')).toBeVisible();
    await expect(detail.locator('[data-muscle="chest"]')).toHaveAttribute('data-lv', '3');
    await detail.getByRole('button', { name: /Back to the library/ }).click();
    await expect(page.getByTestId('fit-detail')).toHaveCount(0);

    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    await page.getByRole('button', { name: 'Schedule Home 20 min, no equipment' }).click();
    const card = page.getByTestId('fit-rt-home20');
    await card.getByRole('button', { name: today, exact: true }).click();
    await expect(card.getByText(`Scheduled: ${today}`)).toBeVisible();

    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    const move = page.getByTestId('move-today');
    await expect(move.getByText('Today: Home 20 min, no equipment')).toBeVisible();
    await page.getByRole('button', { name: 'Start Home 20 min, no equipment' }).click();
    await expect(page.getByTestId('fit-player')).toBeVisible();
  });
});
