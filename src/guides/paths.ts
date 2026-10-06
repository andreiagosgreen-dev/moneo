import type { GuideLocale } from './types';

/* Paths only, no guide text: the landing imports this for its footer link. */

export const GUIDE_LOCALES: readonly GuideLocale[] = ['en', 'ro', 'ru'];

/** Section root per language; the service worker must not intercept these. */
export const GUIDE_BASE: Record<GuideLocale, string> = {
  en: '/guides',
  ro: '/ro/ghiduri',
  ru: '/ru/stati',
};

export function hasGuides(locale: string): locale is GuideLocale {
  return (GUIDE_LOCALES as readonly string[]).includes(locale);
}

export function guidePath(locale: GuideLocale, slug: string): string {
  return `${GUIDE_BASE[locale]}/${slug}`;
}
