import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Focus upgrades: ambient sound picker, zen/fullscreen and the
 * "Estimated · Actual" line for a task with an estimate.
 */
async function seed(page: Page): Promise<void> {
  await skipOnboarding(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('moneo:tasks')) return;
    const now = Date.now();
    localStorage.setItem(
      'moneo:projects',
      JSON.stringify([
        {
          id: 'p-write',
          name: 'Writing',
          color: '#7aa2f7',
          category: 'work',
          tags: [],
          createdAt: now,
          updatedAt: now,
        },
      ]),
    );
    localStorage.setItem(
      'moneo:tasks',
      JSON.stringify([
        {
          id: 't-essay',
          projectId: 'p-write',
          title: 'Draft the essay',
          status: 'pending',
          priority: 'p2',
          createdAt: now,
          updatedAt: now,
          estimateMin: 50,
        },
      ]),
    );
    localStorage.setItem(
      'solanum:history',
      JSON.stringify([{ at: now - 3_600_000, min: 35, projectId: 'p-write', taskId: 't-essay' }]),
    );
  });
  await page.goto('/');
}

test.describe('Focus upgrades', () => {
  test('pick Ocean, start, and toggle zen', async ({ page }) => {
    await seed(page);
    const sound = page.getByRole('button', { name: 'Sound', exact: true });
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: /Choose sound/ }).click();
    const picker = page.getByTestId('ambient-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('radio', { name: 'Brown noise' })).toBeDisabled();
    await picker.getByRole('radio', { name: 'Ocean' }).check();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('moneo:focus-prefs')!));
    expect(prefs.ambient).toEqual([{ id: 'ocean', volume: 0.6 }]);
    expect(prefs.ambientOn).toBe(true);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Full screen', exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.classList.contains('mono-zen') ||
            document.fullscreenElement != null,
        ),
      )
      .toBe(true);
    await expect(page.locator('.atm-aside')).toBeHidden();
    await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('mono-zen')))
      .toBe(false);
  });

  test('estimate vs actual shows for the selected task', async ({ page }) => {
    await seed(page);
    await page.getByText('Area, project, task').click();
    await page.locator('#mono-project').selectOption('p-write');
    await page.locator('#mono-task').selectOption('t-essay');
    await expect(page.getByTestId('focus-estimate')).toHaveText('Estimated 50 min · Actual 35 min');
  });

  test('no horizontal overflow with the sound picker open at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await seed(page);
    await page.getByRole('button', { name: /Choose sound/ }).click();
    await expect(page.getByTestId('ambient-picker')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
