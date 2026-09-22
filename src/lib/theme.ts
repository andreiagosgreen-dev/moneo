/* Premium Polish (Week 10) — appearance: theme, accent, fonts. */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';

/**
 * Appearance system. Deterministic and additive:
 * - `data-theme` on <html> toggles the light/dark token palette (CSS).
 * - `data-accent` on the mode wrapper overrides per-mode accent colors.
 * - `data-font` / `data-font-scale` on <html> swap families + base size.
 * Custom accents are applied via CSS attribute selectors (kept after the
 * mode rules so a chosen accent always wins over mode defaults).
 *
 * Pro fonts set `--mono-font-display` / `--mono-font-body` via `data-font`
 * (see mono/pro-fonts.css) without touching atmosphere color tokens.
 */

export type ThemeName = 'dark' | 'light';
export type AccentName = 'auto' | 'tomato' | 'mint' | 'sky' | 'violet' | 'amber' | 'rose';
/** App default stack (Literata + Inter). Everything else is Pro-gated. */
export type FontChoice =
  | 'default'
  | 'inter'
  | 'literata'
  | 'source-serif'
  | 'cal-sans'
  | 'jetbrains'
  | 'fraunces'
  | 'dm-sans';
export type FontScale = 'normal' | 'comfort' | 'compact';

export interface UITheme {
  theme: ThemeName;
  accent: AccentName;
  font: FontChoice;
  fontScale: FontScale;
}

export const DEFAULT_THEME: UITheme = {
  theme: 'light',
  accent: 'auto',
  font: 'default',
  fontScale: 'normal',
};

/** Custom accent palette; `auto` keeps the per-mode colors. */
export const ACCENT_PRESETS: Record<
  Exclude<AccentName, 'auto'>,
  { accent: string; deep: string; rgb: string; on: string }
> = {
  tomato: { accent: '#f07167', deep: '#d65448', rgb: '240, 113, 103', on: '#200b08' },
  mint: { accent: '#3ecf8e', deep: '#27a56e', rgb: '62, 207, 142', on: '#04170e' },
  sky: { accent: '#7aa5ff', deep: '#4f7dd6', rgb: '122, 165, 255', on: '#0a1226' },
  violet: { accent: '#a78bfa', deep: '#7c5ce8', rgb: '167, 139, 250', on: '#110a24' },
  amber: { accent: '#f5a524', deep: '#cf850a', rgb: '245, 165, 36', on: '#1c1204' },
  rose: { accent: '#f483b8', deep: '#d65696', rgb: '244, 131, 184', on: '#200a14' },
};

export const THEME_OPTIONS: ThemeName[] = ['dark', 'light'];
export const FONT_OPTIONS: FontChoice[] = [
  'default',
  'inter',
  'literata',
  'source-serif',
  'cal-sans',
  'jetbrains',
  'fraunces',
  'dm-sans',
];
export const FONT_SCALE_OPTIONS: FontScale[] = ['normal', 'comfort', 'compact'];

const THEMES: ThemeName[] = ['dark', 'light'];
const ACCENTS: AccentName[] = ['auto', 'tomato', 'mint', 'sky', 'violet', 'amber', 'rose'];
const FONTS: FontChoice[] = FONT_OPTIONS;
const SCALES: FontScale[] = ['normal', 'comfort', 'compact'];

/** Legacy values from the sans/serif picker — map into the named pack. */
const LEGACY_FONTS: Record<string, FontChoice> = {
  sans: 'default',
  serif: 'literata',
};

function pick<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback;
}

function pickFont(v: unknown): FontChoice {
  if (typeof v === 'string' && v in LEGACY_FONTS) return LEGACY_FONTS[v]!;
  return pick(v, FONTS, DEFAULT_THEME.font);
}

/** Free keeps the default app stack; every named pack is Pro. */
export function isProFont(font: FontChoice): boolean {
  return font !== 'default';
}

/** What actually paints: Pro fonts only apply while the subscription is active. */
export function resolveFont(font: FontChoice, isPro: boolean): FontChoice {
  return isPro || !isProFont(font) ? font : 'default';
}

export function loadTheme(): UITheme {
  const stored = read<Partial<UITheme>>(STORAGE_KEYS.theme);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_THEME };
  return {
    theme: pick(stored.theme, THEMES, DEFAULT_THEME.theme),
    accent: pick(stored.accent, ACCENTS, DEFAULT_THEME.accent),
    font: pickFont(stored.font),
    fontScale: pick(stored.fontScale, SCALES, DEFAULT_THEME.fontScale),
  };
}

export function saveTheme(t: UITheme): boolean {
  return write(STORAGE_KEYS.theme, t);
}

/**
 * Applies theme/font attributes to <html> and accent to the given wrapper.
 * `isPro` gates which font pack is written to `data-font` (stored choice stays).
 */
export function applyTheme(t: UITheme, accentRoot: HTMLElement | null, isPro = false): void {
  const root = document.documentElement;
  root.dataset.theme = t.theme;
  root.dataset.font = resolveFont(t.font, isPro);
  root.dataset.fontScale = t.fontScale;
  if (accentRoot) {
    accentRoot.dataset.accent = t.accent;
  }
}

/* ---------- onboarding (first-run tutorial) ---------- */

export function loadOnboardingSeen(): boolean {
  const v = read<boolean>(STORAGE_KEYS.onboardingSeen);
  return v === true;
}

export function markOnboardingSeen(): boolean {
  return write(STORAGE_KEYS.onboardingSeen, true);
}
