import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import { en } from './locales/en';
import type { Locale, TKey, Vars } from './types';

export type { Locale, TKey, Vars };

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

/**
 * Only `en` is bundled at boot — it doubles as the fallback dictionary, so
 * it can never be lazily missing. The other 7 locales (~190 kB of source
 * strings) are fetched on demand via `preloadLocale`, keeping them out of
 * the main chunk for everyone who isn't actively using that language.
 */
const DICTS: Partial<Record<Locale, Record<TKey, string>>> = { en };

/**
 * One loader per lazy locale (everything but `en`), instead of a templated
 * `import(`./locales/${locale}.ts`)`. A templated path makes Vite treat
 * every file matching the glob — including the statically-imported `en.ts`
 * above — as a possible dynamic-import target, which produces a spurious
 * "both static and dynamic import" build warning. Explicit loaders avoid
 * that ambiguity entirely.
 */
const LAZY_LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ [k: string]: Record<TKey, string> }>> = {
  ro: () => import('./locales/ro'),
  ru: () => import('./locales/ru'),
  uk: () => import('./locales/uk'),
  de: () => import('./locales/de'),
  it: () => import('./locales/it'),
  fr: () => import('./locales/fr'),
  es: () => import('./locales/es'),
};

/**
 * Fetches and caches a locale's dictionary. No-op for `en` (always resident)
 * or an already-loaded locale. Callers await this before switching `locale`
 * state (LocaleContext) or before the first render (main.tsx bootstrap) so
 * `createI18n` never has to fall back to English for a locale the user
 * actually chose. Failure leaves the cache untouched — `createI18n` then
 * falls back to `en` until a later call succeeds.
 */
export async function preloadLocale(locale: Locale): Promise<void> {
  if (locale === 'en' || DICTS[locale]) return;
  try {
    const mod = await LAZY_LOADERS[locale]();
    DICTS[locale] = mod[locale];
  } catch {
    /* keep the en fallback; a later preload attempt can retry */
  }
}

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

/** Saved choice, local only (never synced — see Faza 5 spec). */
export function loadLocale(): Locale {
  const stored = read<unknown>(STORAGE_KEYS.locale);
  return isLocale(stored) ? stored : 'en';
}

export function saveLocale(locale: Locale): boolean {
  return write(STORAGE_KEYS.locale, locale);
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

export function createI18n(locale: Locale): I18n {
  const dict = DICTS[locale] ?? en;
  const d = dict as Record<string, string>;
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
