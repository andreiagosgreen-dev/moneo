import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Today's plan and project tasks stay in step: ticking a linked plan item in
 * Today completes the real project task (and finishing the last task earns
 * the project celebration); completing it in Projects ticks it in Today.
 */
async function seed(page: Page, taskTitles: string[]): Promise<void> {
  await skipOnboarding(page);
  await page.addInitScript((titles: string[]) => {
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
    // Only seed once — later reloads must keep what the test changed.
    if (localStorage.getItem('moneo:tasks')) return;
    localStorage.setItem(
      'moneo:projects',
      JSON.stringify([
        {
          id: 'p-e2e',
          name: 'Launch site',
          color: '#7aa2f7',
          category: 'work',
          tags: [],
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );
    localStorage.setItem('moneo:selected-project', JSON.stringify('p-e2e'));
    localStorage.setItem(
      'moneo:tasks',
      JSON.stringify(
        titles.map((title, i) => ({
          id: `t-e2e-${i}`,
          projectId: 'p-e2e',
          title,
          status: 'pending',
          priority: 'p2',
          createdAt: now + i,
          updatedAt: now + i,
        })),
      ),
    );
    localStorage.setItem(
      'moneo:ivy-plans',
      JSON.stringify([
        {
          dateKey: todayKey,
          tasks: titles.map((text, i) => ({
            id: `i-e2e-${i}`,
            text,
            done: false,
            rank: i + 1,
            taskId: `t-e2e-${i}`,
          })),
        },
      ]),
    );
  }, taskTitles);
  await page.goto('/');
}

async function openTab(page: Page, name: 'Today' | 'Projects'): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click();
  if (name === 'Projects') {
    await page.getByRole('button', { name: 'Expand Launch site', exact: true }).click();
  }
}

test.describe('Today ↔ project task sync', () => {
  test('ticking in Today completes the project task and celebrates the project', async ({
    page,
  }) => {
    await seed(page, ['Write copy']);
    await openTab(page, 'Today');
    await page.getByRole('checkbox', { name: 'Write copy' }).click();
    await expect(page.getByRole('checkbox', { name: 'Write copy' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    const card = page.locator('.mono-celebrate');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('Launch site');
    await card.getByRole('button', { name: 'Close' }).click();

    await openTab(page, 'Projects');
    await expect(page.getByText('1/1 task')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark incomplete' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Mark complete' })).toHaveCount(0);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('moneo:tasks')!));
    expect(stored[0].status).toBe('completed');
  });

  test('completing in Projects ticks the item in Today', async ({ page }) => {
    await seed(page, ['Draft outline', 'Publish']);
    await openTab(page, 'Projects');
    await page.getByRole('button', { name: 'Mark complete' }).first().click();

    await openTab(page, 'Today');
    await expect(page.getByRole('checkbox', { name: 'Draft outline' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('checkbox', { name: 'Publish' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
