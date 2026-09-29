import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDayKeys,
  dayKeyDiff,
  daysInMonth,
  monthKeys,
  mondayOf,
  parseDayKey,
  toDayKey,
  weekKeys,
  weekdayIndexMon,
} from './dayKeys';
import { dayKeyInTz } from './timezone';

describe('dayKeys', () => {
  it('parses and formats without padding', () => {
    expect(parseDayKey('2026-9-7')).toEqual({ y: 2026, m: 9, d: 7 });
    expect(toDayKey({ y: 2026, m: 9, d: 7 })).toBe('2026-9-7');
  });

  it('rejects malformed or impossible keys', () => {
    expect(parseDayKey('nope')).toBeNull();
    expect(parseDayKey('2026-13-1')).toBeNull();
    expect(parseDayKey('2026-2-30')).toBeNull();
    expect(parseDayKey('2026-09-07x')).toBeNull();
  });

  it('rolls over months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-1-1');
    expect(addDays('2027-1-1', -1)).toBe('2026-12-31');
    expect(addDays('2026-9-30', 1)).toBe('2026-10-1');
  });

  it('handles leap days', () => {
    expect(addDays('2028-2-28', 1)).toBe('2028-2-29');
    expect(addDays('2026-2-28', 1)).toBe('2026-3-1');
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('is DST-safe across the Bucharest clock changes', () => {
    // 2026-03-29 (23 h day) and 2026-10-25 (25 h day) in Europe/Bucharest.
    const before = dayKeyInTz(Date.UTC(2026, 2, 28, 12), 'Europe/Bucharest');
    const after = dayKeyInTz(Date.UTC(2026, 2, 30, 12), 'Europe/Bucharest');
    expect(dayKeyDiff(before, after)).toBe(2);
    const b2 = dayKeyInTz(Date.UTC(2026, 9, 24, 12), 'Europe/Bucharest');
    const a2 = dayKeyInTz(Date.UTC(2026, 9, 26, 12), 'Europe/Bucharest');
    expect(dayKeyDiff(b2, a2)).toBe(2);
    expect(addDays('2026-3-28', 2)).toBe('2026-3-30');
  });

  it('diffs whole calendar days', () => {
    expect(dayKeyDiff('2026-9-30', '2026-10-2')).toBe(2);
    expect(dayKeyDiff('2026-10-2', '2026-9-30')).toBe(-2);
    expect(dayKeyDiff('2026-9-7', '2026-9-7')).toBe(0);
    expect(dayKeyDiff('bad', '2026-9-7')).toBeNaN();
  });

  it('compares chronologically, not lexically', () => {
    expect(compareDayKeys('2026-10-1', '2026-9-30')).toBeGreaterThan(0);
    expect(compareDayKeys('2026-9-30', '2026-10-1')).toBeLessThan(0);
    expect(compareDayKeys('2026-9-1', '2026-9-1')).toBe(0);
    expect(['2026-10-1', '2026-9-30', '2026-9-9'].sort(compareDayKeys)).toEqual([
      '2026-9-9',
      '2026-9-30',
      '2026-10-1',
    ]);
  });

  it('finds Monday and weekday index', () => {
    // 2026-9-27 is a Sunday.
    expect(weekdayIndexMon('2026-9-27')).toBe(6);
    expect(mondayOf('2026-9-27')).toBe('2026-9-21');
    expect(mondayOf('2026-9-21')).toBe('2026-9-21');
    expect(weekdayIndexMon('2026-9-21')).toBe(0);
  });

  it('lists week and month keys', () => {
    expect(weekKeys('2026-12-28')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-1-1',
      '2027-1-2',
      '2027-1-3',
    ]);
    const feb = monthKeys(2028, 2);
    expect(feb).toHaveLength(29);
    expect(feb[0]).toBe('2028-2-1');
    expect(feb[28]).toBe('2028-2-29');
  });
});
