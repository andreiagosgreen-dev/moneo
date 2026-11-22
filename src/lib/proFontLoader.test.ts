import { describe, expect, it, afterEach } from 'vitest';
import { FONT_OPTIONS } from './theme';
import { LAZY_PRO_FONTS, loadProFont, resetLoadedProFonts } from './proFontLoader';

const CORE_FONTS = new Set(['default', 'inter', 'literata', 'cal-sans', 'jetbrains']);

afterEach(() => {
  resetLoadedProFonts();
});

describe('proFontLoader', () => {
  it('covers every non-core FontChoice in FONT_OPTIONS', () => {
    const expected = FONT_OPTIONS.filter((f) => !CORE_FONTS.has(f)).sort();
    expect([...LAZY_PRO_FONTS].sort()).toEqual(expected);
  });

  it('is a no-op for core bundled fonts', async () => {
    expect(await loadProFont('default')).toBe(false);
    expect(await loadProFont('inter')).toBe(false);
    expect(await loadProFont('literata')).toBe(false);
    expect(await loadProFont('cal-sans')).toBe(false);
    expect(await loadProFont('jetbrains')).toBe(false);
  });
});
