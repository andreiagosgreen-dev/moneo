import { defineConfig } from '@playwright/test';

/**
 * Marketing screen recordings (not tests): plays the app like a person on a
 * 9:16 phone screen and records each clip. Run by
 * .github/workflows/marketing-clips.yml; `scripts/collect-clips.mjs` turns
 * the recordings into MP4 files.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.rec.ts',
  outputDir: '../../test-results/clips',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // 360×640 CSS px at 3× = 1080×1920 frames, the size short videos use.
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    actionTimeout: 20_000,
  },
  webServer: {
    command: 'npm run dev',
    cwd: '../..',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
