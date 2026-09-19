/* Habit tracking (Roadmap Phase 5.1) — daily/weekly habits, streaks, analytics.
 *
 * Completions live in a separate day-keyed log so habit objects stay small
 * and history survives renames. Pure functions; storage via STORAGE_KEYS.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { localDayKey } from './projects';

export type HabitFrequency = 'daily' | 'weekly';

export interface Habit {
  id: string;
  name: string;
  frequency: HabitFrequency;
  /** Weekly target completions (weekly habits only, 1-7). */
  targetPerWeek: number;
  /** Habit-stacking link: do this right after another habit. */
  stackAfter?: string;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** habitId → completed local day keys ("YYYY-M-D"). */
export type HabitLog = Record<string, string[]>;

/** Free tier tracks a handful of habits; Pro is unlimited. */
export const FREE_HABITS_LIMIT = 5;

export interface HabitTemplate {
  name: string;
  frequency: HabitFrequency;
  targetPerWeek: number;
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { name: 'Morning pages', frequency: 'daily', targetPerWeek: 7 },
  { name: 'Exercise 20 min', frequency: 'daily', targetPerWeek: 7 },
  { name: 'Read 10 pages', frequency: 'daily', targetPerWeek: 7 },
  { name: 'Meditate 10 min', frequency: 'daily', targetPerWeek: 7 },
  { name: 'Inbox zero', frequency: 'daily', targetPerWeek: 7 },
  { name: 'Strength training', frequency: 'weekly', targetPerWeek: 3 },
  { name: 'Weekly review', frequency: 'weekly', targetPerWeek: 1 },
  { name: 'Call family', frequency: 'weekly', targetPerWeek: 1 },
];

/** Local day key for a timestamp (shared "YYYY-M-D" format). */
function dayKeyAt(at: number): string {
  return localDayKey(at);
}

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return localDayKey(dt.getTime());
}

/** Load habits (active + archived), validating additive fields. */
export function loadHabits(): Habit[] {
  const stored = read<Habit[]>(STORAGE_KEYS.habits);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string')
    .map((h) => ({
      id: h.id,
      name: h.name,
      frequency: h.frequency === 'weekly' ? 'weekly' : 'daily',
      targetPerWeek:
        typeof h.targetPerWeek === 'number' && Number.isFinite(h.targetPerWeek)
          ? Math.min(7, Math.max(1, Math.round(h.targetPerWeek)))
          : 3,
      ...(typeof h.stackAfter === 'string' && h.stackAfter ? { stackAfter: h.stackAfter } : {}),
      ...(h.archived === true ? { archived: true as const } : {}),
      createdAt: typeof h.createdAt === 'number' ? h.createdAt : Date.now(),
      updatedAt: typeof h.updatedAt === 'number' ? h.updatedAt : Date.now(),
    }));
}

export function saveHabits(habits: Habit[]): boolean {
  return write(STORAGE_KEYS.habits, habits);
}

export function loadHabitLog(): HabitLog {
  const stored = read<HabitLog>(STORAGE_KEYS.habitLog);
  if (!stored || typeof stored !== 'object') return {};
  const clean: HabitLog = {};
  for (const [k, v] of Object.entries(stored)) {
    if (Array.isArray(v)) clean[k] = v.filter((d) => typeof d === 'string').slice(-365);
  }
  return clean;
}

export function saveHabitLog(log: HabitLog): boolean {
  const capped: HabitLog = {};
  for (const [k, v] of Object.entries(log)) {
    if (Array.isArray(v)) capped[k] = v.slice(-365);
  }
  return write(STORAGE_KEYS.habitLog, capped);
}

export function createHabitObject(
  name: string,
  frequency: HabitFrequency = 'daily',
  targetPerWeek = 3,
): Habit | null {
  const clean = name.trim().slice(0, 80);
  if (!clean) return null;
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: clean,
    frequency,
    targetPerWeek: Math.min(7, Math.max(1, Math.round(targetPerWeek) || 3)),
    createdAt: now,
    updatedAt: now,
  };
}

export interface HabitUpdates {
  name?: string;
  frequency?: HabitFrequency;
  targetPerWeek?: number;
  stackAfter?: string | null;
  archived?: boolean;
}

