import { describe, expect, it } from 'vitest';
import { dayProgress } from './dayProgress';
import type { IvyPlan } from './ivyLee';

const TZ = 'Europe/Bucharest';
const plan = (done: boolean[]): IvyPlan => ({
  dateKey: '2026-9-29',
  tasks: done.map((d, i) => ({ id: `t${i}`, text: `T${i}`, done: d, rank: i + 1 })),
});

describe('dayProgress', () => {
  it('rounds the percentage', () => {
    const p = dayProgress(plan([true, false, false]), [], '2026-9-29', TZ);
    expect(p).toMatchObject({ done: 1, total: 3, pct: 33, focusMin: 0 });
  });

  it('handles a missing or empty plan without NaN', () => {
    expect(dayProgress(null, [], '2026-9-29', TZ)).toEqual({
      done: 0,
      total: 0,
      pct: 0,
      focusMin: 0,
    });
    expect(dayProgress(plan([]), [], '2026-9-29', TZ).pct).toBe(0);
  });

  it('sums only sessions of the given day in the timezone', () => {
    const history = [
      { at: Date.UTC(2026, 8, 29, 8, 0), min: 25 },
      { at: Date.UTC(2026, 8, 29, 10, 0), min: 30 },
      { at: Date.UTC(2026, 8, 28, 10, 0), min: 50 }, // yesterday
      // 21:30 UTC on the 28th is already the 29th in Bucharest.
      { at: Date.UTC(2026, 8, 28, 21, 30), min: 10 },
    ];
    expect(dayProgress(null, history, '2026-9-29', TZ).focusMin).toBe(65);
  });
});
