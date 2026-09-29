import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Flexible repeat rules + morning "Suggestions for today": an overdue monthly
 * task and a carried-over item are triaged one card at a time; completing a
 * weekdays task spawns the next weekday.
 */
async function seed(page: Page): Promise<void> {
  await skipOnboarding(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('moneo:tasks')) return;
    const now = Date.now();
    const d = new Date();
    const todayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const yesterday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12).getTime();
    const project = (id: string, name: string) => ({
      id,
      name,
      color: '#7aa2f7',
      category: 'work',
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
    localStorage.setItem(
      'moneo:projects',
      JSON.stringify([project('p-home', 'Home'), project('p-work', 'Work')]),
    );
    localStorage.setItem(
      'moneo:tasks',
      JSON.stringify([
        {
          id: 't-rent',
          projectId: 'p-home',
          title: 'Pay rent',
          status: 'pending',
          priority: 'p1',
          createdAt: now,
          updatedAt: now,
          dueAt: yesterday,
          recurrence: 'weekly',
          repeat: { kind: 'months', every: 1, day: 31 },
        },
        {
          id: 't-standup',
          projectId: 'p-work',
          title: 'Stand-up notes',
          status: 'pending',
          priority: 'p2',
          createdAt: now,
          updatedAt: now,
          recurrence: 'daily',
          repeat: { kind: 'weekdays' },
        },
      ]),
    );
    localStorage.setItem(
      'moneo:ivy-plans',
      JSON.stringify([
        {
          dateKey: todayKey,
          tasks: [{ id: 'c1', text: 'Call the plumber', done: false, rank: 1, carried: true }],
        },
      ]),
    );
  });
  await page.goto('/');
}

test.describe('Recurrence + suggestions for today', () => {
  test('triage overdue and carried items, then repeat a weekdays task', async ({ page }) => {
    await seed(page);
    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Move Call the plumber to tomorrow' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Morning ritual', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Suggestions for today');
    await expect(dialog).toContainText('Overdue');
    await expect(dialog.locator('#mono-triage-title')).toHaveText('Pay rent');
    await dialog.getByRole('button', { name: 'Tomorrow', exact: true }).click();

    await expect(dialog).toContainText('Left from yesterday');
    await expect(dialog.locator('#mono-triage-title')).toHaveText('Call the plumber');
    await dialog.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(dialog).toContainText('All sorted.');
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await dialog.getByRole('button', { name: 'Skip today', exact: true }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('checkbox', { name: 'Call the plumber' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Pay rent' })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Move Call the plumber to tomorrow' }),
    ).toHaveCount(0);

    const rent = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('moneo:tasks')!).find(
        (x: { id: string }) => x.id === 't-rent',
      ),
    );
    const tomorrow = await page.evaluate(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12).getTime();
    });
    expect(rent.dueAt).toBe(tomorrow);

    await page.getByRole('tab', { name: 'Projects', exact: true }).click();
    await page.getByRole('button', { name: 'Expand Work', exact: true }).click();
    await page.getByRole('button', { name: 'Mark complete' }).first().click();

    const result = await page.evaluate(() => {
      const tasks = JSON.parse(localStorage.getItem('moneo:tasks')!) as Array<{
        title: string;
        status: string;
        dueAt?: number;
      }>;
      const next = tasks.find((x) => x.title === 'Stand-up notes' && x.status === 'pending');
      const d = new Date();
      const expected = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
      while (expected.getDay() === 0 || expected.getDay() === 6) {
        expected.setDate(expected.getDate() + 1);
      }
      return { dueAt: next?.dueAt, expected: expected.getTime() };
    });
    expect(result.dueAt).toBe(result.expected);
  });

  test('the repeat picker sets a rule and the badge summarises it', async ({ page }) => {
    await seed(page);
    await page.getByRole('tab', { name: 'Projects', exact: true }).click();
    await page.getByRole('button', { name: 'Expand Home', exact: true }).click();
    await expect(page.getByText('↻ Monthly on day 31').first()).toBeVisible();
    await page.getByRole('button', { name: 'Show details for Pay rent' }).click();
    const picker = page.getByTestId('repeat-picker');
    await picker.getByRole('combobox', { name: 'Repeat' }).selectOption('everyDays');
    await picker.getByRole('spinbutton').fill('3');
    await expect(picker).toContainText('↻ Every 3 days');
    const rule = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('moneo:tasks')!).find(
          (x: { id: string }) => x.id === 't-rent',
        ).repeat,
    );
    expect(rule).toEqual({ kind: 'days', every: 3 });
  });
});
