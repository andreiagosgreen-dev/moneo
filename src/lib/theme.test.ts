import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  applyTheme,
  loadOnboardingSeen,
  markOnboardingSeen,
  ACCENT_PRESETS,
  FONT_OPTIONS,
  isProFont,
  resolveFont,
  type UITheme,
} from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-font');
  document.documentElement.removeAttribute('data-font-scale');
});

afterEach(() => {
  localStorage.clear();
});

describe('loadTheme', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadTheme()).toEqual(DEFAULT_THEME);
  });

  it('round-trips a saved theme', () => {
    const t: UITheme = {
      theme: 'light',
      accent: 'violet',
      font: 'source-serif',
      fontScale: 'comfort',
    };
    saveTheme(t);
    expect(loadTheme()).toEqual(t);
  });

  it('migrates legacy sans/serif into named packs', () => {
    saveTheme({
      theme: 'dark',
      accent: 'auto',
      font: 'serif',
      fontScale: 'normal',
    } as unknown as UITheme);
    expect(loadTheme().font).toBe('literata');

    saveTheme({
      theme: 'dark',
      accent: 'auto',
      font: 'sans',
      fontScale: 'normal',
    } as unknown as UITheme);
    expect(loadTheme().font).toBe('default');
  });

  it('coerces invalid values to defaults, keeps valid ones', () => {
    saveTheme({
      theme: 'neon',
      accent: 'sky',
      font: 'inter',
      fontScale: 'huge',
    } as unknown as UITheme);
    const t = loadTheme();
    expect(t.theme).toBe('light');
    expect(t.accent).toBe('sky');
    expect(t.font).toBe('inter');
    expect(t.fontScale).toBe('normal');
  });
});

describe('Pro font gate', () => {
  it('marks every pack except default as Pro', () => {
    expect(isProFont('default')).toBe(false);
    for (const f of FONT_OPTIONS) {
      if (f === 'default') continue;
      expect(isProFont(f)).toBe(true);
    }
  });

  it('resolveFont keeps Pro packs only while subscribed', () => {
    expect(resolveFont('fraunces', true)).toBe('fraunces');
    expect(resolveFont('fraunces', false)).toBe('default');
    expect(resolveFont('newsreader', true)).toBe('newsreader');
    expect(resolveFont('space-grotesk', false)).toBe('default');
    expect(resolveFont('default', false)).toBe('default');
  });

  it('applyTheme writes data-font from resolveFont (gate + persistence)', () => {
    const stored: UITheme = {
      theme: 'dark',
      accent: 'auto',
      font: 'cal-sans',
      fontScale: 'normal',
    };
    saveTheme(stored);
    expect(loadTheme().font).toBe('cal-sans');

    applyTheme(stored, null, false);
    expect(document.documentElement.dataset.font).toBe('default');

    applyTheme(stored, null, true);
    expect(document.documentElement.dataset.font).toBe('cal-sans');
  });
});

describe('applyTheme', () => {
  it('sets dataset attributes on <html>', () => {
    const el = document.createElement('div');
    applyTheme(
      { theme: 'light', accent: 'mint', font: 'literata', fontScale: 'compact' },
      el,
      true,
    );
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.font).toBe('literata');
    expect(document.documentElement.dataset.fontScale).toBe('compact');
    expect(el.dataset.accent).toBe('mint');
  });

  it('writes accent on the mode wrapper only', () => {
    const el = document.createElement('div');
    applyTheme({ ...DEFAULT_THEME, accent: 'amber' }, el);
    expect(el.dataset.accent).toBe('amber');
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
  });
});

describe('accent presets', () => {
  it('defines every non-auto preset with the expected fields', () => {
    const keys = ['tomato', 'mint', 'sky', 'violet', 'amber', 'rose'];
    for (const k of keys) {
      const p = ACCENT_PRESETS[k as keyof typeof ACCENT_PRESETS];
      expect(p.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.deep).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.rgb).toMatch(/^[\d, ]+$/);
      expect(p.on).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('onboarding', () => {
  it('starts unseen and flips after marking', () => {
    expect(loadOnboardingSeen()).toBe(false);
    markOnboardingSeen();
    expect(loadOnboardingSeen()).toBe(true);
  });
});
