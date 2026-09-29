import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/** Last-week summary on Today and the seven-day planner in Schedule. */
test.describe('Week view and last-week summary', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(() => {
      if (localStorage.getItem('solanum:history')) return;
      // Wednesday of last week at local noon (weeks start on Monday).
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 5);
      localStorage.setItem(
        'solanum:history',
        JSON.stringify([{ id: 's-week-1', at: d.getTime(), min: 45 }]),
      );
    });
  });

  test('shows last week once, hides it for good when dismissed', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Today' }).click();

    const recap = page.getByTestId('week-recap');
    await expect(recap).toBeVisible();
    await expect(recap.getByText('How last week went')).toBeVisible();
    await expect(recap.getByText('45m', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: "Hide last week's summary" }).click();
    await expect(recap).toHaveCount(0);

    await page.reload();
    await page.getByRole('tab', { name: 'Today' }).click();
    await expect(page.getByText("Today's plan")).toBeVisible();
    await expect(page.getByTestId('week-recap')).toHaveCount(0);
  });

  test('Schedule shows seven days without page overflow at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Schedule' }).click();

    const week = page.getByRole('region', { name: 'This week' });
    await expect(week).toBeVisible();
    await expect(week.getByRole('listitem')).toHaveCount(7);
    await expect(week.locator('.mono-week-day.is-today')).toHaveCount(1);

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });
});
