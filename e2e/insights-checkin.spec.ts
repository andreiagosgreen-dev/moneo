import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/** Daily energy + mood on Today and the insights block in Reports. */
test.describe('Daily check-in and report insights', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(() => {
      if (localStorage.getItem('solanum:history')) return;
      // One morning session in each of the last six complete weeks.
      const sessions = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setHours(10, 0, 0, 0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 5 - i * 7);
        return { id: `s-ins-${i}`, at: d.getTime(), min: 30 + i * 10 };
      });
      localStorage.setItem('solanum:history', JSON.stringify(sessions));
    });
  });

  test('energy then mood on Today, kept after reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Today', exact: true }).click();

    const checkin = page.getByRole('region', { name: 'How are you today?' });
    await checkin.getByRole('radio', { name: 'Energy 4 of 5' }).click();
    await checkin.getByRole('radio', { name: 'Mood 5 of 5' }).click();
    await expect(checkin.getByTestId('checkin-summary')).toHaveText(/Energy 4\/5 · Mood 5\/5/);

    await page.reload();
    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'How are you today?' }).getByTestId('checkin-summary'),
    ).toHaveText(/Energy 4\/5 · Mood 5\/5/);
  });

  test('Reports on Free shows one insight and the Pro teaser', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reports' }).first()).toBeVisible();

    const insights = page.getByTestId('report-insights');
    await expect(insights.getByText('What your data says')).toBeVisible();
    await expect(insights.getByText('Strongest habit')).toBeVisible();
    await expect(insights.getByText(/more insights? with Pro/)).toBeVisible();
    await expect(insights.getByRole('link', { name: 'See Pro' })).toHaveAttribute(
      'href',
      '/pricing',
    );
    await expect(insights.getByText('Best and hardest week')).toHaveCount(0);
  });
});
