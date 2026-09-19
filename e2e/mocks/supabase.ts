import type { Page } from '@playwright/test';

/**
 * Mocks the Supabase Auth (GoTrue) REST surface so tests can reach an
 * "authenticated" state without a real/staging Supabase project. Intercepts
 * every call to VITE_SUPABASE_URL/auth/v1/** configured in playwright.config
 * and returns fixture responses shaped like the real API.
 *
 * This is intentionally narrow: only the endpoints the app's authController
 * (src/lib/authController.ts) actually calls — signInWithPassword, the
 * session it persists to localStorage from that response, and signOut.
 * Anything else under auth/v1 gets a harmless 200 so unrelated SDK
 * bookkeeping calls (e.g. settings) don't fail the test.
 */
export const E2E_USER = {
  id: 'e2e-user-0000-0000-0000-000000000000',
  email: 'e2e@example.com',
};

const AUTH_HOST = 'e2e-fake-project.supabase.co';
const ACCESS_TOKEN = 'e2e-fake-access-token';
const REFRESH_TOKEN = 'e2e-fake-refresh-token';

function sessionBody() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: ACCESS_TOKEN,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: REFRESH_TOKEN,
    user: {
      id: E2E_USER.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: E2E_USER.email,
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

export async function mockSupabaseAuth(page: Page): Promise<void> {
  await page.route(`https://${AUTH_HOST}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith('/token')) {
      await route.fulfill({ status: 200, json: sessionBody() });
      return;
    }
    if (url.pathname.endsWith('/logout')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (url.pathname.endsWith('/user')) {
      await route.fulfill({ status: 200, json: sessionBody().user });
      return;
    }
    // Settings/health and anything else the SDK probes on init.
    await route.fulfill({ status: 200, json: {} });
  });
}

/** Fills and submits the sign-in form; resolves once the account dialog shows the authenticated view. */
export async function signInViaUi(page: Page): Promise<void> {
  await page.getByRole('button', { name: /open sync and account/i }).click();
  await page.getByLabel(/email/i).fill(E2E_USER.email);
  await page.getByLabel(/password/i).fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.getByRole('heading', { name: /your account/i }).waitFor();
}
