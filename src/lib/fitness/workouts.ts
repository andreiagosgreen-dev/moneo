/* Move module: workout log, weekly summary and the habit link.
 *
 * Local-first like the rest of Moneo: stored under STORAGE_KEYS.workouts,
 * included in the JSON export and, for Pro with account sync on, synced one
 * record per workout (see `PRO_SYNC_COLLECTIONS`).
 */
import { cleanGear, type GearProfile } from './packs';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import { localDayKey } from '../projects';
import { activeHabits, toggleHabitDay, type Habit, type HabitLog } from '../habits';
import { FIT_PLACES, MUSCLES, getExercise, type FitPlace, type Muscle } from './library';
import { MAX_CUSTOM, cleanCustom, type CustomRoutine } from './custom';
import { CARDIO_MUSCLES, cardioKindOf, cardioLoad } from './cardio';
import { cleanProgram, isProgramActive, programOn, type Program } from './program';

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
  /** Distance of a cardio session. */
  km?: number;
}

/** Weekly schedule of one routine: weekdays 0 = Sunday … 6 = Saturday. */
export interface WorkoutPlan {
  routineId: string;
  days: number[];
}

export interface WorkoutStore {
  log: WorkoutEntry[];
  /** Habit ticked when a workout is saved. */
  habitId?: string;
  /** Last place picked in the Move tab. */
  place?: FitPlace;
  plan?: WorkoutPlan[];
  /** The user's own routines. */
  custom?: CustomRoutine[];
  /** Personal program (Pro). */
  program?: Program;
  /** "My equipment": owned gear and weights, for packs and one-tap weights. */
  gear?: GearProfile;
}

export const MAX_WORKOUTS = 500;
const MAX_PLANS = 20;
/** Weekly target when nothing is scheduled. */
export const DEFAULT_WEEK_GOAL = 3;

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
  const out: WorkoutEntry = {
    id: e.id,
    routineId: e.routineId.slice(0, 40),
    day: e.day,
    startedAt,
    durationSec: Math.round(durationSec),
    sets,
  };
  const km = num(e.km, 1000);
  if (km) out.km = Math.round(km * 100) / 100;
  return out;
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
  if (FIT_PLACES.includes(raw.place as FitPlace)) store.place = raw.place as FitPlace;
  const plan = Array.isArray(raw.plan)
    ? raw.plan.map(cleanPlan).filter((p): p is WorkoutPlan => p !== null)
    : [];
  if (plan.length > 0) store.plan = plan.slice(0, MAX_PLANS);
  const seen = new Set<string>();
  const custom = Array.isArray(raw.custom)
    ? raw.custom
        .map(cleanCustom)
        .filter((r): r is CustomRoutine => r !== null && !seen.has(r.id) && !!seen.add(r.id))
    : [];
  if (custom.length > 0) store.custom = custom.slice(0, MAX_CUSTOM);
  const program = cleanProgram(raw.program);
  if (program) store.program = program;
  const gear = cleanGear(raw.gear);
  if (gear && (gear.items.length > 0 || gear.weights.length > 0 || gear.last)) store.gear = gear;
  return store;
}

const isWeekday = (d: unknown): d is number =>
  typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6;

const cleanDays = (days: unknown[]): number[] =>
  [...new Set(days.filter(isWeekday))].sort((a, b) => a - b);

function cleanPlan(v: unknown): WorkoutPlan | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (typeof p.routineId !== 'string' || !p.routineId || !Array.isArray(p.days)) return null;
  const days = cleanDays(p.days);
  return days.length > 0 ? { routineId: p.routineId.slice(0, 40), days } : null;
}

/** Pure: replace a routine's weekdays (empty removes it from the plan). */
export function setRoutineDays(
  store: WorkoutStore,
  routineId: string,
  days: number[],
): WorkoutStore {
  const clean = cleanDays(days);
  const rest = (store.plan ?? []).filter((p) => p.routineId !== routineId);
  const plan = clean.length > 0 ? [...rest, { routineId, days: clean }] : rest;
  const next: WorkoutStore = { ...store, plan: plan.slice(0, MAX_PLANS) };
  if (next.plan?.length === 0) delete next.plan;
  return next;
}

export function routineDays(store: WorkoutStore, routineId: string): number[] {
  return store.plan?.find((p) => p.routineId === routineId)?.days ?? [];
}

/** Routines scheduled on a local day key ("YYYY-M-D"), program session first. */
export function plannedOn(store: WorkoutStore, dayKey: string): string[] {
  const [y, m, d] = dayKey.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  if (!Number.isFinite(wd)) return [];
  const planned = (store.plan ?? []).filter((p) => p.days.includes(wd)).map((p) => p.routineId);
  const session = programOn(store.program, dayKey);
  return session ? [session, ...planned] : planned;
}

export interface WeekGoal {
  done: number;
  goal: number;
  /** 0–100. */
  pct: number;
  /** True when the goal comes from the schedule, not the default. */
  planned: boolean;
}

/** This week's workouts against the scheduled sessions (or the default goal). */
export function weekGoal(store: WorkoutStore, now: number = Date.now()): WeekGoal {
  const sessions =
    (store.plan ?? []).reduce((sum, p) => sum + p.days.length, 0) +
    (isProgramActive(store.program, now) ? store.program.weekdays.length : 0);
  const goal = sessions > 0 ? sessions : DEFAULT_WEEK_GOAL;
  const done = weekSummary(store.log, now).count;
  return { done, goal, pct: Math.min(100, Math.round((done / goal) * 100)), planned: sessions > 0 };
}

/** Worth a card on Today: something is scheduled or trained in the last 2 weeks. */
export function isMoving(store: WorkoutStore, now: number = Date.now()): boolean {
  if ((store.plan ?? []).length > 0 || isProgramActive(store.program, now)) return true;
  const since = now - 14 * 86_400_000;
  return store.log.some((e) => e.startedAt >= since);
}

/**
 * Sets per muscle over the last `days` days: 1 for the main muscle,
 * 0.5 for each secondary one. Feeds the body map heat levels.
 */
export function muscleLoad(
  log: WorkoutEntry[],
  days: number,
  now: number = Date.now(),
): Partial<Record<Muscle, number>> {
  const since = now - days * 86_400_000;
  const out: Partial<Record<Muscle, number>> = {};
  for (const e of log) {
    if (e.startedAt < since || e.startedAt > now) continue;
    const cardio = cardioKindOf(e.routineId);
    if (cardio) {
      const load = cardioLoad(e.durationSec);
      CARDIO_MUSCLES[cardio].forEach((m, i) => {
        out[m] = (out[m] ?? 0) + (i === 0 ? load : load / 2);
      });
    }
    for (const s of e.sets) {
      const ex = getExercise(s.ex);
      if (!ex) continue;
      ex.muscles.forEach((m, i) => {
        out[m] = (out[m] ?? 0) + (i === 0 ? 1 : 0.5);
      });
    }
  }
  return out;
}

/** 0 = untouched, 1–3 = relative to the most worked muscle. */
export function heatLevels(
  load: Partial<Record<Muscle, number>>,
): Partial<Record<Muscle, 0 | 1 | 2 | 3>> {
  const max = Math.max(0, ...Object.values(load).map((v) => v ?? 0));
  const out: Partial<Record<Muscle, 0 | 1 | 2 | 3>> = {};
  for (const m of MUSCLES) {
    const v = load[m] ?? 0;
    out[m] =
      v <= 0 || max <= 0 ? 0 : (Math.min(3, Math.max(1, Math.ceil((v / max) * 3))) as 1 | 2 | 3);
  }
  return out;
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
