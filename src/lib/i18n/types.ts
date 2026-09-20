import type { en } from './locales/en';

export type Locale = 'en' | 'ro' | 'ru' | 'uk' | 'de' | 'it' | 'fr' | 'es';

/** Every key of the source (English) dictionary. Other locales must match it. */
export type TKey = keyof typeof en;

export type Vars = Record<string, string | number>;

/** Minimal translator surface accepted by lib helpers (lifemap, …). */
export type SimpleT = (key: string, vars?: Vars) => string;
