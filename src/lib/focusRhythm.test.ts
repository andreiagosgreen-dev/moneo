import { describe, expect, it } from 'vitest';
import { FOCUS_PRESETS, isPreset, rhythmFor, sanitizeFocusMin } from './focusRhythm';

describe('focusRhythm', () => {
  it('keeps the classic Pomodoro pairing for 25 minutes', () => {
    expect(rhythmFor(25)).toEqual({ focusMin: 25, shortMin: 5, longMin: 15 });
  });

  it('pairs every preset with a break of a fifth and a capped long break', () => {
    const pairs = FOCUS_PRESETS.map((m) => {
      const r = rhythmFor(m);
      return [m, r.shortMin, r.longMin];
    });
    expect(pairs).toEqual([
      [5, 1, 5],
      [15, 3, 9],
      [25, 5, 15],
      [35, 7, 21],
      [45, 9, 27],
      [55, 11, 30],
      [65, 13, 30],
    ]);
  });

  it('long break is never shorter than the short break', () => {
    for (let m = 1; m <= 90; m++) {
      const r = rhythmFor(m);
      expect(r.longMin).toBeGreaterThanOrEqual(r.shortMin);
      expect(r.shortMin).toBeGreaterThanOrEqual(1);
    }
  });

  it('sanitizes custom input into 5–90 whole minutes', () => {
    expect(sanitizeFocusMin('40')).toBe(40);
    expect(sanitizeFocusMin(' 32,6 ')).toBe(33);
    expect(sanitizeFocusMin('2')).toBe(5);
    expect(sanitizeFocusMin('200')).toBe(90);
    expect(sanitizeFocusMin('abc')).toBeNull();
    expect(sanitizeFocusMin('0')).toBeNull();
    expect(sanitizeFocusMin('')).toBeNull();
  });

  it('knows which lengths are presets', () => {
    expect(isPreset(25)).toBe(true);
    expect(isPreset(40)).toBe(false);
  });
});
