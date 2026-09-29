import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Quick capture: natural-language tokens in the Today field and Ctrl+K,
 * the inbox at the top of Projects, and inbox triage in the morning ritual.
 */
async function openToday(page: Page): Promise<void> {
  const tab = page.getByRole('tab', { name: 'Today', exact: true });
  await expect(tab).toBeVisible();
  await tab.click();
}

test.describe('Quick add + inbox', () => {
  test('tokens go to the inbox with a toast; plain text stays a Today item', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await openToday(page);

    const field = page.locator('#mono-azi-new');
    await field.fill('Gym tomorrow 7:00 !1 30 min');
    const preview = page.locator('#mono-azi-qa');
    await expect(preview).toContainText('Tomorrow');
    await expect(preview).toContainText('Urgent');
    await expect(preview).toContainText('30m');
    await field.press('Enter');

    await expect(page.locator('.mono-toast.show')).toContainText('Saved for');
    await expect(page.getByRole('checkbox', { name: 'Gym' })).toHaveCount(0);
    await expect(field).toHaveValue('');

    await field.fill('Call mom');
    await field.press('Enter');
    await expect(page.getByRole('checkbox', { name: 'Call mom' })).toBeVisible();

    await page.getByRole('tab', { name: 'Projects', exact: true }).click();
    const inbox = page.getByTestId('inbox');
    await expect(inbox).toContainText('Inbox · 1');
    await expect(inbox).toContainText('Gym');
    await expect(inbox).not.toContainText('Call mom');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('moneo:tasks')!));
    const gym = stored.find((x: { title: string }) => x.title === 'Gym');
    expect(gym).toMatchObject({ projectId: '', priority: 'p0', estimateMin: 30, dueHasTime: true });
  });

  test('Ctrl+K adds a task with the quick syntax', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await openToday(page);
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.type('Read !2');
    await expect(dialog.getByText('Add task: Read')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('checkbox', { name: 'Read' })).toBeVisible();
  });

  test('the morning ritual sorts the inbox first', async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(() => {
      if (localStorage.getItem('moneo:tasks')) return;
      const now = Date.now();
      localStorage.setItem(
        'moneo:tasks',
        JSON.stringify([
          {
            id: 't-inbox-1',
            projectId: '',
            title: 'Renew passport',
            status: 'pending',
            priority: 'p2',
            createdAt: now,
            updatedAt: now,
          },
        ]),
      );
    });
    await page.goto('/');
    await openToday(page);
    await page.getByRole('button', { name: 'Morning ritual', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Empty your inbox');
    await expect(dialog.locator('#mono-triage-title')).toHaveText('Renew passport');
    await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(dialog).toContainText('All sorted.');
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await dialog.getByRole('button', { name: 'Skip today', exact: true }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('checkbox', { name: 'Renew passport' })).toBeVisible();
  });

  test('no horizontal overflow with the inbox at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await skipOnboarding(page);
    await page.goto('/');
    await openToday(page);
    const field = page.locator('#mono-azi-new');
    await field.fill('Write a very long task title for the inbox friday 18:30 !3 1h30');
    await field.press('Enter');
    await page.getByRole('tab', { name: 'Projects', exact: true }).click();
    await expect(page.getByTestId('inbox')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
