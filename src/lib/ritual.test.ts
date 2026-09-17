import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAY_CAPACITY_MIN,
  dayCapacity,
  formatMinutes,
  loadRitualDay,
  nextDayKey,
  overcommitment,
  saveRitualDay,
  shouldShowMorningRitual,
  shutdownSummary,
  type ShutdownSummary,
} from './ritual';
import type { TimeBlock } from './timeBlocks';

const TZ = 'UTC';
// Monday 2026-09-14 08:30 UTC — morning.
const MORNING = new Date(Date.UTC(2026, 8, 14, 8, 30)).getTime();
// Same day 20:00 UTC — evening.
const EVENING = new Date(Date.UTC(2026, 8, 14, 20, 0)).getTime();

function block(over: Partial<TimeBlock> = {}): TimeBlock {
  return {
    id: over.id ?? 'b1',
    label: 'Deep work',
    weekday: 1,
    startMin: 540,
    endMin: 660,
    color: '#fff',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe('shouldShowMorningRitual', () => {
  it('shows once per day, mornings only', () => {
    expect(shouldShowMorningRitual(MORNING, TZ, null)).toBe(true);
    expect(shouldShowMorningRitual(MORNING, TZ, '2026-9-14')).toBe(false);
    expect(shouldShowMorningRitual(EVENING, TZ, null)).toBe(false);
    expect(shouldShowMorningRitual(EVENING, TZ, '2026-9-13')).toBe(false);
  });

  it('persists the shown day', () => {
    expect(loadRitualDay()).toBeNull();
    expect(saveRitualDay('2026-9-14')).toBe(true);
    expect(loadRitualDay()).toBe('2026-9-14');
  });
});

describe('overcommitment', () => {
  it('flags planned load above capacity', () => {
    expect(overcommitment(450, 360)).toEqual({
      plannedMin: 450,
      availableMin: 360,
      over: true,
      excessMin: 90,
    });
    expect(overcommitment(200, 360).over).toBe(false);
    expect(overcommitment(0, 360)).toEqual({
      plannedMin: 0,
      availableMin: 360,
      over: false,
      excessMin: 0,
    });
  });

  it('falls back to the default budget on junk input', () => {
    const r = overcommitment(NaN, -5);
    expect(r.availableMin).toBe(DEFAULT_DAY_CAPACITY_MIN);
    expect(r.over).toBe(false);
  });
});

describe('dayCapacity', () => {
  it('sums block spans for the weekday, else the fallback', () => {
    const blocks = [block({}), block({ id: 'b2', startMin: 700, endMin: 760, weekday: 1 })];
    expect(dayCapacity(blocks, 1)).toBe(180);
    expect(dayCapacity(blocks, 3)).toBe(DEFAULT_DAY_CAPACITY_MIN);
    expect(dayCapacity([], 1)).toBe(DEFAULT_DAY_CAPACITY_MIN);
  });
});

describe('shutdownSummary', () => {
  it('counts sessions, minutes and open plan items', () => {
    const history = [
      { id: 's1', at: MORNING, min: 25 },
      { id: 's2', at: MORNING + 3600_000, min: 50 },
      { id: 's3', at: MORNING - 3 * 86400_000, min: 999 },
    ];
    const plans = [
      {
        dateKey: '2026-9-14',
        tasks: [
          { id: 'a', text: 'Ship it', done: true, rank: 1 },
          { id: 'b', text: 'Write docs', done: false, rank: 2 },
        ],
      },
    ];
    const s: ShutdownSummary = shutdownSummary(history, plans, '2026-9-14', TZ);
    expect(s).toEqual({
      sessions: 2,
      minutes: 75,
      done: 1,
      total: 2,
      unfinished: ['Write docs'],
    });
  });

  it('handles empty days', () => {
    expect(shutdownSummary([], [], '2026-9-14', TZ)).toEqual({
      sessions: 0,
      minutes: 0,
      done: 0,
      total: 0,
      unfinished: [],
    });
  });
});

describe('nextDayKey + formatMinutes', () => {
  it('rolls months and years over', () => {
    expect(nextDayKey('2026-9-14')).toBe('2026-9-15');
    expect(nextDayKey('2026-9-30')).toBe('2026-10-1');
    expect(nextDayKey('2026-12-31')).toBe('2027-1-1');
    expect(nextDayKey('nope')).toBe('nope');
  });

  it('formats durations', () => {
    expect(formatMinutes(25)).toBe('25m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(135)).toBe('2h 15m');
  });
});
