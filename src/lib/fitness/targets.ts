/* Move module: exercise goals and per-exercise reports.
 *
 * A target is "N reps (or minutes) of one exercise per day / week / month /
 * year", counted from the workout log. A target can be mirrored as a Goal at
 * the matching level (Day / Week / Month / 1 year); its progress is kept in
 * sync from here, so it rolls up like any other goal.
 */
import { updateGoal, type Goal, type GoalLevel } from '../goals';
import { getExercise } from './library';
import type { WorkoutEntry } from './workouts';

export type TargetPeriod = 'day' | 'week' | 'month' | 'year';
export const TARGET_PERIODS: readonly TargetPeriod[] = ['day', 'week', 'month', 'year'];
export const PERIOD_GOAL_LEVEL: Record<TargetPeriod, GoalLevel> = {
  day: 'daily',
  week: 'weekly',
  month: 'project',
  year: 'vision',
};

/** Reps for reps exercises, seconds for timed ones. */
export type TargetMetric = 'reps' | 'sec';

export interface ExerciseTarget {
  id: string;
  ex: string;
  /** In the exercise's metric (reps, or seconds for timed exercises). */
  amount: number;
  period: TargetPeriod;
  /** Mirrored Goal, when the user added it to Goals. */
  goalId?: string;
  createdAt: number;
}

export const MAX_TARGETS = 30;
/** Free accounts keep two exercise goals; Pro has no limit. */
export const FREE_TARGETS = 2;

export const metricOf = (exId: string): TargetMetric =>
  getExercise(exId)?.mode === 'time' ? 'sec' : 'reps';

const MAX_AMOUNT = { reps: 1_000_000, sec: 10_000_000 };

export function cleanTargets(v: unknown): ExerciseTarget[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: ExerciseTarget[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as Record<string, unknown>;
    if (typeof t.id !== 'string' || !t.id || seen.has(t.id)) continue;
    if (typeof t.ex !== 'string' || !getExercise(t.ex)) continue;
    if (!TARGET_PERIODS.includes(t.period as TargetPeriod)) continue;
    const amount =
      typeof t.amount === 'number' && Number.isFinite(t.amount) ? Math.round(t.amount) : 0;
    if (amount <= 0 || amount > MAX_AMOUNT[metricOf(t.ex)]) continue;
    seen.add(t.id);
    out.push({
      id: t.id.slice(0, 40),
      ex: t.ex,
      amount,
      period: t.period as TargetPeriod,
      ...(typeof t.goalId === 'string' && t.goalId ? { goalId: t.goalId.slice(0, 64) } : {}),
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : 0,
    });
  }
  return out.slice(0, MAX_TARGETS);
}

