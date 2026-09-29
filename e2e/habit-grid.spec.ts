import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/** Monthly habit grid on Today: two seeded habits with a couple of past check-ins. */
test.describe('Habit month grid', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(() => {
      if (localStorage.getItem('moneo:habits')) return;
      const key = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      };
      const created = Date.now() - 10 * 86_400_000;
      localStorage.setItem(
        'moneo:habits',
        JSON.stringify([
          {
            id: 'h-grid-1',
            name: 'Stretch',
            frequency: 'daily',
            targetPerWeek: 7,
            createdAt: created,
            updatedAt: created,
          },
          {
            id: 'h-grid-2',
            name: 'Call family',
            frequency: 'weekly',
            targetPerWeek: 1,
            createdAt: created + 1,
            updatedAt: created + 1,
          },
        ]),
      );
      localStorage.setItem(
        'moneo:habit-log',
        JSON.stringify({ 'h-grid-1': [key(-2), key(-3)], 'h-grid-2': [key(-4)] }),
      );
    });
  });

  async function openMonth(page: Page) {
    await page.getByRole('tab', { name: 'Today' }).click();
    await page
      .getByRole('group', { name: 'Habit view' })
      .getByRole('button', { name: 'Month' })
      .click();
    await expect(page.getByRole('grid')).toBeVisible();
  }

  test('ticks today in the grid, keeps it after reload, no overflow at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    await openMonth(page);

    const firstRow = page.getByRole('grid').locator('tbody tr').first();
    const todayCell = firstRow.locator('.mono-hcell.is-today');
    const rowPct = firstRow.locator('.mono-hgrid-pct');
    await expect(todayCell).toHaveAttribute('aria-pressed', 'false');
    const before = await rowPct.textContent();

    await todayCell.click();
    await expect(todayCell).toHaveAttribute('aria-pressed', 'true');
    await expect(rowPct).not.toHaveText(before ?? '');

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);

    await page.reload();
    await openMonth(page);
    await expect(
      page.getByRole('grid').locator('tbody tr').first().locator('.mono-hcell.is-today'),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
