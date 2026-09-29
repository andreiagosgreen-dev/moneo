/**
 * Month view of habits (Stage 2): per-habit rows of day cells plus week and
 * month totals. Pure; day keys are device-local ("YYYY-M-D") like the habit
 * log, and all ordering goes through `dayKeys.ts`.
 */
import { activeHabits, type Habit, type HabitFrequency, type HabitLog } from './habits';
import { localDayKey } from './projects';
import { compareDayKeys, dayKeyDiff, mondayOf, monthKeys, parseDayKey, toDayKey } from './dayKeys';

export interface HabitMonthCell {
  key: string;
  done: boolean;
  future: boolean;
  beforeStart: boolean;
}

export interface HabitMonthRow {
  habitId: string;
  name: string;
  frequency: HabitFrequency;
  cells: HabitMonthCell[];
  /** Check-ins inside the month, up to today. */
  done: number;
  /** Check-ins the habit asks for on its eligible days (0 = not eligible). */
  expected: number;
  pct: number;
}

export interface HabitMonthWeek {
  mondayKey: string;
  index: number;
  days: string[];
  done: number;
  expected: number;
  pct: number;
}

export interface HabitMonth {
  year: number;
  month: number;
  keys: string[];
  todayKey: string;
  rows: HabitMonthRow[];
  weeks: HabitMonthWeek[];
  total: { done: number; expected: number; pct: number };
  top: Array<{ habitId: string; name: string; pct: number }>;
}

const TOP_MAX = 3;
const TOP_MIN_ELIGIBLE_DAYS = 3;

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (((idx % 12) + 12) % 12) + 1 };
}

/** 0-based Monday-week of `key` within its month (week 0 holds day 1). */
export function weekIndexInMonth(key: string, year: number, month: number): number {
  const first = toDayKey({ y: year, m: month, d: 1 });
  return Math.floor(dayKeyDiff(mondayOf(first), key) / 7);
}

function pctOf(done: number, expected: number): number {
  return expected > 0 ? Math.round(Math.min(1, done / expected) * 100) : 0;
}

function expectedFor(frequency: HabitFrequency, targetPerWeek: number, eligible: number): number {
  if (eligible <= 0) return 0;
  if (frequency === 'daily') return eligible;
  return Math.max(1, Math.round((targetPerWeek * eligible) / 7));
}

/** Earliest of the creation day and the first logged day (back-fill counts). */
function startKeyOf(habit: Habit, logged: string[]): string {
  let start = localDayKey(habit.createdAt);
  for (const key of logged) {
    if (parseDayKey(key) && compareDayKeys(key, start) < 0) start = key;
  }
  return start;
}

export function buildHabitMonth(
  habits: Habit[],
  log: HabitLog,
  year: number,
  month: number,
  todayKey: string,
): HabitMonth {
  const keys = monthKeys(year, month);
  const active = activeHabits(habits);

  const perHabit = active.map((habit) => {
    const logged = log[habit.id] ?? [];
    const doneSet = new Set(logged);
    const startKey = startKeyOf(habit, logged);
    const cells: HabitMonthCell[] = keys.map((key) => ({
      key,
      done: doneSet.has(key),
      future: compareDayKeys(key, todayKey) > 0,
      beforeStart: compareDayKeys(key, startKey) < 0,
    }));
    return { habit, cells };
  });

  const rows: HabitMonthRow[] = perHabit.map(({ habit, cells }) => {
    const eligible = cells.filter((c) => !c.future && !c.beforeStart).length;
    const done = cells.filter((c) => c.done && !c.future).length;
    const expected = expectedFor(habit.frequency, habit.targetPerWeek, eligible);
    return {
      habitId: habit.id,
      name: habit.name,
      frequency: habit.frequency,
      cells,
      done,
      expected,
      pct: pctOf(done, expected),
    };
  });

  const weekDays = new Map<number, string[]>();
  keys.forEach((key) => {
    const idx = weekIndexInMonth(key, year, month);
    const list = weekDays.get(idx) ?? [];
    list.push(key);
    weekDays.set(idx, list);
  });

  const weeks: HabitMonthWeek[] = [...weekDays.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, days]) => {
      const inWeek = new Set(days);
      let done = 0;
      let expected = 0;
      perHabit.forEach(({ habit, cells }) => {
        const weekCells = cells.filter((c) => inWeek.has(c.key));
        const eligible = weekCells.filter((c) => !c.future && !c.beforeStart).length;
        const rowExpected = expectedFor(habit.frequency, habit.targetPerWeek, eligible);
        const rowDone = weekCells.filter((c) => c.done && !c.future).length;
        expected += rowExpected;
        // Over-achieving a weekly target never hides a missed daily habit.
        done += Math.min(rowDone, rowExpected);
      });
      return {
        mondayKey: mondayOf(days[0]),
        index,
        days,
        done,
        expected,
        pct: pctOf(done, expected),
      };
    });

  let totalDone = 0;
  let totalExpected = 0;
  rows.forEach((r) => {
    totalExpected += r.expected;
    totalDone += Math.min(r.done, r.expected);
  });

  const eligibleDays = (row: HabitMonthRow) =>
    row.cells.filter((c) => !c.future && !c.beforeStart).length;
  const top = rows
    .map((row, order) => ({ row, order }))
    .filter(({ row }) => row.pct > 0 && eligibleDays(row) >= TOP_MIN_ELIGIBLE_DAYS)
    .sort((a, b) => b.row.pct - a.row.pct || b.row.done - a.row.done || a.order - b.order)
    .slice(0, TOP_MAX)
    .map(({ row }) => ({ habitId: row.habitId, name: row.name, pct: row.pct }));

  return {
    year,
    month,
    keys,
    todayKey,
    rows,
    weeks,
    total: { done: totalDone, expected: totalExpected, pct: pctOf(totalDone, totalExpected) },
    top,
  };
}
