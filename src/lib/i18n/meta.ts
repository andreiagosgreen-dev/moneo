import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import type { Locale } from './types';

/* Locale metadata + saved choice. Kept free of any dictionary import so light
 * entry points (the public landing page) can use it without bundling `en`. */

export const LOCALES: Array<{ id: Locale; native: string; tag: string }> = [
  { id: 'en', native: 'English', tag: 'en-US' },
  { id: 'ro', native: 'Română', tag: 'ro-RO' },
  { id: 'ru', native: 'Русский', tag: 'ru-RU' },
  { id: 'uk', native: 'Українська', tag: 'uk-UA' },
  { id: 'de', native: 'Deutsch', tag: 'de-DE' },
  { id: 'it', native: 'Italiano', tag: 'it-IT' },
  { id: 'fr', native: 'Français', tag: 'fr-FR' },
  { id: 'es', native: 'Español', tag: 'es-ES' },
];

export function isLocale(v: unknown): v is Locale {
  return (
    typeof v === 'string' &&
    (v === 'en' ||
      v === 'ro' ||
      v === 'ru' ||
      v === 'uk' ||
      v === 'de' ||
      v === 'it' ||
      v === 'fr' ||
      v === 'es')
  );
}

const NAVIGATOR_LOCALE_MAP: Record<string, Locale> = {
  en: 'en',
  ro: 'ro',
  ru: 'ru',
  uk: 'uk',
  de: 'de',
  it: 'it',
  fr: 'fr',
  es: 'es',
};

function detectNavigatorLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null;
  const tag = (navigator.language ?? '').toLowerCase();
  if (!tag) return null;
  // Prefer exact tag (e.g. "ro-ro" -> "ro"), then two-letter prefix.
  const exact = NAVIGATOR_LOCALE_MAP[tag];
  if (exact) return exact;
  const prefix = tag.split('-')[0];
  if (!prefix) return null;
  return NAVIGATOR_LOCALE_MAP[prefix] ?? null;
}

/** Saved choice, local only (never synced — see Faza 5 spec).
 * Falls back to the browser language when there is no saved preference. */
export function loadLocale(): Locale {
  const stored = read<unknown>(STORAGE_KEYS.locale);
  if (isLocale(stored)) return stored;
  return detectNavigatorLocale() ?? 'en';
}

export function saveLocale(locale: Locale): boolean {
  return write(STORAGE_KEYS.locale, locale);
}
