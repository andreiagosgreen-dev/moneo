import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config (Roadmap Faza 5A — "Playwright E2E on critical flows").
 *
 * Scope is deliberately "mocked E2E", not integration-against-real-backend:
 * Supabase Auth and the account-deletion Worker are intercepted at the
 * network boundary (see e2e/mocks/supabase.ts) rather than hit for real.
 * That needs no staging Supabase project or live secrets, while still
 * exercising the actual browser + real UI + real fetch calls — the layer
 * unit tests (authController.test.ts etc.) don't cover. Once a staging
 * Supabase project exists (Roadmap Faza 3b), these can be pointed at it
 * for a true integration pass instead of mocks.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // CI's first cold run (fresh vite preview, no filesystem/module cache)
  // is measurably slower to first paint than a warm local run. The
  // default 30s test / 5s expect budgets are tuned for the latter and
  // flaked on the former even though nothing was actually broken —
  // widen both rather than let timing noise masquerade as a real failure.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // Fake but well-formed config — every request to these hosts is
      // intercepted by e2e/mocks/supabase.ts, nothing real is ever hit.
      VITE_SUPABASE_URL: 'https://e2e-fake-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-fake-anon-key',
      VITE_LEMONSQUEEZY_STORE_ID: 'e2e-store',
      VITE_LEMONSQUEEZY_CHECKOUT_URL: 'https://e2e-fake-store.lemonsqueezy.com/checkout',
      VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID: 'e2e-monthly-variant',
      VITE_LEMONSQUEEZY_YEARLY_VARIANT_ID: 'e2e-yearly-variant',
    },
  },
});
