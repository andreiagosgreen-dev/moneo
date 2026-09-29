import { describe, expect, it } from 'vitest';
import {
  bestFocusHour,
  bestWorstWeek,
  buildReportInsights,
  energyFocusCorrelation,
  focusByHour,
  habitStrengths,
  pearson,
  weekTotals,
} from './reportInsights';
import { logDailyCheckin, type EnergyEntry } from './energy';
import { addDays } from './dayKeys';
import type { Habit, HabitLog } from './habits';
import type { Session } from './store';

const TODAY = '2026-9-30';
const CREATED = new Date(2026, 7, 1, 12).getTime();

function habit(id: string, over: Partial<Habit> = {}): Habit {
  return {
    id,
    name: id.toUpperCase(),
    frequency: 'daily',
    targetPerWeek: 7,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...over,
  };
}

const lastDays = (n: number, step = 1) =>
  Array.from({ length: Math.ceil(n / step) }, (_, i) => addDays(TODAY, -i * step));

describe('habitStrengths', () => {
  it('ranks active habits with enough days, daily and weekly', () => {
    const habits = [
      habit('a'),
      habit('b'),
      habit('c', { createdAt: new Date(2026, 8, 28, 12).getTime() }),
      habit('d', { frequency: 'weekly', targetPerWeek: 3 }),
      habit('e', { archived: true }),
    ];
    const log: HabitLog = {
      a: lastDays(30),
      b: lastDays(30, 2),
      c: ['2026-9-29', '2026-9-30'],
      d: lastDays(30, 5),
      e: lastDays(30),
    };
    const s = habitStrengths(habits, log, TODAY);
    expect(s.map((h) => h.habitId)).toEqual(['a', 'b', 'd']);
    expect(s[0]).toMatchObject({ rate: 1, hits: 30, eligibleDays: 30 });
    expect(s[1]).toMatchObject({ rate: 0.5, hits: 15 });
    expect(s[2].rate).toBeCloseTo(6 / ((3 * 30) / 7), 5);
  });

  it('returns nothing without habits or history', () => {
    expect(habitStrengths([], {}, TODAY)).toEqual([]);
  });
});

describe('weeks', () => {
  const history: Session[] = [
    { at: Date.UTC(2026, 8, 23, 12), min: 60 },
    { at: Date.UTC(2026, 8, 15, 12), min: 30 },
    { at: Date.UTC(2026, 8, 29, 12), min: 100 },
  ];

  it('totals complete weeks only, oldest first', () => {
    const totals = weekTotals(history, 'UTC', TODAY);
    expect(totals).toHaveLength(8);
    expect(totals[0].mondayKey).toBe('2026-8-3');
    expect(totals[7]).toEqual({ mondayKey: '2026-9-21', min: 60, sessions: 1 });
    expect(totals[6]).toEqual({ mondayKey: '2026-9-14', min: 30, sessions: 1 });
    expect(totals.some((w) => w.mondayKey === '2026-9-28')).toBe(false);
  });

  it('picks the best and hardest week, needs two active weeks', () => {
    const bw = bestWorstWeek(weekTotals(history, 'UTC', TODAY));
    expect(bw?.best.mondayKey).toBe('2026-9-21');
    expect(bw?.worst.mondayKey).toBe('2026-9-14');
    expect(bestWorstWeek(weekTotals(history.slice(0, 1), 'UTC', TODAY))).toBeNull();
  });
});

describe('focus hours', () => {
  const now = Date.UTC(2026, 8, 30, 12);

  it('buckets by start hour in the account timezone', () => {
    const history: Session[] = [{ at: Date.UTC(2026, 8, 29, 10), min: 60 }];
    expect(focusByHour(history, 'Europe/Bucharest', now)[12]).toBe(60);
    expect(focusByHour(history, 'America/New_York', now)[5]).toBe(60);
  });

  it('counts a session across midnight toward its start hour', () => {
    const history: Session[] = [{ at: Date.UTC(2026, 8, 29, 0, 30), min: 60 }];
    const buckets = focusByHour(history, 'UTC', now);
    expect(buckets[23]).toBe(60);
    expect(buckets[0]).toBe(0);
  });

  it('needs five sessions for a best hour', () => {
    const buckets = new Array<number>(24).fill(0);
    buckets[9] = 120;
    buckets[14] = 30;
    expect(bestFocusHour(buckets, 4)).toBeNull();
    expect(bestFocusHour(buckets, 5)).toEqual({ hour: 9, share: 0.8 });
    expect(bestFocusHour(new Array<number>(24).fill(0), 9)).toBeNull();
  });
});

describe('energy and focus', () => {
  const energies = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5];
  let entries: EnergyEntry[] = [];
  const history: Session[] = [];
  energies.forEach((e, i) => {
    const day = 20 + i;
    const key = `2026-9-${day}`;
    entries = logDailyCheckin(
      entries,
      key,
      { energy: e, mood: e >= 4 ? 5 : 1 },
      Date.UTC(2026, 8, day, 8),
    );
    history.push({ at: Date.UTC(2026, 8, day, 15), min: e * 20 });
  });

  it('compares high- and low-energy days with a positive r', () => {
    const r = energyFocusCorrelation(entries, history, 'UTC', TODAY);
    expect(r).not.toBeNull();
    expect(r!.pairedDays).toBe(10);
    expect(r!.highAvgMin).toBe(90);
    expect(r!.lowAvgMin).toBe(30);
    expect(r!.r).toBeGreaterThan(0.99);
    expect(r!.moodHighAvgMin).toBe(90);
    expect(r!.moodLowAvgMin).toBe(40);
  });

  it('needs seven paired days and skips today', () => {
    expect(energyFocusCorrelation(entries.slice(0, 6), history, 'UTC', TODAY)).toBeNull();
    const withToday = logDailyCheckin(entries, TODAY, { energy: 5 }, Date.UTC(2026, 8, 30, 8));
    expect(energyFocusCorrelation(withToday, history, 'UTC', TODAY)!.pairedDays).toBe(10);
  });

  it('has no r when a series is flat', () => {
    expect(pearson([1, 1, 1], [3, 4, 5])).toBeNull();
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });
});

describe('buildReportInsights', () => {
  it('never produces NaN on empty data', () => {
    const ins = buildReportInsights({
      habits: [],
      habitLog: {},
      history: [],
      energyLog: [],
      timezone: 'UTC',
      now: Date.UTC(2026, 8, 30, 12),
      habitTodayKey: TODAY,
    });
    expect(ins.strongest).toBeNull();
    expect(ins.weakest).toBeNull();
    expect(ins.bestWorst).toBeNull();
    expect(ins.bestHour).toBeNull();
    expect(ins.energy).toBeNull();
    expect(ins.lockedWithData).toBe(0);
    expect(ins.hours.every((m) => m === 0)).toBe(true);
  });
});
