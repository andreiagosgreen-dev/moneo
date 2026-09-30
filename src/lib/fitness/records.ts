/* Move module: personal records and per-exercise progress (Pro views). */
import type { WorkoutEntry, WorkoutSet } from './workouts';

export type RecordKind = 'e1rm' | 'kg' | 'reps' | 'sec';

/** Epley is unreliable past this many reps; higher sets count as this many. */
const E1RM_MAX_REPS = 12;
const MAX_POINTS = 30;

/** Estimated one-rep max (Epley), rounded to 0.5 kg. */
export function e1rm(kg: number, reps: number): number | undefined {
  if (!(kg > 0) || !(reps > 0)) return undefined;
  const r = Math.min(E1RM_MAX_REPS, Math.round(reps));
  const est = r === 1 ? kg : kg * (1 + r / 30);
  return Math.round(est * 2) / 2;
}

export interface ExerciseBest {
  ex: string;
  kg?: number;
  e1rm?: number;
  reps?: number;
  sec?: number;
  /** When a best was last improved. */
  at: number;
  /** Workouts that included the exercise. */
  sessions: number;
}

function setValue(s: WorkoutSet, kind: RecordKind): number | undefined {
  switch (kind) {
    case 'e1rm':
      return s.kg !== undefined && s.reps !== undefined ? e1rm(s.kg, s.reps) : undefined;
    case 'kg':
      return s.kg !== undefined && s.kg > 0 ? s.kg : undefined;
    case 'reps':
      return s.reps !== undefined && s.reps > 0 ? s.reps : undefined;
    case 'sec':
      return s.sec !== undefined && s.sec > 0 ? s.sec : undefined;
  }
}

const KINDS: readonly RecordKind[] = ['e1rm', 'kg', 'reps', 'sec'];

/** Best value of every metric per exercise, oldest workout first. */
export function exerciseBests(log: WorkoutEntry[]): Map<string, ExerciseBest> {
  const out = new Map<string, ExerciseBest>();
  const ordered = log.slice().sort((a, b) => a.startedAt - b.startedAt);
  for (const w of ordered) {
    const seen = new Set<string>();
    for (const s of w.sets) {
      const b = out.get(s.ex) ?? { ex: s.ex, at: w.startedAt, sessions: 0 };
      if (!seen.has(s.ex)) {
        seen.add(s.ex);
        b.sessions += 1;
      }
      for (const k of KINDS) {
        const v = setValue(s, k);
        if (v !== undefined && v > (b[k] ?? 0)) {
          b[k] = v;
          b.at = w.startedAt;
        }
      }
      out.set(s.ex, b);
    }
  }
  return out;
}

export interface NewRecord {
  ex: string;
  kind: RecordKind;
  value: number;
  prev: number;
}

/**
 * Records a just-finished workout beats. Only improvements over an earlier
 * value count (the first time you do an exercise is not a "record"); one per
 * exercise, the most telling metric first.
 */
export function newRecords(before: WorkoutEntry[], entry: WorkoutEntry): NewRecord[] {
  const bests = exerciseBests(before);
  const out: NewRecord[] = [];
  const done = new Set<string>();
  for (const s of entry.sets) {
    if (done.has(s.ex)) continue;
    const prev = bests.get(s.ex);
    if (!prev) continue;
    for (const kind of KINDS) {
      const old = prev[kind];
      const best = Math.max(
        0,
        ...entry.sets.filter((x) => x.ex === s.ex).map((x) => setValue(x, kind) ?? 0),
      );
      if (old !== undefined && best > old) {
        out.push({ ex: s.ex, kind, value: best, prev: old });
        done.add(s.ex);
        break;
      }
    }
  }
  return out;
}

/** The metric that best describes progress on an exercise, from what was logged. */
export function progressKind(best: ExerciseBest | undefined): RecordKind | undefined {
  if (!best) return undefined;
  if (best.e1rm !== undefined) return 'e1rm';
  if (best.reps !== undefined) return 'reps';
  if (best.sec !== undefined) return 'sec';
  return undefined;
}

export interface ProgressPoint {
  at: number;
  value: number;
}

/** Best value per workout for one exercise (latest 30 workouts). */
export function exerciseProgress(
  log: WorkoutEntry[],
  ex: string,
  kind: RecordKind,
): ProgressPoint[] {
  const points: ProgressPoint[] = [];
  for (const w of log.slice().sort((a, b) => a.startedAt - b.startedAt)) {
    let best = 0;
    for (const s of w.sets) {
      if (s.ex !== ex) continue;
      best = Math.max(best, setValue(s, kind) ?? 0);
    }
    if (best > 0) points.push({ at: w.startedAt, value: best });
  }
  return points.slice(-MAX_POINTS);
}
