import type { Dictionary } from '../lib/i18n';
import type { Locale } from '../lib/i18n/types';

/* Loads exactly one locale — unlike lib/i18n, English is not bundled as a
 * fallback, so a visitor downloads a single dictionary before first paint. */
const LOADERS: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('../lib/i18n/locales/en').then((m) => m.en),
  ro: () => import('../lib/i18n/locales/ro').then((m) => m.ro),
  ru: () => import('../lib/i18n/locales/ru').then((m) => m.ru),
  uk: () => import('../lib/i18n/locales/uk').then((m) => m.uk),
  de: () => import('../lib/i18n/locales/de').then((m) => m.de),
  it: () => import('../lib/i18n/locales/it').then((m) => m.it),
  fr: () => import('../lib/i18n/locales/fr').then((m) => m.fr),
  es: () => import('../lib/i18n/locales/es').then((m) => m.es),
};

export async function loadLandingDictionary(locale: Locale): Promise<Dictionary> {
  try {
    return await LOADERS[locale]();
  } catch {
    return LOADERS.en();
  }
}
