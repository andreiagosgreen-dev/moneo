import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import type { TKey } from '../i18n/types';
import {
  FREE_RUN_ID,
  MAX_CUSTOM,
  MAX_CUSTOM_STEPS,
  cleanCustom,
  cleanStep,
  deleteCustom,
  newCustomRoutine,
  resolveRoutine,
  routineTitle,
  stepsFromSets,
  upsertCustom,
} from './custom';
import { exerciseStep } from './library';
import {
  addFreeStep,
  currentStep,
  finishRun,
  isPicking,
  logSet,
  repsSet,
  runProgress,
  setActiveRun,
  skipExercise,
  startFreeRun,
  startRun,
} from './player';
import { e1rm, exerciseBests, exerciseProgress, newRecords, progressKind } from './records';
import { sanitizeWorkoutStore, type WorkoutEntry, type WorkoutStore } from './workouts';

const T0 = 1_800_000_000_000;
const DAY = 86_400_000;
const t = (k: TKey) => en[k];

afterEach(() => setActiveRun(null));

const entry = (id: string, at: number, sets: WorkoutEntry['sets']): WorkoutEntry => ({
  id,
  routineId: 'home20',
  day: '2027-1-1',
  startedAt: at,
  durationSec: 600,
  sets,
});

describe('custom routines', () => {
  it('clamps steps and drops unknown exercises', () => {
    expect(cleanStep({ ex: 'nope', sets: 3 })).toBeNull();
    expect(cleanStep({ ex: 'squat', sets: 99, reps: 0, restSec: -5 })).toEqual({
      ex: 'squat',
      sets: 10,
      reps: 1,
      restSec: 0,
    });
    expect(cleanStep({ ex: 'plank', sets: 2, sec: 1, restSec: 30 })).toEqual({
      ex: 'plank',
      sets: 2,
      sec: 5,
      restSec: 30,
    });
  });

  it('needs a c- id, a name and at least one valid step', () => {
    expect(cleanCustom({ id: 'home20', name: 'x', steps: [exerciseStep('squat')] })).toBeNull();
    expect(cleanCustom({ id: 'c-1', name: '  ', steps: [exerciseStep('squat')] })).toBeNull();
    expect(cleanCustom({ id: 'c-1', name: 'Legs', steps: [{ ex: 'nope' }] })).toBeNull();
    const r = newCustomRoutine('  Legs day ', [exerciseStep('squat'), exerciseStep('plank')])!;
    expect(r.id).toMatch(/^c-/);
    expect(r.name).toBe('Legs day');
    expect(r.steps.map((s) => s.ex)).toEqual(['squat', 'plank']);
  });

  it('upserts up to the cap, deletes with its schedule, survives sanitize', () => {
    const r = newCustomRoutine('Legs', [exerciseStep('squat')])!;
    let store: WorkoutStore = upsertCustom({ log: [] }, r);
    store = upsertCustom(store, { ...r, name: 'Legs 2' });
    expect(store.custom).toEqual([{ ...r, name: 'Legs 2' }]);
    store = {
      ...store,
      plan: [
        { routineId: r.id, days: [1] },
        { routineId: 'home20', days: [3] },
      ],
    };
    expect(sanitizeWorkoutStore(JSON.parse(JSON.stringify(store))).custom).toEqual(store.custom);

    const gone = deleteCustom(store, r.id);
    expect(gone.custom).toBeUndefined();
    expect(gone.plan).toEqual([{ routineId: 'home20', days: [3] }]);

    let full: WorkoutStore = { log: [] };
    for (let i = 0; i < MAX_CUSTOM + 2; i++) {
      full = upsertCustom(full, newCustomRoutine(`R${i}`, [exerciseStep('squat')])!);
    }
    expect(full.custom).toHaveLength(MAX_CUSTOM);
  });

  it('sanitize drops broken and duplicate routines', () => {
    const r = newCustomRoutine('Legs', [exerciseStep('squat')])!;
    const clean = sanitizeWorkoutStore({ log: [], custom: [r, r, { id: 'c-x' }, 'junk'] });
    expect(clean.custom).toEqual([r]);
  });

  it('resolves built-in, custom and unknown ids with a readable title', () => {
    const r = newCustomRoutine('Legs', [exerciseStep('plank'), exerciseStep('squat')])!;
    const store = upsertCustom({ log: [] }, r);
    expect(resolveRoutine(store, 'home20')?.id).toBe('home20');
    const res = resolveRoutine(store, r.id)!;
    expect(res.icon).toBe('plank');
    expect(res.steps).toHaveLength(2);
    expect(resolveRoutine(store, 'c-gone')).toBeUndefined();
    expect(routineTitle(t, store, r.id)).toBe('Legs');
    expect(routineTitle(t, store, FREE_RUN_ID)).toBe('Free workout');
    expect(routineTitle(t, store, 'c-gone')).toBe('Workout');
  });

  it('turns logged sets into steps, one per run of the same exercise', () => {
    const steps = stepsFromSets([
      { ex: 'squat', reps: 12 },
      { ex: 'squat', reps: 15 },
      { ex: 'plank', sec: 30 },
      { ex: 'plank', sec: 45 },
      { ex: 'nope', reps: 3 },
      { ex: 'squat', reps: 10 },
    ]);
    expect(steps.map((s) => [s.ex, s.sets, s.reps ?? s.sec])).toEqual([
      ['squat', 2, 15],
      ['plank', 2, 45],
      ['squat', 1, 10],
    ]);
  });
});

