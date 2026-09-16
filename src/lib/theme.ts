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
 */

export type ThemeName = 'dark' | 'light';
export type AccentName = 'auto' | 'tomato' | 'mint' | 'sky' | 'violet' | 'amber' | 'rose';
export type FontChoice = 'sans' | 'serif';
export type FontScale = 'normal' | 'comfort' | 'compact';

export interface UITheme {
  theme: ThemeName;
  accent: AccentName;
  font: FontChoice;
  fontScale: FontScale;
}

export const DEFAULT_THEME: UITheme = {
  theme: 'dark',
  accent: 'auto',
  font: 'sans',
  fontScale: 'normal',
};

/** Custom accent palette; `auto` keeps the per-mode colors. */
export const ACCENT_PRESETS: Record<
  Exclude<AccentName, 'auto'>,
  { accent: string; deep: string; rgb: string; on: string }
> = {
  tomato: { accent: '#ff6242', deep: '#d94322', rgb: '255, 98, 66', on: '#1a0d08' },
  mint: { accent: '#3ddc97', deep: '#1fb877', rgb: '61, 220, 151', on: '#06170f' },
  sky: { accent: '#6faeff', deep: '#3e86e8', rgb: '111, 174, 255', on: '#081220' },
  violet: { accent: '#a78bfa', deep: '#7c5ce8', rgb: '167, 139, 250', on: '#110a24' },
  amber: { accent: '#f5b942', deep: '#d19422', rgb: '245, 185, 66', on: '#1d1404' },
  rose: { accent: '#ff7ab6', deep: '#e04f92', rgb: '255, 122, 182', on: '#200a14' },
};

export const THEME_OPTIONS: ThemeName[] = ['dark', 'light'];
export const FONT_OPTIONS: FontChoice[] = ['sans', 'serif'];
export const FONT_SCALE_OPTIONS: FontScale[] = ['normal', 'comfort', 'compact'];

const THEMES: ThemeName[] = ['dark', 'light'];
const ACCENTS: AccentName[] = ['auto', 'tomato', 'mint', 'sky', 'violet', 'amber', 'rose'];
const FONTS: FontChoice[] = ['sans', 'serif'];
const SCALES: FontScale[] = ['normal', 'comfort', 'compact'];

function pick<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback;
}

export function loadTheme(): UITheme {
  const stored = read<Partial<UITheme>>(STORAGE_KEYS.theme);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_THEME };
  return {
    theme: pick(stored.theme, THEMES, DEFAULT_THEME.theme),
    accent: pick(stored.accent, ACCENTS, DEFAULT_THEME.accent),
    font: pick(stored.font, FONTS, DEFAULT_THEME.font),
    fontScale: pick(stored.fontScale, SCALES, DEFAULT_THEME.fontScale),
  };
}

export function saveTheme(t: UITheme): boolean {
  return write(STORAGE_KEYS.theme, t);
}

/** Applies theme/font attributes to <html> and accent to the given wrapper. */
export function applyTheme(t: UITheme, accentRoot: HTMLElement | null): void {
  const root = document.documentElement;
  root.dataset.theme = t.theme;
  root.dataset.font = t.font;
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
