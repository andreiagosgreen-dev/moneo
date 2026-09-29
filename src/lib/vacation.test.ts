import { describe, expect, it } from 'vitest';
import {
  currentVacation,
  dayKeyFromInput,
  inputFromDayKey,
  isTimeOff,
  upcomingVacations,
  vacationRanges,
} from './vacation';
import { addTimeOffRange, removeTimeOffRange, toggleTimeOff } from './journal';

describe('vacation ranges', () => {
  it('groups consecutive days across month ends', () => {
    expect(
      vacationRanges(['2026-10-2', '2026-9-30', '2026-10-1', '2026-10-5', '2026-10-5']),
    ).toEqual([
      { from: '2026-9-30', to: '2026-10-2' },
      { from: '2026-10-5', to: '2026-10-5' },
    ]);
    expect(vacationRanges([])).toEqual([]);
  });

  it('finds the current and upcoming ranges', () => {
    const off = ['2026-9-28', '2026-9-29', '2026-9-30', '2026-10-10'];
    expect(currentVacation(off, '2026-9-29')).toEqual({ from: '2026-9-28', to: '2026-9-30' });
    expect(currentVacation(off, '2026-10-1')).toBeNull();
    expect(upcomingVacations(off, '2026-9-30').map((r) => r.from)).toEqual([
      '2026-9-28',
      '2026-10-10',
    ]);
    expect(upcomingVacations(off, '2026-10-1').map((r) => r.from)).toEqual(['2026-10-10']);
    expect(isTimeOff(off, '2026-10-10')).toBe(true);
  });

  it('converts date-input values', () => {
    expect(dayKeyFromInput('2026-09-05')).toBe('2026-9-5');
    expect(dayKeyFromInput('2026-02-30')).toBeNull();
    expect(dayKeyFromInput('nope')).toBeNull();
    expect(inputFromDayKey('2026-9-5')).toBe('2026-09-05');
  });
});

describe('time-off range helpers', () => {
  it('adds an inclusive range, sorted chronologically', () => {
    expect(addTimeOffRange(['2026-10-10'], '2026-9-29', '2026-10-2')).toEqual([
      '2026-9-29',
      '2026-9-30',
      '2026-10-1',
      '2026-10-2',
      '2026-10-10',
    ]);
  });

  it('rejects reversed, invalid and over-60-day ranges', () => {
    const base = ['2026-9-1'];
    expect(addTimeOffRange(base, '2026-9-10', '2026-9-9')).toBe(base);
    expect(addTimeOffRange(base, 'x', '2026-9-9')).toBe(base);
    expect(addTimeOffRange(base, '2026-9-1', '2026-10-31')).toBe(base);
    expect(addTimeOffRange([], '2026-9-1', '2026-10-30')).toHaveLength(60);
  });

  it('removes an inclusive range and keeps the rest', () => {
    const off = addTimeOffRange([], '2026-9-28', '2026-10-3');
    expect(removeTimeOffRange(off, '2026-9-30', '2026-10-3')).toEqual(['2026-9-28', '2026-9-29']);
    expect(removeTimeOffRange(off, '2026-10-3', '2026-9-30')).toBe(off);
  });

  it('toggle keeps chronological order', () => {
    expect(toggleTimeOff(['2026-10-1'], '2026-9-30')).toEqual(['2026-9-30', '2026-10-1']);
  });
});