export function newTarget(
  ex: string,
  amount: number,
  period: TargetPeriod,
  now: number = Date.now(),
): ExerciseTarget {
  return {
    id: `t-${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    ex,
    amount: Math.max(1, Math.round(amount)),
    period,
    createdAt: now,
  };
}

/** [start, end) of the current period in local time; weeks start on Monday. */
export function periodRange(period: TargetPeriod, now: number = Date.now()): [number, number] {
  const d = new Date(now);
  if (period === 'year') {
    return [
      new Date(d.getFullYear(), 0, 1).getTime(),
      new Date(d.getFullYear() + 1, 0, 1).getTime(),
    ];
  }
  if (period === 'month') {
    return [
      new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
      new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
    ];
  }
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === 'day') {
    return [day.getTime(), new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()];
  }
  const back = (day.getDay() + 6) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  return [
    start.getTime(),
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getTime(),
  ];
}

export interface ExerciseTotals {
  reps: number;
  sec: number;
  sets: number;
  sessions: number;
  bestReps: number;
  bestSec: number;
  maxKg: number;
  /** kg × reps. */
  volume: number;
}

const EMPTY: ExerciseTotals = {
  reps: 0,
  sec: 0,
  sets: 0,
  sessions: 0,
  bestReps: 0,
  bestSec: 0,
  maxKg: 0,
  volume: 0,
};

/** Everything logged for one exercise in workouts started within [from, to). */
export function exerciseTotals(
  log: WorkoutEntry[],
  ex: string,
  from = -Infinity,
  to = Infinity,
): ExerciseTotals {
  const out = { ...EMPTY };
  for (const e of log) {
    if (e.startedAt < from || e.startedAt >= to) continue;
    let used = false;
    for (const s of e.sets) {
      if (s.ex !== ex) continue;
      used = true;
      out.sets += 1;
      const reps = s.reps ?? 0;
      const sec = s.sec ?? 0;
      out.reps += reps;
      out.sec += sec;
      out.bestReps = Math.max(out.bestReps, reps);
      out.bestSec = Math.max(out.bestSec, sec);
      if (typeof s.kg === 'number') {
        out.maxKg = Math.max(out.maxKg, s.kg);
        out.volume += s.kg * reps;
      }
    }
    if (used) out.sessions += 1;
  }
  out.volume = Math.round(out.volume);
  return out;
}

export const metricValue = (t: ExerciseTotals, m: TargetMetric) => (m === 'sec' ? t.sec : t.reps);

/**
 * What a report shows for an exercise: time for timed exercises, reps for reps
 * exercises, but time when a reps exercise was only done on a timer (warm-ups,
 * circuit stations without typed reps).
 */
export function displayMetric(exId: string, t: ExerciseTotals): TargetMetric {
  const m = metricOf(exId);
  return m === 'reps' && t.reps === 0 && t.sec > 0 ? 'sec' : m;
}

export interface TargetProgress {
  done: number;
  amount: number;
  /** 0-100. */
  pct: number;
}

export function targetProgress(
  log: WorkoutEntry[],
  target: ExerciseTarget,
  now: number = Date.now(),
): TargetProgress {
  const [from, to] = periodRange(target.period, now);
  const done = metricValue(exerciseTotals(log, target.ex, from, to), metricOf(target.ex));
  return {
    done,
    amount: target.amount,
    pct: Math.min(100, Math.round((done / Math.max(1, target.amount)) * 100)),
  };
}

/** Last `count` weeks or months (oldest first) of one exercise, in its metric. */
export function exerciseHistory(
  log: WorkoutEntry[],
  ex: string,
  unit: 'week' | 'month',
  count: number,
  now: number = Date.now(),
): { start: number; value: number }[] {
  const out: { start: number; value: number }[] = [];
  const metric = metricOf(ex);
  let [start, end] = periodRange(unit, now);
  for (let i = 0; i < count; i++) {
    out.unshift({ start, value: metricValue(exerciseTotals(log, ex, start, end), metric) });
    end = start;
    const d = new Date(start);
    start =
      unit === 'week'
        ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7).getTime()
        : new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  }
  return out;
}

/** Exercises trained in [from, to), most sets first. */
export function trainedExercises(
  log: WorkoutEntry[],
  from = -Infinity,
  to = Infinity,
): { ex: string; totals: ExerciseTotals }[] {
  const ids = new Set<string>();
  for (const e of log) {
    if (e.startedAt < from || e.startedAt >= to) continue;
    for (const s of e.sets) if (getExercise(s.ex)) ids.add(s.ex);
  }
  return (
    [...ids]
      .map((ex) => ({ ex, totals: exerciseTotals(log, ex, from, to) }))
      // Sets skipped straight away (no reps, no time) are not training.
      .filter(({ totals }) => totals.reps > 0 || totals.sec > 0)
      .sort((a, b) => b.totals.sets - a.totals.sets || a.ex.localeCompare(b.ex))
  );
}

/** Report ranges offered in the UI. */
export type ReportRange = 'd7' | 'd30' | 'year' | 'all';
export const REPORT_RANGES: readonly ReportRange[] = ['d7', 'd30', 'year', 'all'];
/** Free accounts see the last 7 and 30 days; the year and all time are Pro. */
export const PRO_RANGES: readonly ReportRange[] = ['year', 'all'];

export function reportRange(range: ReportRange, now: number = Date.now()): [number, number] {
  const d = new Date(now);
  const endOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  if (range === 'all') return [-Infinity, Infinity];
  if (range === 'year') return periodRange('year', now);
  const days = range === 'd7' ? 7 : 30;
  return [new Date(d.getFullYear(), d.getMonth(), d.getDate() - (days - 1)).getTime(), endOfToday];
}

/**
 * Mirrors target progress into linked Goals. Returns the same array when
 * nothing changed, so it is safe to run in an effect.
 */
export function syncExerciseGoals(
  goals: Goal[],
  targets: ExerciseTarget[] | undefined,
  log: WorkoutEntry[],
  now: number = Date.now(),
): Goal[] {
  let next = goals;
  for (const t of targets ?? []) {
    if (!t.goalId) continue;
    const goal = next.find((g) => g.id === t.goalId);
    if (!goal || goal.archived) continue;
    const { pct } = targetProgress(log, t, now);
    if (goal.progress !== pct) next = updateGoal(next, goal.id, { progress: pct });
  }
  return next;
}