export function updateHabit(habits: Habit[], id: string, updates: HabitUpdates): Habit[] {
  return habits.map((h) => {
    if (h.id !== id) return h;
    const next: Habit = { ...h, updatedAt: Date.now() };
    if (updates.name !== undefined) next.name = updates.name.trim().slice(0, 80) || h.name;
    if (updates.frequency !== undefined) next.frequency = updates.frequency;
    if (updates.targetPerWeek !== undefined) {
      next.targetPerWeek = Math.min(7, Math.max(1, Math.round(updates.targetPerWeek) || 3));
    }
    if (updates.stackAfter !== undefined) {
      if (updates.stackAfter && updates.stackAfter !== id) next.stackAfter = updates.stackAfter;
      else delete next.stackAfter;
    }
    if (updates.archived !== undefined) {
      if (updates.archived) next.archived = true;
      else delete next.archived;
    }
    return next;
  });
}

/** Delete a habit and drop its completion log. */
export function deleteHabit(
  habits: Habit[],
  log: HabitLog,
  id: string,
): { habits: Habit[]; log: HabitLog } {
  const nextLog: HabitLog = { ...log };
  delete nextLog[id];
  // Stacking links pointing at the deleted habit are cleared.
  return {
    habits: habits
      .filter((h) => h.id !== id)
      .map((h) => {
        if (h.stackAfter !== id) return h;
        const next: Habit = { ...h, updatedAt: Date.now() };
        delete next.stackAfter;
        return next;
      }),
    log: nextLog,
  };
}

/** Toggle a day's completion. Pure. Never throws. */
export function toggleHabitDay(log: HabitLog, habitId: string, dayKey: string): HabitLog {
  const days = new Set(log[habitId] ?? []);
  if (days.has(dayKey)) days.delete(dayKey);
  else days.add(dayKey);
  return { ...log, [habitId]: [...days].sort().slice(-365) };
}

function completions(log: HabitLog, habitId: string): Set<string> {
  return new Set(log[habitId] ?? []);
}

/** Consecutive daily completions ending today (yesterday-bridged like frog streaks). */
function dailyStreak(log: HabitLog, habitId: string, now: number): number {
  const done = completions(log, habitId);
  let cursor = dayKeyAt(now);
  if (!done.has(cursor)) cursor = shiftDayKey(cursor, -1);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

/** Consecutive weeks meeting the weekly target, ending this week. */
function weeklyStreak(habit: Habit, log: HabitLog, now: number): number {
  const done = completions(log, habit.id);
  let streak = 0;
  let weekStart = startOfWeekKey(now);
  for (;;) {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      if (done.has(shiftDayKey(weekStart, i))) count += 1;
    }
    const isCurrentWeek = weekStart === startOfWeekKey(now);
    if (count >= habit.targetPerWeek) {
      streak += 1;
    } else if (isCurrentWeek && count > 0) {
      // Current week still in progress with activity — don't break yet.
      break;
    } else {
      break;
    }
    weekStart = shiftDayKey(weekStart, -7);
  }
  return streak;
}

function startOfWeekKey(now: number): string {
  const d = new Date(now);
  const mondayOffset = (d.getDay() + 6) % 7; // Monday-first weeks
  d.setDate(d.getDate() - mondayOffset);
  d.setHours(0, 0, 0, 0);
  return localDayKey(d.getTime());
}

export function habitStreak(habit: Habit, log: HabitLog, now: number = Date.now()): number {
  return habit.frequency === 'weekly'
    ? weeklyStreak(habit, log, now)
    : dailyStreak(log, habit.id, now);
}

/** Share of trailing days completed (daily) — 0..1. */
export function habitSuccessRate(
  log: HabitLog,
  habitId: string,
  now: number = Date.now(),
  days = 30,
): number {
  if (days <= 0) return 0;
  const done = completions(log, habitId);
  let hits = 0;
  for (let i = 0; i < days; i++) {
    if (done.has(shiftDayKey(dayKeyAt(now), -i))) hits += 1;
  }
  return hits / days;
}

/** True when the habit still needs attention today / this week. */
export function isHabitDue(habit: Habit, log: HabitLog, now: number = Date.now()): boolean {
  const done = completions(log, habit.id);
  if (habit.frequency === 'daily') return !done.has(dayKeyAt(now));
  const weekStart = startOfWeekKey(now);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    if (done.has(shiftDayKey(weekStart, i))) count += 1;
  }
  return count < habit.targetPerWeek;
}

export function activeHabits(habits: Habit[]): Habit[] {
  return habits.filter((h) => !h.archived).sort((a, b) => a.createdAt - b.createdAt);
}
