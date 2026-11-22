import type { FontChoice } from './theme';

/**
 * On-demand loaders for Pro-only Fontsource packs.
 *
 * Core faces (Inter, Literata, Cal Sans, JetBrains Mono) ship with the main
 * bundle so the default stack renders with zero flash. The 11 extra Pro font
 * families stay out of AppRoot.css until an active Pro user selects one.
 */
export type LazyProFont = Exclude<
  FontChoice,
  'default' | 'inter' | 'literata' | 'cal-sans' | 'jetbrains'
>;

export const PRO_FONT_LOADERS: Record<LazyProFont, () => Promise<unknown>> = {
  'source-serif': () =>
    Promise.all([
      import('@fontsource/source-serif-4/400.css'),
      import('@fontsource/source-serif-4/400-italic.css'),
      import('@fontsource/source-serif-4/600.css'),
    ]),
  fraunces: () =>
    Promise.all([
      import('@fontsource/fraunces/400.css'),
      import('@fontsource/fraunces/500.css'),
      import('@fontsource/fraunces/600.css'),
    ]),
  'dm-sans': () =>
    Promise.all([
      import('@fontsource/dm-sans/400.css'),
      import('@fontsource/dm-sans/500.css'),
      import('@fontsource/dm-sans/600.css'),
      import('@fontsource/dm-sans/700.css'),
    ]),
  lora: () =>
    Promise.all([
      import('@fontsource/lora/400.css'),
      import('@fontsource/lora/500.css'),
      import('@fontsource/lora/600.css'),
      import('@fontsource/lora/700.css'),
    ]),
  'ibm-plex': () =>
    Promise.all([
      import('@fontsource/ibm-plex-sans/400.css'),
      import('@fontsource/ibm-plex-sans/500.css'),
      import('@fontsource/ibm-plex-sans/600.css'),
      import('@fontsource/ibm-plex-sans/700.css'),
    ]),
  manrope: () =>
    Promise.all([
      import('@fontsource/manrope/400.css'),
      import('@fontsource/manrope/500.css'),
      import('@fontsource/manrope/600.css'),
      import('@fontsource/manrope/700.css'),
    ]),
  spectral: () =>
    Promise.all([
      import('@fontsource/spectral/400.css'),
      import('@fontsource/spectral/500.css'),
      import('@fontsource/spectral/600.css'),
      import('@fontsource/spectral/700.css'),
    ]),
  outfit: () =>
    Promise.all([
      import('@fontsource/outfit/400.css'),
      import('@fontsource/outfit/500.css'),
      import('@fontsource/outfit/600.css'),
      import('@fontsource/outfit/700.css'),
    ]),
  crimson: () =>
    Promise.all([
      import('@fontsource/crimson-pro/400.css'),
      import('@fontsource/crimson-pro/500.css'),
      import('@fontsource/crimson-pro/600.css'),
      import('@fontsource/crimson-pro/700.css'),
    ]),
  'space-grotesk': () =>
    Promise.all([
      import('@fontsource/space-grotesk/400.css'),
      import('@fontsource/space-grotesk/500.css'),
      import('@fontsource/space-grotesk/600.css'),
      import('@fontsource/space-grotesk/700.css'),
    ]),
  newsreader: () =>
    Promise.all([
      import('@fontsource/newsreader/400.css'),
      import('@fontsource/newsreader/500.css'),
      import('@fontsource/newsreader/600.css'),
      import('@fontsource/newsreader/700.css'),
    ]),
};

export const LAZY_PRO_FONTS = Object.keys(PRO_FONT_LOADERS) as readonly LazyProFont[];

const loaded = new Set<FontChoice>();

function isLazyProFont(font: FontChoice): font is LazyProFont {
  return Object.prototype.hasOwnProperty.call(PRO_FONT_LOADERS, font);
}

/**
 * Loads the Fontsource CSS bundle for a Pro font choice at most once.
 * Safe no-op for core fonts; never rejects.
 */
export async function loadProFont(font: FontChoice): Promise<boolean> {
  if (!isLazyProFont(font) || loaded.has(font)) return false;
  loaded.add(font);
  try {
    await PRO_FONT_LOADERS[font]();
    return true;
  } catch {
    loaded.delete(font);
    return false;
  }
}

/** Test-only helper to clear the in-memory dedupe set. */
export function resetLoadedProFonts(): void {
  loaded.clear();
}
