import { test, expect } from '@playwright/test';
import { mockSupabaseAuth, signInViaUi } from './mocks/supabase';

/**
 * Covers the P0 fixed in the 2026-09-17 audit: "Delete account" used to
 * only sign the user out, leaving the Auth user and most cloud rows intact.
 * The real fix lives server-side (cloudflare/workers/account.ts calls
 * auth.admin.deleteUser); this test only proves the UI wires up correctly
 * to that endpoint and reacts to both outcomes.
 */
test.beforeEach(async ({ page }) => {
  await mockSupabaseAuth(page);
  await page.goto('/');
  await signInViaUi(page);
});

test('requires an explicit confirmation step before deleting', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete account' }).click();
  await expect(page.getByText('Delete your account?')).toBeVisible();
  await expect(page.getByText(/permanently deletes your account/i)).toBeVisible();

  // Backing out must not call the delete endpoint at all.
  let deleteCalled = false;
  await page.route('**/api/account/delete', (route) => {
    deleteCalled = true;
    return route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Delete your account?')).toBeHidden();
  expect(deleteCalled).toBe(false);
});

test('confirmed deletion calls the server wipe endpoint with the bearer token, then signs out', async ({
  page,
}) => {
  let authHeader: string | null = null;
  await page.route('**/api/account/delete', async (route) => {
    authHeader = await route.request().headerValue('authorization');
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByRole('button', { name: 'Delete account' }).click(); // the confirm button, now the only match

  // Server confirmed the wipe -> dialog closes and the app reflects signed-out state.
  await expect(page.getByRole('heading', { name: /your account/i })).toBeHidden();
  await expect(page.getByRole('button', { name: /open sync and account/i })).toBeVisible();
  expect(authHeader).toMatch(/^Bearer /);
});

test('a failed server wipe keeps the user signed in and shows an error, never deleting local data silently', async ({
  page,
}) => {
  await page.route('**/api/account/delete', (route) => route.fulfill({ status: 500 }));

  await page.getByRole('button', { name: 'Delete account' }).click();
  await page.getByRole('button', { name: 'Delete account' }).click();

  await expect(page.getByRole('alert')).toContainText(/could not delete/i);
  // Still authenticated — the account dialog must not have closed.
  await expect(page.getByRole('heading', { name: /your account/i })).toBeVisible();
});
