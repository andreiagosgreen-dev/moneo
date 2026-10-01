/**
 * Focus lengths and the breaks that go with them.
 *
 * Every length keeps the Pomodoro shape — focus, short break, and a long break
 * after a few rounds — and the classic 25/5/15 ratio: the short break is a fifth
 * of the focus round, the long break three short breaks (capped so it stays a rest,
 * not a second session).
 */

export const FOCUS_PRESETS = [5, 15, 25, 35, 45, 55, 65] as const;

/** The classic Pomodoro round. */
export const POMODORO_MIN = 25;

export const CUSTOM_FOCUS_MIN = 5;
export const CUSTOM_FOCUS_MAX = 90;

export interface FocusRhythm {
  focusMin: number;
  shortMin: number;
  longMin: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Clamp a typed custom length to a whole number of minutes in range; null if not a number. */
export function sanitizeFocusMin(raw: string | number): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return clamp(Math.round(n), CUSTOM_FOCUS_MIN, CUSTOM_FOCUS_MAX);
}

/** Focus length plus its paired short and long break (25 → 5 / 15). */
export function rhythmFor(focusMin: number): FocusRhythm {
  const focus = clamp(Math.round(focusMin), 1, CUSTOM_FOCUS_MAX);
  const shortMin = clamp(Math.round(focus / 5), 1, 15);
  const longMin = clamp(shortMin * 3, 5, 30);
  return { focusMin: focus, shortMin, longMin };
}

export function isPreset(min: number): boolean {
  return (FOCUS_PRESETS as readonly number[]).includes(min);
}
