import type { Locale } from '../lib/i18n/types';

/* Real app screenshots in public/landing/<lang>/ (scripts/landing-shots.mjs).
 * Romanian visitors see Romanian UI; everyone else sees English. */

export type ShotLang = 'ro' | 'en';
export type ShotId = 'focus-desktop' | 'focus-phone' | 'today-phone' | 'growth-phone';

export interface ShotSpec {
  widths: readonly number[];
  /** Intrinsic size of the largest variant — reserves layout space (no CLS). */
  width: number;
  height: number;
}

export const SHOTS: Record<ShotId, ShotSpec> = {
  'focus-desktop': { widths: [960, 1440], width: 1440, height: 900 },
  'focus-phone': { widths: [360, 720], width: 720, height: 1558 },
  'today-phone': { widths: [360, 720], width: 720, height: 1558 },
  'growth-phone': { widths: [360, 720], width: 720, height: 1558 },
};

export const HERO_DESKTOP_MEDIA = '(min-width: 768px)';
export const HERO_DESKTOP_SIZES = '(min-width: 1200px) 720px, 60vw';
export const PHONE_SIZES = '(min-width: 768px) 300px, 72vw';

export function shotLang(locale: Locale): ShotLang {
  return locale === 'ro' ? 'ro' : 'en';
}

export function shotSrc(lang: ShotLang, id: ShotId, width: number, ext: 'avif' | 'webp'): string {
  return `/landing/${lang}/${id}-${width}.${ext}`;
}

export function shotSrcSet(lang: ShotLang, id: ShotId, ext: 'avif' | 'webp'): string {
  return SHOTS[id].widths.map((w) => `${shotSrc(lang, id, w, ext)} ${w}w`).join(', ');
}

/** Starts the hero image download before the landing chunk has loaded. */
export function preloadLandingHero(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const lang = shotLang(locale);
  const add = (id: ShotId, sizes: string, media: string) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.type = 'image/avif';
    link.setAttribute('imagesrcset', shotSrcSet(lang, id, 'avif'));
    link.setAttribute('imagesizes', sizes);
    link.media = media;
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
  };
  add('focus-desktop', HERO_DESKTOP_SIZES, HERO_DESKTOP_MEDIA);
  add('focus-phone', PHONE_SIZES, '(max-width: 767.98px)');
}
