import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import { en } from './locales/en';
import type { Locale, TKey, Vars } from './types';

export type { Locale, TKey, Vars };
export { en } from './locales/en';

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

/** A translation dictionary keyed by the canonical English key set. */
export type Dictionary = Record<TKey, string>;

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

/** Load a locale dictionary on demand. English is bundled synchronously;
 * other locales are fetched as separate chunks. */
export async function loadDictionary(locale: Locale): Promise<Dictionary> {
  try {
    switch (locale) {
      case 'en':
        return en;
      case 'ro':
        return (await import('./locales/ro')).ro;
      case 'ru':
        return (await import('./locales/ru')).ru;
      case 'uk':
        return (await import('./locales/uk')).uk;
      case 'de':
        return (await import('./locales/de')).de;
      case 'it':
        return (await import('./locales/it')).it;
      case 'fr':
        return (await import('./locales/fr')).fr;
      case 'es':
        return (await import('./locales/es')).es;
    }
  } catch {
    /* keep English fallback */
  }
  return en;
}

function interp(template: string, vars?: Vars): string {
  if (!vars) return template;
  let out = template;
  for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}

export interface I18n {
  locale: Locale;
  tag: string;
  /** Plain lookup with English fallback, then the key itself. */
  t: (key: TKey, vars?: Vars) => string;
  /**
   * Plural lookup: tries `${key}.${category}` from Intl.PluralRules,
   * falls back to `${key}.other`, then English. `{n}` is always available.
   */
  tp: (key: string, count: number, vars?: Vars) => string;
  /** Locale-aware short duration: 25m · 1h · 2h 15m (units per locale). */
  fmtDur: (min: number) => string;
  /** Locale-aware wall-clock: 12h for en, 24h otherwise. */
  fmtClock: (min: number) => string;
  /** Locale-aware short date for a "YYYY-M-D" day key. */
  fmtDayKey: (key: string) => string;
  fmtNum: (n: number) => string;
}

export function createI18n(locale: Locale, dictionary: Dictionary = en): I18n {
  const d = dictionary as Record<string, string>;
  const e = en as Record<string, string>;
  const tag = LOCALES.find((l) => l.id === locale)?.tag ?? 'en-US';

  const t = (key: TKey, vars?: Vars): string => interp(d[key] ?? e[key] ?? key, vars);

  const tp = (key: string, count: number, vars?: Vars): string => {
    let cat = 'other';
    try {
      cat = new Intl.PluralRules(tag).select(count);
    } catch {
      /* keep 'other' */
    }
    const hit =
      d[`${key}.${cat}`] ?? d[`${key}.other`] ?? e[`${key}.${cat}`] ?? e[`${key}.other`] ?? key;
    return interp(hit, { ...(vars ?? {}), n: count });
  };

  const fmtDur = (min: number): string => {
    const m = Math.max(0, Math.round(min));
    const h = t('fmt.h');
    const mm = t('fmt.m');
    if (m < 60) return `${m}${mm}`;
    const hh = Math.floor(m / 60);
    const rest = m % 60;
    return rest === 0 ? `${hh}${h}` : `${hh}${h} ${rest}${mm}`;
  };

  const fmtClock = (min: number): string => {
    const h = Math.floor(min / 60) % 24;
    const m = ((min % 60) + 60) % 60;
    const at = new Date(2000, 0, 1, h, m);
    try {
      return new Intl.DateTimeFormat(
        tag,
        locale === 'en'
          ? { hour: 'numeric', minute: '2-digit' }
          : { hour: '2-digit', minute: '2-digit', hour12: false },
      ).format(at);
    } catch {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  };

  const fmtDayKey = (key: string): string => {
    const parts = key.split('-').map(Number);
    if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return key;
    try {
      return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }).format(
        new Date(parts[0], parts[1] - 1, parts[2]),
      );
    } catch {
      return key;
    }
  };

  const fmtNum = (n: number): string => {
    try {
      return new Intl.NumberFormat(tag).format(n);
    } catch {
      return String(n);
    }
  };

  return { locale, tag, t, tp, fmtDur, fmtClock, fmtDayKey, fmtNum };
}
