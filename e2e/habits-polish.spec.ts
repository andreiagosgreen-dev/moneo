import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Habits polish: a broken 5-day streak saved with a freeze, vacation mode
 * with the Today banner, and no auto-opened morning ritual on a vacation day.
 */
async function seedHabit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (localStorage.getItem('moneo:habits')) return;
    const d = new Date();
    const key = (n: number) => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, 12);
      return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
    };
    localStorage.setItem(
      'moneo:habits',
      JSON.stringify([
        {
          id: 'h-read',
          name: 'Read',
          frequency: 'daily',
          targetPerWeek: 7,
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );
    localStorage.setItem(
      'moneo:habit-log',
      JSON.stringify({ 'h-read': [key(2), key(3), key(4), key(5), key(6)] }),
    );
  });
}

/** App boot at 09:00 local without the ritual-day seed; `vacation` marks today..+2 off. */
async function morningBoot(page: Page, vacation: boolean): Promise<void> {
  const now = new Date();
  await page.clock.install({
    time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
  });
  await page.addInitScript((onVacation: boolean) => {
    localStorage.setItem('moneo:landing-seen', JSON.stringify(true));
    localStorage.setItem('moneo:onboarding-seen', JSON.stringify(true));
    if (!onVacation) return;
    const d = new Date();
    const key = (n: number) => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
      return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
    };
    localStorage.setItem('moneo:time-off', JSON.stringify([key(0), key(1), key(2)]));
  }, vacation);
  await page.goto('/');
}

test.describe('Habits polish', () => {
  test('save a broken streak with a freeze', async ({ page }) => {
    await skipOnboarding(page);
    await seedHabit(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Manage habits', exact: true }).click();
    await page.getByRole('button', { name: 'Save the streak', exact: true }).click();
    await expect(page.getByText('Streak saved', { exact: true })).toBeVisible();
    await expect(page.getByText('5 days in a row').first()).toBeVisible();
    const frozen = await page.evaluate(
      () => JSON.parse(localStorage.getItem('moneo:habits')!)[0].frozen as string[],
    );
    expect(frozen).toHaveLength(1);
  });

  test('start a vacation and see the Today banner', async ({ page }) => {
    await skipOnboarding(page);
    await seedHabit(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Manage habits', exact: true }).click();
    const card = page.getByTestId('vacation');
    await card.getByRole('button', { name: 'Start vacation', exact: true }).click();
    await expect(page.getByTestId('vacation-banner')).toContainText("You're on vacation until");
    const off = await page.evaluate(
      () => JSON.parse(localStorage.getItem('moneo:time-off')!) as string[],
    );
    expect(off).toHaveLength(4);
    await page.getByTestId('vacation-banner').getByRole('button').click();
    await expect(page.getByTestId('vacation-banner')).toHaveCount(0);
  });

  test('the morning ritual opens on a normal morning', async ({ page }) => {
    await morningBoot(page, false);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('the morning ritual stays closed on a vacation morning', async ({ page }) => {
    await morningBoot(page, true);
    await expect(page.getByTestId('vacation-banner')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