describe('player with custom steps and free workouts', () => {
  it('runs a custom routine from its own steps', () => {
    const steps = [
      { ex: 'plank', sets: 1, sec: 20, restSec: 0 },
      { ex: 'squat', sets: 1, reps: 8, restSec: 0 },
    ];
    let run = startRun('c-abc', T0, [], steps)!;
    expect(run.steps).toEqual(steps);
    expect(currentStep(run)?.ex).toBe('plank');
    run = skipExercise(run, T0, []);
    expect(run.reps).toBe('8');
    run = logSet(run, repsSet(run)!, T0, []);
    expect(run.phase).toBe('done');
    expect(run.sets).toEqual([{ ex: 'squat', reps: 8 }]);
  });

  it('free workout: pick, log, back to the picker, finish', () => {
    let run = startFreeRun(T0);
    expect(run.routineId).toBe(FREE_RUN_ID);
    expect(isPicking(run)).toBe(true);
    expect(addFreeStep(run, 'nope', [])).toBe(run);

    run = addFreeStep(run, 'gobletSquat', [entry('w', T0 - DAY, [{ ex: 'gobletSquat', kg: 16 }])]);
    expect(isPicking(run)).toBe(false);
    expect(currentStep(run)?.ex).toBe('gobletSquat');
    expect(run.kg).toBe('16');

    const sets = currentStep(run)!.sets;
    for (let i = 0; i < sets; i++) {
      run = logSet(run, repsSet(run)!, T0 + i, []);
      if (run.phase === 'rest') run = { ...run, phase: 'work', restEndsAt: undefined };
    }
    expect(isPicking(run)).toBe(true);
    expect(run.sets).toHaveLength(sets);

    run = addFreeStep(run, 'plank', []);
    expect(currentStep(run)?.ex).toBe('plank');
    run = skipExercise(run, T0, []);
    expect(isPicking(run)).toBe(true);
    expect(skipExercise(run, T0, [])).toBe(run);
    expect(runProgress(run).done).toBe(runProgress(run).total);

    run = finishRun(run, T0 + 60_000);
    expect(run.phase).toBe('done');
  });

  it('free workout caps the number of exercises', () => {
    let run = startFreeRun(T0);
    for (let i = 0; i < MAX_CUSTOM_STEPS + 3; i++) run = addFreeStep(run, 'squat', []);
    expect(run.steps).toHaveLength(MAX_CUSTOM_STEPS);
  });
});

describe('records', () => {
  it('estimates 1RM with Epley and caps high reps', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(60, 5)).toBe(70);
    expect(e1rm(40, 30)).toBe(e1rm(40, 12));
    expect(e1rm(0, 5)).toBeUndefined();
    expect(e1rm(50, 0)).toBeUndefined();
  });

  it('keeps the best value per metric and counts sessions', () => {
    const log = [
      entry('b', T0 + DAY, [
        { ex: 'gobletSquat', reps: 8, kg: 20 },
        { ex: 'gobletSquat', reps: 10, kg: 18 },
      ]),
      entry('a', T0, [
        { ex: 'gobletSquat', reps: 12, kg: 16 },
        { ex: 'plank', sec: 40 },
      ]),
    ];
    const bests = exerciseBests(log);
    const g = bests.get('gobletSquat')!;
    expect(g).toMatchObject({ kg: 20, reps: 12, sessions: 2 });
    expect(g.e1rm).toBe(e1rm(20, 8));
    expect(progressKind(g)).toBe('e1rm');
    expect(progressKind(bests.get('plank'))).toBe('sec');
    expect(progressKind(undefined)).toBeUndefined();
  });

  it('reports only real improvements, one per exercise', () => {
    const before = [
      entry('a', T0, [
        { ex: 'gobletSquat', reps: 10, kg: 16 },
        { ex: 'plank', sec: 40 },
        { ex: 'squat', reps: 15 },
      ]),
    ];
    const next = entry('b', T0 + DAY, [
      { ex: 'gobletSquat', reps: 10, kg: 18 },
      { ex: 'gobletSquat', reps: 12, kg: 18 },
      { ex: 'plank', sec: 35 },
      { ex: 'squat', reps: 20 },
      { ex: 'pushup', reps: 30 },
    ]);
    expect(newRecords(before, next)).toEqual([
      { ex: 'gobletSquat', kind: 'e1rm', value: e1rm(18, 12), prev: e1rm(16, 10) },
      { ex: 'squat', kind: 'reps', value: 20, prev: 15 },
    ]);
    expect(newRecords([], next)).toEqual([]);
  });

  it('charts the best value per workout, oldest first', () => {
    const log = [
      entry('c', T0 + 2 * DAY, [{ ex: 'plank', sec: 60 }]),
      entry('a', T0, [{ ex: 'plank', sec: 30 }]),
      entry('b', T0 + DAY, [
        { ex: 'plank', sec: 45 },
        { ex: 'plank', sec: 50 },
      ]),
      entry('d', T0 + 3 * DAY, [{ ex: 'squat', reps: 10 }]),
    ];
    expect(exerciseProgress(log, 'plank', 'sec')).toEqual([
      { at: T0, value: 30 },
      { at: T0 + DAY, value: 50 },
      { at: T0 + 2 * DAY, value: 60 },
    ]);
  });
});
