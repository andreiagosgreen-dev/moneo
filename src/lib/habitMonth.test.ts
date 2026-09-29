import { describe, expect, it } from 'vitest';
import { buildHabitMonth, shiftMonth, weekIndexInMonth } from './habitMonth';
import type { Habit } from './habits';

function at(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d, 9, 0, 0).getTime();
}

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: overrides.id ?? 'h1',
    name: overrides.name ?? 'Read',
    frequency: overrides.frequency ?? 'daily',
    targetPerWeek: overrides.targetPerWeek ?? 7,
    createdAt: overrides.createdAt ?? at(2026, 9, 1),
    updatedAt: 1,
    ...overrides,
  };
}

describe('shiftMonth', () => {
  it('wraps across years in both directions', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 9, -12)).toEqual({ year: 2025, month: 9 });
  });
});

describe('weekIndexInMonth', () => {
  it('splits a month that starts on a Sunday', () => {
    // 2026-11-1 is a Sunday: it is week 0 on its own, Monday the 2nd opens week 1.
    expect(weekIndexInMonth('2026-11-1', 2026, 11)).toBe(0);
    expect(weekIndexInMonth('2026-11-2', 2026, 11)).toBe(1);
    expect(weekIndexInMonth('2026-11-30', 2026, 11)).toBe(5);
  });
});

describe('buildHabitMonth', () => {
  it('builds 31, 30, 28 and leap 29 day months', () => {
    expect(buildHabitMonth([], {}, 2026, 10, '2026-10-31').keys).toHaveLength(31);
    expect(buildHabitMonth([], {}, 2026, 9, '2026-9-30').keys).toHaveLength(30);
    expect(buildHabitMonth([], {}, 2026, 2, '2026-2-28').keys).toHaveLength(28);
    expect(buildHabitMonth([], {}, 2028, 2, '2028-2-29').keys).toHaveLength(29);
  });

  it('expects every eligible day for daily habits and a weekly share for weekly ones', () => {
    const daily = habit({ id: 'd' });
    const weekly = habit({ id: 'w', frequency: 'weekly', targetPerWeek: 3 });
    const m = buildHabitMonth(
      [daily, weekly],
      { d: ['2026-9-1', '2026-9-2'], w: ['2026-9-3'] },
      2026,
      9,
      '2026-9-14',
    );
    const [d, w] = m.rows;
    expect(d.expected).toBe(14);
    expect(d.done).toBe(2);
    expect(d.pct).toBe(14);
    expect(w.expected).toBe(6); // round(3 * 14 / 7)
    expect(w.pct).toBe(17);
  });

  it('counts back-filled days before the creation day', () => {
    const h = habit({ createdAt: at(2026, 9, 10) });
    const m = buildHabitMonth([h], { h1: ['2026-9-5'] }, 2026, 9, '2026-9-14');
    const cells = m.rows[0].cells;
    expect(cells[3].beforeStart).toBe(true); // 9-4
    expect(cells[4].beforeStart).toBe(false); // 9-5
    expect(m.rows[0].expected).toBe(10); // 9-5 .. 9-14
    expect(m.rows[0].done).toBe(1);
  });

  it('marks future days and ignores check-ins on them', () => {
    const m = buildHabitMonth([habit()], { h1: ['2026-9-20'] }, 2026, 9, '2026-9-14');
    const row = m.rows[0];
    expect(row.cells[13].future).toBe(false);
    expect(row.cells[14].future).toBe(true);
    expect(row.done).toBe(0);
  });

  it('never produces NaN when a habit has no eligible days', () => {
    const m = buildHabitMonth([habit()], {}, 2026, 8, '2026-9-14');
    expect(m.rows[0].expected).toBe(0);
    expect(m.rows[0].pct).toBe(0);
    expect(m.total).toEqual({ done: 0, expected: 0, pct: 0 });
    expect(m.weeks.every((w) => w.pct === 0)).toBe(true);
  });

  it('cuts weeks at month edges and sums habits per week', () => {
    const h = habit({ createdAt: at(2026, 10, 1) });
    const m = buildHabitMonth([h], { h1: ['2026-11-1', '2026-11-2'] }, 2026, 11, '2026-11-3');
    expect(m.weeks).toHaveLength(6);
    expect(m.weeks[0]).toMatchObject({ mondayKey: '2026-10-26', days: ['2026-11-1'], done: 1 });
    expect(m.weeks[0].pct).toBe(100);
    expect(m.weeks[1]).toMatchObject({ mondayKey: '2026-11-2', done: 1, expected: 2, pct: 50 });
    expect(m.weeks[2]).toMatchObject({ expected: 0, pct: 0 });
  });

  it('does not let an over-achieved weekly habit hide a missed daily one', () => {
    const daily = habit({ id: 'd' });
    const weekly = habit({ id: 'w', frequency: 'weekly', targetPerWeek: 1 });
    const m = buildHabitMonth(
      [daily, weekly],
      { w: ['2026-9-1', '2026-9-2', '2026-9-3', '2026-9-4', '2026-9-5', '2026-9-6', '2026-9-7'] },
      2026,
      9,
      '2026-9-7',
    );
    expect(m.total).toEqual({ done: 1, expected: 8, pct: 13 });
  });

  it('ranks the top three by percentage and skips archived habits', () => {
    const list = [
      habit({ id: 'a', name: 'A', createdAt: at(2026, 9, 1) + 1 }),
      habit({ id: 'b', name: 'B', createdAt: at(2026, 9, 1) + 2 }),
      habit({ id: 'c', name: 'C', createdAt: at(2026, 9, 1) + 3 }),
      habit({ id: 'd', name: 'D', createdAt: at(2026, 9, 1) + 4 }),
      habit({ id: 'x', name: 'Archived', archived: true }),
    ];
    const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-9-${i + 1}`);
    const m = buildHabitMonth(
      list,
      { a: days(2), b: days(10), c: [], d: days(5), x: days(10) },
      2026,
      9,
      '2026-9-10',
    );
    expect(m.rows.map((r) => r.habitId)).toEqual(['a', 'b', 'c', 'd']);
    expect(m.top.map((t) => t.name)).toEqual(['B', 'D', 'A']);
    expect(m.top[0].pct).toBe(100);
  });
});
