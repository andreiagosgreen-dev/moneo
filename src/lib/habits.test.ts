import { describe, expect, it } from 'vitest';

import {
  FREE_HABITS_LIMIT,
  HABIT_TEMPLATES,
  activeHabits,
  createHabitObject,
  deleteHabit,
  habitStreak,
  habitSuccessRate,
  isHabitDue,
  loadHabitLog,
  loadHabits,
  saveHabitLog,
  toggleHabitDay,
  updateHabit,
  type Habit,
} from './habits';

const NOW = new Date(2026, 8, 16, 12, 0).getTime(); // Wed Sep 16 2026 noon
const DAY = 24 * 3600_000;

function key(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: overrides.id ?? 'h1',
    name: overrides.name ?? 'Read',
    frequency: overrides.frequency ?? 'daily',
    targetPerWeek: overrides.targetPerWeek ?? 3,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('habits', () => {
  it('exposes the Free tier limit (5 habits)', () => {
    expect(FREE_HABITS_LIMIT).toBe(5);
  });

  it('ships starter templates across frequencies', () => {
    expect(HABIT_TEMPLATES.length).toBeGreaterThanOrEqual(6);
    expect(HABIT_TEMPLATES.some((t) => t.frequency === 'weekly')).toBe(true);
  });

  it('creates habits with trimmed names and clamped targets', () => {
    const h = createHabitObject('  Meditate  ', 'daily')!;
    expect(h.name).toBe('Meditate');
    expect(h.targetPerWeek).toBe(3);
    expect(createHabitObject('   ')).toBeNull();
    expect(createHabitObject('X', 'weekly', 99)!.targetPerWeek).toBe(7);
    expect(loadHabits()).toEqual([]);
  });

  it('toggles day completions immutably', () => {
    const log = toggleHabitDay({}, 'h1', '2026-9-16');
    expect(log).toEqual({ h1: ['2026-9-16'] });
    expect(toggleHabitDay(log, 'h1', '2026-9-16')).toEqual({ h1: [] });
  });

  it('counts daily streaks with a yesterday bridge', () => {
    const log = {
      h1: [key(NOW), key(NOW - DAY), key(NOW - 2 * DAY)],
    };
    expect(habitStreak(makeHabit(), log, NOW)).toBe(3);
    const morning = { h1: [key(NOW - DAY), key(NOW - 2 * DAY)] };
    expect(habitStreak(makeHabit(), morning, NOW)).toBe(2);
  });

  it('counts weekly streaks by met targets', () => {
    // Sep 14 2026 is a Monday; current week has 2/3 → in progress, streak 0 + prior full week.
    const monday = new Date(2026, 8, 14, 9, 0).getTime();
    const habit = makeHabit({ frequency: 'weekly', targetPerWeek: 2 });
    const log = {
      h1: [
        key(monday),
        key(monday + DAY), // this week: 2/2 met
        key(monday - 7 * DAY),
        key(monday - 6 * DAY), // last week: 2/2 met
      ],
    };
    expect(habitStreak(habit, log, NOW)).toBe(2);
  });

  it('reports due state and 30-day success rate', () => {
    const habit = makeHabit();
    expect(isHabitDue(habit, {}, NOW)).toBe(true);
    const done = toggleHabitDay({}, 'h1', key(NOW));
    expect(isHabitDue(habit, done, NOW)).toBe(false);
    expect(habitSuccessRate(done, 'h1', NOW, 30)).toBeCloseTo(1 / 30);
    expect(habitSuccessRate({}, 'h1', NOW, 0)).toBe(0);
  });

  it('updates fields and deletes with log cleanup', () => {
    const habits = [makeHabit({ id: 'a' }), makeHabit({ id: 'b', stackAfter: 'a' })];
    const renamed = updateHabit(habits, 'a', { name: '  Yoga  ', targetPerWeek: 5 });
    expect(renamed[0].name).toBe('Yoga');
    expect(renamed[0].targetPerWeek).toBe(5);
    const { habits: left, log } = deleteHabit(habits, { a: ['2026-9-16'] }, 'a');
    expect(left.map((h) => h.id)).toEqual(['b']);
    expect(left[0].stackAfter).toBeUndefined();
    expect(log).toEqual({});
    expect(
      activeHabits([...left, makeHabit({ id: 'c', archived: true })]).map((h) => h.id),
    ).toEqual(['b']);
  });

  it('persists the log round-trip', () => {
    const log = toggleHabitDay(loadHabitLog(), 'h1', '2026-9-16');
    expect(saveHabitLog(log)).toBe(true);
    expect(loadHabitLog()).toEqual(log);
  });
});
