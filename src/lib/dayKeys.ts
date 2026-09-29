/**
 * Calendar math on day keys ("YYYY-M-D", no zero padding). Pure and
 * timezone-free: callers pass keys produced by `dayKeyInTz` / `localDayKey`.
 * Arithmetic goes through Date.UTC so DST days (23/25 h) never matter, and
 * keys are never compared as strings ("2026-10-1" < "2026-9-30" lexically).
 */

export interface DayParts {
  y: number;
  m: number; // 1..12
  d: number;
}

const DAY_MS = 86_400_000;

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Parse "YYYY-M-D"; null for malformed or impossible dates. */
export function parseDayKey(key: string): DayParts | null {
  const match = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function toDayKey(p: DayParts): string {
  return `${p.y}-${p.m}-${p.d}`;
}

function utcDays(key: string): number {
  const p = parseDayKey(key);
  if (!p) return NaN;
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / DAY_MS);
}

function fromUtcDays(days: number): string {
  const dt = new Date(days * DAY_MS);
  return toDayKey({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

/** Shift a key by n calendar days (negative allowed). Malformed keys pass through. */
export function addDays(key: string, n: number): string {
  const base = utcDays(key);
  return Number.isNaN(base) ? key : fromUtcDays(base + n);
}

/** Whole calendar days from `from` to `to` (to - from). NaN for malformed keys. */
export function dayKeyDiff(from: string, to: string): number {
  return utcDays(to) - utcDays(from);
}

/** Chronological comparator (negative when a is earlier). Malformed keys sort first. */
export function compareDayKeys(a: string, b: string): number {
  const da = utcDays(a);
  const db = utcDays(b);
  if (Number.isNaN(da) || Number.isNaN(db)) {
    if (Number.isNaN(da) && Number.isNaN(db)) return 0;
    return Number.isNaN(da) ? -1 : 1;
  }
  return da - db;
}

/** 0 = Monday .. 6 = Sunday. */
export function weekdayIndexMon(key: string): number {
  const days = utcDays(key);
  if (Number.isNaN(days)) return 0;
  // 1970-01-01 was a Thursday (index 3 with Monday = 0).
  return (((days + 3) % 7) + 7) % 7;
}

/** Monday of the week containing `key`. */
export function mondayOf(key: string): string {
  return addDays(key, -weekdayIndexMon(key));
}

/** Seven keys, Monday to Sunday. */
export function weekKeys(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayKey, i));
}

export function monthKeys(y: number, m: number): string[] {
  return Array.from({ length: daysInMonth(y, m) }, (_, i) => toDayKey({ y, m, d: i + 1 }));
}
