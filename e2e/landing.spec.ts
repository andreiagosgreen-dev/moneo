import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * The landing page greets only first-time visitors on `/` (no Moneo data on
 * this device, not signed in). Anyone with data goes straight to the app,
 * deep links are never intercepted, and `/welcome` always shows the page.
 */

const landingHeading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Focus, plan and grow — day by day.' });

const todayTab = (page: Page) => page.getByRole('tab', { name: 'Today', exact: true });

test.describe('landing page', () => {
  test('a fresh visitor sees the landing, starts free and lands in the app', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await expect(landingHeading(page)).toBeVisible();
    await expect(page).toHaveTitle(/Moneo/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    await page.getByRole('main').getByRole('button', { name: 'Start free' }).first().click();
    await expect(todayTab(page)).toBeVisible();
    await expect(landingHeading(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('moneo:landing-seen'))).toBe('true');

    await page.reload();
    await expect(todayTab(page)).toBeVisible();
    await expect(landingHeading(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a returning visitor with saved data goes straight to the app', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'solanum:history',
        JSON.stringify([{ id: 's-e2e', at: Date.now() - 86_400_000, min: 25 }]),
      );
    });
    await page.goto('/');
    await expect(page.locator('.mono-nav')).toBeAttached();
    await expect(landingHeading(page)).toHaveCount(0);
  });

  test('deep links are never intercepted for a fresh visitor', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /pricing/i })).toBeVisible();
    await expect(landingHeading(page)).toHaveCount(0);

    await page.goto('/?action=focus');
    await expect(page.locator('.mono-nav')).toBeAttached();
    await expect(landingHeading(page)).toHaveCount(0);
  });

  test('/welcome always shows the landing, and Start returns to the app', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/welcome');
    await expect(landingHeading(page)).toBeVisible();

    await page.getByRole('main').getByRole('button', { name: 'Start free' }).first().click();
    await expect(page).toHaveURL('/');
    await expect(todayTab(page)).toBeVisible();
  });
});
