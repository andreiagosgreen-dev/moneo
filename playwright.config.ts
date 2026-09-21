import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config (ROADMAP.md Etapa 2). Runs against the real Vite dev server —
 * no mocked backend, so tests cover what's actually reachable without a
 * live Supabase/Lemon Squeezy session: the local-first app shell, public
 * routes, and Free-tier gating. Auth/checkout completion needs live
 * credentials and stays a manual pre-launch step (see ROADMAP.md).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  // Vite's dev server compiles routes/modules on first request — a cold
  // CI run can take longer than the 5s default to render the first paint.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
