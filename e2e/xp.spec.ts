import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * XP & ranks: XP is derived from stored work, and a level the user hasn't
 * seen yet celebrates once through the same calm layer as other moments.
 * Three 50-minute sessions = 150 XP = level 2 ("Beginner II").
 */
test.describe('xp & ranks', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(() => {
      if (localStorage.getItem('e2e:xp-seeded')) return;
      localStorage.setItem('e2e:xp-seeded', '1');
      const day = 86_400_000;
      const now = Date.now();
      localStorage.setItem(
        'solanum:history',
        JSON.stringify([1, 2, 3].map((k) => ({ at: now - k * day, min: 50 }))),
      );
      localStorage.setItem('moneo:xp-seen', JSON.stringify({ level: 1 }));
    });
  });

  test('a new level celebrates once and shows in Growth', async ({ page, isMobile }) => {
    await page.goto('/');
    const card = page.locator('.mono-celebrate');
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('Level up');
    await expect(card).toContainText('Beginner II');
    await card.getByRole('button', { name: 'Close' }).click();
    await expect(card).toHaveCount(0);

    if (isMobile) {
      await page.getByRole('tab', { name: 'More', exact: true }).click();
      await page.locator('.mono-more-item', { hasText: 'Growth' }).click();
    } else {
      await page.getByRole('tab', { name: 'Growth', exact: true }).click();
    }
    const rank = page.getByTestId('rank-card');
    await expect(rank).toContainText('Beginner II');
    await expect(rank).toContainText('150 XP in total');

    await page.reload();
    await expect(page.locator('.atm-time').first()).toBeVisible();
    // Give the level check a beat to (not) fire — it already celebrated level 2.
    await page.waitForTimeout(800);
    await expect(page.locator('.mono-celebrate')).toHaveCount(0);
  });
});
