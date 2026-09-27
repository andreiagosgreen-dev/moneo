import { test, expect, type Page } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * A brand-new visitor (empty browser storage, no account) must see an
 * empty Moneo — no example tasks, projects, goals, habits or history —
 * and Settings must let anyone wipe what they created on this device.
 */

const USER_DATA_KEYS = [
  'moneo:tasks',
  'moneo:projects',
  'moneo:goals',
  'moneo:habits',
  'moneo:ivy-plans',
  'moneo:objectives',
  'moneo:skills',
  'moneo:time-blocks',
  'solanum:history',
];

async function readUserData(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((keys) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      out[k] = raw === null ? null : JSON.parse(raw);
    }
    return out;
  }, USER_DATA_KEYS);
}

function expectEmpty(data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    expect(value === null || (Array.isArray(value) && value.length === 0), key).toBe(true);
  }
}

async function openSettings(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('tab', { name: 'More', exact: true }).click();
    await page
      .locator('.mono-more-item', { hasText: /settings/i })
      .first()
      .click();
  } else {
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  }
}

test.describe('clean first run', () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test('a new visitor starts with no example data', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'Today', exact: true })).toBeVisible();
    expectEmpty(await readUserData(page));

    await page.getByRole('tab', { name: 'Projects', exact: true }).click();
    await expect(page.getByText('No projects created yet.')).toBeVisible();
  });

  test('Settings wipes everything saved on this device', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'Today', exact: true })).toBeVisible();
    await page.evaluate(() => {
      localStorage.setItem(
        'moneo:projects',
        JSON.stringify([
          {
            id: 'p-e2e',
            name: 'Leftover project',
            color: '#3b82f6',
            createdAt: Date.now(),
            archived: false,
          },
        ]),
      );
      localStorage.setItem(
        'solanum:history',
        JSON.stringify([{ id: 's-e2e', at: Date.now(), min: 25 }]),
      );
    });
    await page.reload();
    await page.getByRole('tab', { name: 'Projects', exact: true }).click();
    await expect(page.getByText('Leftover project').first()).toBeVisible();

    await openSettings(page, isMobile);
    await page.getByRole('button', { name: 'Delete all data on this device' }).click();
    await expect(page.getByText('Delete everything on this device?')).toBeVisible();
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Delete everything', exact: true }).click(),
    ]);

    await expect(page.getByRole('tab', { name: 'Today', exact: true })).toBeVisible();
    expectEmpty(await readUserData(page));
    await page.getByRole('tab', { name: 'Projects', exact: true }).click();
    await expect(page.getByText('No projects created yet.')).toBeVisible();
    await expect(page.getByText('Leftover project')).toHaveCount(0);
  });
});
