import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  applyTheme,
  loadOnboardingSeen,
  markOnboardingSeen,
  ACCENT_PRESETS,
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
    const t: UITheme = { theme: 'light', accent: 'violet', font: 'serif', fontScale: 'comfort' };
    saveTheme(t);
    expect(loadTheme()).toEqual(t);
  });

  it('coerces invalid values to defaults, keeps valid ones', () => {
    saveTheme({
      theme: 'neon',
      accent: 'sky',
      font: 'sans',
      fontScale: 'huge',
    } as unknown as UITheme);
    const t = loadTheme();
    expect(t.theme).toBe('dark');
    expect(t.accent).toBe('sky');
    expect(t.font).toBe('sans');
    expect(t.fontScale).toBe('normal');
  });
});

describe('applyTheme', () => {
  it('sets dataset attributes on <html>', () => {
    const el = document.createElement('div');
    applyTheme({ theme: 'light', accent: 'mint', font: 'serif', fontScale: 'compact' }, el);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.font).toBe('serif');
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
