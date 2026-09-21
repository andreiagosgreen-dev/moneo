import type { Page } from '@playwright/test';

/** Marks first-run onboarding as seen so it never blocks a fresh test session. */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('moneo:onboarding-seen', JSON.stringify(true));
  });
}
