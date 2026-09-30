/* Move module: workout log, weekly summary and the habit link.
 *
 * Local-first like the rest of Moneo: stored under STORAGE_KEYS.workouts,
 * included in the JSON export, never sent anywhere in stage 1.
 */
import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import { localDayKey } from '../projects';
import { activeHabits, toggleHabitDay, type Habit, type HabitLog } from '../habits';

export interface WorkoutSet {
  ex: string;
  reps?: number;
  kg?: number;
  sec?: number;
}

export interface WorkoutEntry {
  id: string;
  routineId: string;
  /** Local day key ("YYYY-M-D") the workout was finished on. */
  day: string;
  startedAt: number;
  durationSec: number;
  sets: WorkoutSet[];
}

export interface WorkoutStore {
  log: WorkoutEntry[];
  /** Habit ticked when a workout is saved. */
  habitId?: string;
}

export const MAX_WORKOUTS = 500;

const num = (v: unknown, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, v) : undefined;

function cleanSet(v: unknown): WorkoutSet | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (typeof s.ex !== 'string' || !s.ex) return null;
  const out: WorkoutSet = { ex: s.ex.slice(0, 40) };
  const reps = num(s.reps, 1000);
  const kg = num(s.kg, 1000);
  const sec = num(s.sec, 36000);
  if (reps !== undefined) out.reps = Math.round(reps);
  if (kg !== undefined) out.kg = Math.round(kg * 10) / 10;
  if (sec !== undefined) out.sec = Math.round(sec);
  return out;
}

function cleanEntry(v: unknown): WorkoutEntry | null {
  if (!v || typeof v !== 'object') return null;
  const e = v as Record<string, unknown>;
  if (typeof e.id !== 'string' || typeof e.routineId !== 'string' || typeof e.day !== 'string') {
    return null;
  }
  const startedAt = num(e.startedAt, Number.MAX_SAFE_INTEGER);
  const durationSec = num(e.durationSec, 86400);
  if (startedAt === undefined || durationSec === undefined) return null;
  const sets = Array.isArray(e.sets)
    ? e.sets.map(cleanSet).filter((s): s is WorkoutSet => s !== null)
    : [];
  return {
    id: e.id,
    routineId: e.routineId.slice(0, 40),
    day: e.day,
    startedAt,
    durationSec: Math.round(durationSec),
    sets,
  };
}

/** Validates anything read from storage/import. Never throws. */
export function sanitizeWorkoutStore(v: unknown): WorkoutStore {
  if (!v || typeof v !== 'object') return { log: [] };
  const raw = v as Record<string, unknown>;
  const log = Array.isArray(raw.log)
    ? raw.log.map(cleanEntry).filter((e): e is WorkoutEntry => e !== null)
    : [];
  const store: WorkoutStore = { log: log.slice(-MAX_WORKOUTS) };
  if (typeof raw.habitId === 'string' && raw.habitId) store.habitId = raw.habitId;
  return store;
}

export function loadWorkouts(): WorkoutStore {
  return sanitizeWorkoutStore(read<unknown>(STORAGE_KEYS.workouts));
}

export function saveWorkouts(store: WorkoutStore): boolean {
  return write(STORAGE_KEYS.workouts, store);
}

/** Pure: append a finished workout (oldest dropped past the cap). */
export function addWorkout(store: WorkoutStore, entry: WorkoutEntry): WorkoutStore {
  return { ...store, log: [...store.log, entry].slice(-MAX_WORKOUTS) };
}

export function deleteWorkout(store: WorkoutStore, id: string): WorkoutStore {
  return { ...store, log: store.log.filter((e) => e.id !== id) };
}

/** Local Monday 00:00 of the week containing `now`. */
function weekStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export interface WeekSummary {
  count: number;
  minutes: number;
  /** Distinct days with a workout this week. */
  days: number;
}

export function weekSummary(log: WorkoutEntry[], now: number = Date.now()): WeekSummary {
  const from = weekStart(now);
  const week = log.filter((e) => e.startedAt >= from && e.startedAt <= now);
  return {
    count: week.length,
    minutes: Math.round(week.reduce((sum, e) => sum + e.durationSec, 0) / 60),
    days: new Set(week.map((e) => e.day)).size,
  };
}

/** Total lifted (reps × kg) — 0 for bodyweight/time work. */
export function workoutVolume(sets: WorkoutSet[]): number {
  return Math.round(sets.reduce((sum, s) => sum + (s.reps ?? 0) * (s.kg ?? 0), 0));
}

/** Last weight logged for an exercise, to prefill the next set. */
export function lastWeight(log: WorkoutEntry[], exId: string): number | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const sets = log[i].sets;
    for (let j = sets.length - 1; j >= 0; j--) {
      if (sets[j].ex === exId && typeof sets[j].kg === 'number') return sets[j].kg;
    }
  }
  return undefined;
}

export function recentWorkouts(log: WorkoutEntry[], limit = 5): WorkoutEntry[] {
  return log
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit);
}

export const FITNESS_HABIT_ICON = '🏋️';
const FITNESS_ICONS = new Set(['🏋️', '🧘', '🏃', '🚴', '🏊', '💪', '🤸']);
const FITNESS_NAME =
  /workout|train|gym|fitness|sport|yoga|exercis|stretch|antren|sal[aă]|mi[sș]care|тренир|спорт|йога|зарядк|вправ|fitn|entren|ejercic|allenam|eserciz|entraîn|muscu|übung/i;

/**
 * Habit a saved workout should tick: the remembered one if still active,
 * else the first active habit that looks like exercise. Never throws.
 */
export function findFitnessHabit(habits: Habit[], preferredId?: string): Habit | undefined {
  const active = activeHabits(habits);
  if (preferredId) {
    const kept = active.find((h) => h.id === preferredId);
    if (kept) return kept;
  }
  return (
    active.find((h) => h.icon !== undefined && FITNESS_ICONS.has(h.icon)) ??
    active.find((h) => FITNESS_NAME.test(h.name))
  );
}

/** Pure: mark the habit done on a day (no-op when already done). */
export function markHabitDone(log: HabitLog, habitId: string, dayKey: string): HabitLog {
  if ((log[habitId] ?? []).includes(dayKey)) return log;
  return toggleHabitDay(log, habitId, dayKey);
}

export function newWorkoutEntry(
  routineId: string,
  startedAt: number,
  sets: WorkoutSet[],
  now: number = Date.now(),
): WorkoutEntry {
  return {
    id: crypto.randomUUID(),
    routineId,
    day: localDayKey(now),
    startedAt,
    durationSec: Math.max(0, Math.round((now - startedAt) / 1000)),
    sets,
  };
}
