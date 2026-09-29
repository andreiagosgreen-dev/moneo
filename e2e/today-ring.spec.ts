import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Today's day ring + task pills: two plan items linked to real tasks
 * (one urgent and overdue, one normal and due in 3 days).
 */
test.describe('Today ring and pills', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(() => {
      if (localStorage.getItem('moneo:tasks')) return;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(new Date());
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '1';
      const todayKey = `${get('year')}-${Number(get('month'))}-${Number(get('day'))}`;
      const now = Date.now();
      // Local noon on a calendar day offset from today (no time-of-day deadline).
      const noon = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        d.setHours(12, 0, 0, 0);
        return d.getTime();
      };
      localStorage.setItem(
        'moneo:projects',
        JSON.stringify([
          {
            id: 'p-ring',
            name: 'Ring project',
            color: '#7aa2f7',
            category: 'work',
            tags: [],
            createdAt: now,
            updatedAt: now,
          },
        ]),
      );
      localStorage.setItem('moneo:selected-project', JSON.stringify('p-ring'));
      const mk = (i: number, title: string, priority: string, dueAt: number) => ({
        id: `t-ring-${i}`,
        projectId: 'p-ring',
        title,
        status: 'pending',
        priority,
        dueAt,
        createdAt: now + i,
        updatedAt: now + i,
      });
      localStorage.setItem(
        'moneo:tasks',
        JSON.stringify([
          mk(0, 'Send the invoice', 'p0', noon(-1)),
          mk(1, 'Read the paper', 'p2', noon(3)),
        ]),
      );
      localStorage.setItem(
        'moneo:ivy-plans',
        JSON.stringify([
          {
            dateKey: todayKey,
            tasks: ['Send the invoice', 'Read the paper'].map((text, i) => ({
              id: `i-ring-${i}`,
              text,
              done: false,
              rank: i + 1,
              taskId: `t-ring-${i}`,
            })),
          },
        ]),
      );
    });
  });

  test('shows pills, updates the ring on tick, no overflow at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Today' }).click();

    await expect(page.getByText('1 day overdue')).toBeVisible();
    await expect(page.getByText('in 3 days')).toBeVisible();
    await expect(page.getByText('Urgent', { exact: true })).toBeVisible();
    await expect(page.getByText('0 of 2 · 0%')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Send the invoice' }).click();
    await expect(page.getByText('1 of 2 · 50%')).toBeVisible();
    await expect(page.locator('.mono-pring').first()).toHaveAttribute(
      'aria-label',
      'Today: 1 of 2 done (50%)',
    );

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });
});
