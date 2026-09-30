/* Move module: the user's own routines and the free workout.
 *
 * Custom routines live in the workout store (`custom`), so they travel with
 * the export and Pro account sync. Building and saving them is Pro; starting
 * one that already exists stays available if Pro lapses.
 */
import type { TKey } from '../i18n/types';
import {
  exerciseStep,
  fitKey,
  getExercise,
  getRoutine,
  type Routine,
  type RoutineStep,
} from './library';
import type { WorkoutSet, WorkoutStore } from './workouts';

export interface CustomRoutine {
  id: string;
  name: string;
  steps: RoutineStep[];
}

/** Routine id of a workout picked exercise by exercise. */
export const FREE_RUN_ID = 'free';
export const MAX_CUSTOM = 20;
export const MAX_CUSTOM_STEPS = 20;
export const MAX_ROUTINE_NAME = 60;
const CUSTOM_PREFIX = 'c-';

export const isCustomId = (id: string) => id.startsWith(CUSTOM_PREFIX);

const int = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(max, Math.max(min, Math.round(v)))
    : undefined;

/** Keeps a step inside sane bounds; drops unknown exercises. */
export function cleanStep(v: unknown): RoutineStep | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  const ex = typeof s.ex === 'string' ? getExercise(s.ex) : undefined;
  if (!ex) return null;
  const out: RoutineStep = {
    ex: ex.id,
    sets: int(s.sets, 1, 10) ?? ex.sets,
    restSec: int(s.restSec, 0, 600) ?? 0,
  };
  if (ex.mode === 'time') out.sec = int(s.sec, 5, 3600) ?? ex.sec ?? 30;
  else out.reps = int(s.reps, 1, 200) ?? ex.reps ?? 10;
  return out;
}

export function cleanCustom(v: unknown): CustomRoutine | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isCustomId(r.id) || r.id.length > 40) return null;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, MAX_ROUTINE_NAME) : '';
  const steps = Array.isArray(r.steps)
    ? r.steps.map(cleanStep).filter((s): s is RoutineStep => s !== null)
    : [];
  if (!name || steps.length === 0) return null;
  return { id: r.id, name, steps: steps.slice(0, MAX_CUSTOM_STEPS) };
}

export function newCustomRoutine(name: string, steps: RoutineStep[]): CustomRoutine | null {
  return cleanCustom({ id: CUSTOM_PREFIX + crypto.randomUUID(), name, steps });
}

/** Pure: add or replace a routine (new ones go last, past the cap they're refused). */
export function upsertCustom(store: WorkoutStore, routine: CustomRoutine): WorkoutStore {
  const list = store.custom ?? [];
  const i = list.findIndex((r) => r.id === routine.id);
  if (i < 0 && list.length >= MAX_CUSTOM) return store;
  const next = i < 0 ? [...list, routine] : list.map((r, j) => (j === i ? routine : r));
  return { ...store, custom: next };
}

/** Pure: remove a routine and its schedule; past workouts keep their entries. */
export function deleteCustom(store: WorkoutStore, id: string): WorkoutStore {
  const next: WorkoutStore = { ...store, custom: (store.custom ?? []).filter((r) => r.id !== id) };
  if (next.custom?.length === 0) delete next.custom;
  if (store.plan) {
    const plan = store.plan.filter((p) => p.routineId !== id);
    if (plan.length > 0) next.plan = plan;
    else delete next.plan;
  }
  return next;
}

export function getCustom(store: WorkoutStore, id: string): CustomRoutine | undefined {
  return store.custom?.find((r) => r.id === id);
}

/** A built-in or custom routine in the shape the player and cards use. */
export function resolveRoutine(store: WorkoutStore, id: string): Routine | undefined {
  const builtIn = getRoutine(id);
  if (builtIn) return builtIn;
  const c = getCustom(store, id);
  if (!c) return undefined;
  const first = getExercise(c.steps[0].ex);
  const places = [...new Set(c.steps.flatMap((s) => getExercise(s.ex)?.places ?? []))];
  return {
    id: c.id,
    places,
    type: first?.type ?? 'strength',
    icon: first?.pose ?? 'squat',
    steps: c.steps,
  };
}

/** Display name for any routine id found in the log or the plan. */
export function routineTitle(t: (key: TKey) => string, store: WorkoutStore, id: string): string {
  if (getRoutine(id)) return t(fitKey.rtName(id));
  if (id === FREE_RUN_ID) return t('fit.free.name');
  return getCustom(store, id)?.name ?? t('fit.d.habitName');
}

/** Turns what was logged into routine steps: one step per run of the same exercise. */
export function stepsFromSets(sets: WorkoutSet[]): RoutineStep[] {
  const out: RoutineStep[] = [];
  for (const s of sets) {
    const last = out[out.length - 1];
    if (last && last.ex === s.ex) {
      last.sets = Math.min(10, last.sets + 1);
      if (typeof s.reps === 'number' && typeof last.reps === 'number') {
        last.reps = Math.max(last.reps, s.reps);
      }
      if (typeof s.sec === 'number' && typeof last.sec === 'number') {
        last.sec = Math.max(last.sec, s.sec);
      }
      continue;
    }
    if (!getExercise(s.ex)) continue;
    const base = exerciseStep(s.ex);
    const next = cleanStep({ ...base, sets: 1, reps: s.reps ?? base.reps, sec: s.sec ?? base.sec });
    if (next) out.push(next);
  }
  return out.slice(0, MAX_CUSTOM_STEPS);
}
