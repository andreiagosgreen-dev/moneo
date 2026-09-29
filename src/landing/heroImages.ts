import type { Locale } from '../lib/i18n/types';

/* Real app screenshots in public/landing/<lang>/ (scripts/landing-shots.mjs).
 * Romanian visitors see Romanian UI; everyone else sees English. */

export type ShotLang = 'ro' | 'en';
export type ShotId =
  | 'focus-desktop'
  | 'today-desktop'
  | 'habits-desktop'
  | 'week-desktop'
  | 'focus-phone'
  | 'today-phone'
  | 'habits-phone'
  | 'week-phone'
  | 'growth-phone';

export interface ShotSpec {
  widths: readonly number[];
  /** Intrinsic size of the largest variant — reserves layout space (no CLS). */
  width: number;
  height: number;
}

const DESKTOP: ShotSpec = { widths: [960, 1440], width: 1440, height: 900 };
const PHONE: ShotSpec = { widths: [360, 720], width: 720, height: 1558 };

export const SHOTS: Record<ShotId, ShotSpec> = {
  'focus-desktop': DESKTOP,
  'today-desktop': DESKTOP,
  'habits-desktop': DESKTOP,
  'week-desktop': DESKTOP,
  'focus-phone': PHONE,
  'today-phone': PHONE,
  'habits-phone': PHONE,
  'week-phone': PHONE,
  'growth-phone': PHONE,
};

export type Device = 'laptop' | 'phone';
export type Screen = 'focus' | 'today' | 'habits' | 'week';

/** Screens offered by the hero toggle, per device (only shots that exist). */
export const DEVICE_SCREENS: Record<Device, ReadonlyArray<{ screen: Screen; shot: ShotId }>> = {
  laptop: [
    { screen: 'focus', shot: 'focus-desktop' },
    { screen: 'today', shot: 'today-desktop' },
    { screen: 'habits', shot: 'habits-desktop' },
    { screen: 'week', shot: 'week-desktop' },
  ],
  phone: [
    { screen: 'focus', shot: 'focus-phone' },
    { screen: 'today', shot: 'today-phone' },
    { screen: 'habits', shot: 'habits-phone' },
    { screen: 'week', shot: 'week-phone' },
  ],
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
