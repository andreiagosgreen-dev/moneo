import type { Page } from '@playwright/test';

/**
 * Marks first-run onboarding as seen, and the Morning ritual as already
 * shown for today, so neither blocks a fresh test session. Without the
 * ritual seed, `usePlannerState`'s auto-open effect (fires once per day,
 * before noon local time) pops a modal that intercepts every click —
 * tests only failed when CI happened to run before noon UTC, so this was
 * a real source of flakiness, not a one-off.
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('moneo:onboarding-seen', JSON.stringify(true));
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '1';
    const todayKey = `${get('year')}-${Number(get('month'))}-${Number(get('day'))}`;
    localStorage.setItem('moneo:ritual-day', JSON.stringify(todayKey));
  });
}
