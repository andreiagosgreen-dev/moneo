import { describe, expect, it, beforeEach } from 'vitest';
import {
  EQUIPMENT,
  EXERCISES,
  FIT_PLACES,
  FIT_TYPES,
  MUSCLES,
  ROUTINES,
  exerciseAlternatives,
  exerciseSteps,
  filterExercises,
  fitKey,
  getExercise,
  routineMinutes,
  setWorkSec,
  type FitLevel,
} from './library';
import {
  DEFAULT_WEEK_GOAL,
  MAX_WORKOUTS,
  addWorkout,
  findFitnessHabit,
  heatLevels,
  isMoving,
  lastWeight,
  loadWorkouts,
  markHabitDone,
  muscleLoad,
  newWorkoutEntry,
  plannedOn,
  routineDays,
  sanitizeWorkoutStore,
  saveWorkouts,
  setRoutineDays,
  weekGoal,
  weekSummary,
  workoutVolume,
  type WorkoutEntry,
} from './workouts';
import { en } from '../i18n/locales/en';
import { ro } from '../i18n/locales/ro';
import { ru } from '../i18n/locales/ru';
import { uk } from '../i18n/locales/uk';
import { de } from '../i18n/locales/de';
import { fr } from '../i18n/locales/fr';
import { es } from '../i18n/locales/es';
import { it as itLocale } from '../i18n/locales/it';
import type { Habit } from '../habits';

const LOCALES: Record<string, Record<string, string>> = {
  en,
  ro,
  ru,
  uk,
  de,
  fr,
  es,
  it: itLocale,
};

const habit = (over: Partial<Habit>): Habit => ({
  id: over.id ?? 'h1',
  name: over.name ?? 'Read',
  frequency: 'daily',
  targetPerWeek: 7,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const entry = (over: Partial<WorkoutEntry>): WorkoutEntry => ({
  id: over.id ?? 'w1',
  routineId: 'home20',
  day: '2026-9-30',
  startedAt: over.startedAt ?? new Date(2026, 8, 30, 8).getTime(),
  durationSec: 1200,
  sets: [],
  ...over,
});

describe('exercise library', () => {
  it('has 120+ exercises with unique ids, covering every place, type and muscle', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(120);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const p of FIT_PLACES) {
      expect(EXERCISES.filter((e) => e.places.includes(p)).length, p).toBeGreaterThanOrEqual(30);
    }
    for (const t of FIT_TYPES) {
      expect(EXERCISES.filter((e) => e.type === t).length, t).toBeGreaterThanOrEqual(5);
    }
    for (const m of MUSCLES) {
      expect(
        EXERCISES.some((e) => e.muscles[0] === m),
        m,
      ).toBe(true);
    }
    for (const q of EQUIPMENT) {
      expect(
        EXERCISES.some((e) => e.equipment === q),
        q,
      ).toBe(true);
    }
  });

  it('keeps the original ids so old workout logs still resolve', () => {
    for (const id of ['squat', 'pushup', 'plank', 'benchPress', 'deadlift', 'downDog', 'child']) {
      expect(getExercise(id), id).toBeDefined();
    }
  });

  it('every exercise is well formed', () => {
    for (const e of EXERCISES) {
      expect(e.places.length, e.id).toBeGreaterThan(0);
      expect(e.muscles.length, e.id).toBeGreaterThan(0);
      expect(new Set(e.muscles).size, e.id).toBe(e.muscles.length);
      expect([1, 2, 3], e.id).toContain(e.level);
    }
  });

  it('every exercise has a dose that matches its mode', () => {
    for (const e of EXERCISES) {
      if (e.mode === 'reps') expect(e.reps).toBeGreaterThan(0);
      else expect(e.sec).toBeGreaterThan(0);
      expect(e.sets).toBeGreaterThan(0);
    }
  });

  it('ships routines for every place that only use known exercises', () => {
    expect(ROUTINES.length).toBeGreaterThanOrEqual(11);
    for (const p of FIT_PLACES) {
      expect(
        ROUTINES.some((r) => r.places.includes(p)),
        p,
      ).toBe(true);
    }
    for (const r of ROUTINES) {
      expect(r.steps.length).toBeGreaterThan(0);
      for (const s of r.steps) {
        const e = getExercise(s.ex);
        expect(e, `${r.id} → ${s.ex}`).toBeDefined();
        expect(s.sets).toBeGreaterThan(0);
        expect(setWorkSec(s)).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the minutes promised in routine names', () => {
    const mins = Object.fromEntries(ROUTINES.map((r) => [r.id, routineMinutes(r)]));
    expect(Math.abs(mins.home20 - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(mins.homeCore - 10)).toBeLessThanOrEqual(1);
    expect(Math.abs(mins.yogaMorning - 15)).toBeLessThanOrEqual(1);
    expect(Math.abs(mins.stretchEvening - 10)).toBeLessThanOrEqual(1);
    expect(mins.gymFull).toBeGreaterThan(mins.homeCore);
  });

  it('every text key exists in all 8 locales', () => {
    const keys = [
      ...EXERCISES.flatMap((e) => [fitKey.exName(e.id), fitKey.exCue(e.id), fitKey.exTip(e.id)]),
      ...ROUTINES.flatMap((r) => [fitKey.rtName(r.id), fitKey.rtDesc(r.id)]),
      ...FIT_PLACES.map(fitKey.place),
      ...FIT_TYPES.map(fitKey.type),
      ...MUSCLES.map(fitKey.muscle),
      ...EQUIPMENT.map(fitKey.eq),
      ...([1, 2, 3] as FitLevel[]).map(fitKey.level),
    ];
    for (const [name, dict] of Object.entries(LOCALES)) {
      for (const k of keys) {
        expect(typeof dict[k], `${name}: ${k}`).toBe('string');
        expect(dict[k].length, `${name}: ${k}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('library queries', () => {
  it('filters by place, type, muscle and equipment together', () => {
    const home = filterExercises({ place: 'home' });
    expect(home.every((e) => e.places.includes('home'))).toBe(true);
    const gymChest = filterExercises({ place: 'gym', type: 'strength', muscle: 'chest' });
    expect(gymChest.length).toBeGreaterThan(0);
    expect(gymChest.every((e) => e.type === 'strength' && e.muscles.includes('chest'))).toBe(true);
    expect(filterExercises({ equipment: 'kettlebell' }).map((e) => e.id)).toContain('kbSwing');
    expect(filterExercises({})).toHaveLength(EXERCISES.length);
  });

  it('searches translated names without caring about accents or case', () => {
    const names: Record<string, string> = { pushup: 'Flotări', squat: 'Genuflexiuni' };
    const nameOf = (id: string) => names[id] ?? id;
    expect(filterExercises({ query: 'flotari' }, nameOf).map((e) => e.id)).toEqual(['pushup']);
    expect(filterExercises({ query: '  GENU ' }, nameOf).map((e) => e.id)).toEqual(['squat']);
    expect(filterExercises({ query: 'zzz' }, nameOf)).toEqual([]);
  });

  it('suggests alternatives with the same main muscle', () => {
    const push = getExercise('pushup')!;
    const alts = exerciseAlternatives(push);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(4);
    expect(alts.every((a) => a.id !== push.id && a.muscles[0] === push.muscles[0])).toBe(true);
  });

  it('steps one level down or up within the same type and main muscle', () => {
    for (const e of EXERCISES) {
      const { easier, harder } = exerciseSteps(e);
      if (easier) {
        expect(easier.level, e.id).toBe(e.level - 1);
        expect(easier.muscles[0], e.id).toBe(e.muscles[0]);
      }
      if (harder) {
        expect(harder.level, e.id).toBe(e.level + 1);
        expect(harder.type, e.id).toBe(e.type);
      }
    }
    expect(exerciseSteps(getExercise('pushup')!).easier).toBeDefined();
  });
});

describe('weekly plan', () => {
  it('sets, cleans and removes a routine schedule', () => {
    let store = setRoutineDays({ log: [] }, 'home20', [3, 1, 1, 9, -1]);
    expect(routineDays(store, 'home20')).toEqual([1, 3]);
    store = setRoutineDays(store, 'yogaMorning', [0]);
    expect(store.plan).toHaveLength(2);
    store = setRoutineDays(store, 'home20', []);
    expect(routineDays(store, 'home20')).toEqual([]);
    expect(setRoutineDays(store, 'yogaMorning', []).plan).toBeUndefined();
  });

  it('knows what is planned on a given day', () => {
    const store = setRoutineDays(setRoutineDays({ log: [] }, 'home20', [1, 3]), 'gymFull', [3]);
    expect(plannedOn(store, '2026-9-30')).toEqual(['home20', 'gymFull']); // Wednesday
    expect(plannedOn(store, '2026-9-29')).toEqual([]); // Tuesday
    expect(plannedOn(store, 'junk')).toEqual([]);
  });

  it('uses scheduled sessions as the weekly goal, else the default', () => {
    const now = new Date(2026, 8, 30, 20).getTime();
    const log = [entry({ id: 'a' }), entry({ id: 'b' })];
    expect(weekGoal({ log }, now)).toEqual({
      done: 2,
      goal: DEFAULT_WEEK_GOAL,
      pct: 67,
      planned: false,
    });
    const planned = setRoutineDays({ log }, 'home20', [1, 3, 5, 6]);
    expect(weekGoal(planned, now)).toEqual({ done: 2, goal: 4, pct: 50, planned: true });
  });

  it('shows the Today card only when there is a plan or recent training', () => {
    const now = new Date(2026, 8, 30, 20).getTime();
    expect(isMoving({ log: [] }, now)).toBe(false);
    expect(isMoving(setRoutineDays({ log: [] }, 'home20', [1]), now)).toBe(true);
    expect(isMoving({ log: [entry({})] }, now)).toBe(true);
    const old = entry({ startedAt: now - 20 * 86_400_000 });
    expect(isMoving({ log: [old] }, now)).toBe(false);
  });

  it('keeps place and plan through sanitising, dropping junk', () => {
    const clean = sanitizeWorkoutStore({
      log: [],
      place: 'gym',
      plan: [
        { routineId: 'home20', days: [5, 1, 'x', 8] },
        { routineId: '', days: [1] },
        { routineId: 'yogaMorning', days: [] },
        null,
      ],
    });
    expect(clean).toEqual({ log: [], place: 'gym', plan: [{ routineId: 'home20', days: [1, 5] }] });
    expect(sanitizeWorkoutStore({ log: [], place: 'moon' }).place).toBeUndefined();
  });
});

describe('body map load', () => {
  it('counts the main muscle fully and secondary ones by half, within the window', () => {
    const now = new Date(2026, 8, 30, 20).getTime();
    const push = getExercise('pushup')!;
    const log = [
      entry({ sets: [{ ex: 'pushup' }, { ex: 'pushup' }, { ex: 'unknown' }] }),
      entry({ id: 'old', startedAt: now - 10 * 86_400_000, sets: [{ ex: 'squat' }] }),
    ];
    const load = muscleLoad(log, 7, now);
    expect(load[push.muscles[0]]).toBe(2);
    if (push.muscles[1]) expect(load[push.muscles[1]]).toBe(1);
    expect(load.quads).toBeUndefined();
    expect(muscleLoad(log, 30, now).quads).toBeGreaterThan(0);
  });

  it('turns load into 0–3 levels relative to the most worked muscle', () => {
    const lv = heatLevels({ chest: 6, triceps: 3, abs: 0.5 });
    expect(lv.chest).toBe(3);
    expect(lv.triceps).toBe(2);
    expect(lv.abs).toBe(1);
    expect(lv.calves).toBe(0);
    expect(Object.keys(heatLevels({}))).toHaveLength(MUSCLES.length);
  });
});

describe('workout log', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips through storage and drops junk', () => {
    const store = addWorkout({ log: [] }, entry({ sets: [{ ex: 'squat', reps: 15 }] }));
    saveWorkouts({ ...store, habitId: 'h1' });
    expect(loadWorkouts()).toEqual({ ...store, habitId: 'h1' });

    const dirty = sanitizeWorkoutStore({
      log: [
        entry({}),
        { id: 1 },
        null,
        entry({ id: 'w2', sets: [{ ex: '' }, { ex: 'plank', sec: -4 }] }),
      ],
      habitId: 7,
    });
    expect(dirty.log.map((e) => e.id)).toEqual(['w1', 'w2']);
    expect(dirty.log[1].sets).toEqual([{ ex: 'plank' }]);
    expect(dirty.habitId).toBeUndefined();
    expect(sanitizeWorkoutStore('nope')).toEqual({ log: [] });
  });

  it('caps the log', () => {
    let store = { log: [] as WorkoutEntry[] };
    for (let i = 0; i < MAX_WORKOUTS + 3; i++) store = addWorkout(store, entry({ id: `w${i}` }));
    expect(store.log).toHaveLength(MAX_WORKOUTS);
    expect(store.log[0].id).toBe('w3');
  });

  it('summarises only the current week (Monday start)', () => {
    const now = new Date(2026, 8, 30, 20).getTime(); // Wednesday
    const log = [
      entry({ id: 'a', startedAt: new Date(2026, 8, 28, 7).getTime(), day: '2026-9-28' }), // Mon
      entry({ id: 'b', startedAt: new Date(2026, 8, 30, 7).getTime(), durationSec: 600 }),
      entry({ id: 'c', startedAt: new Date(2026, 8, 30, 18).getTime(), durationSec: 600 }),
      entry({ id: 'old', startedAt: new Date(2026, 8, 27, 7).getTime(), day: '2026-9-27' }), // Sun before
    ];
    expect(weekSummary(log, now)).toEqual({ count: 3, minutes: 40, days: 2 });
  });

  it('computes volume and remembers the last weight', () => {
    const sets = [
      { ex: 'benchPress', reps: 8, kg: 60 },
      { ex: 'benchPress', reps: 6, kg: 62.5 },
      { ex: 'plank', sec: 40 },
    ];
    expect(workoutVolume(sets)).toBe(855);
    expect(lastWeight([entry({ sets })], 'benchPress')).toBe(62.5);
    expect(lastWeight([entry({ sets })], 'squat')).toBeUndefined();
  });

  it('newWorkoutEntry stamps day and duration', () => {
    const start = new Date(2026, 8, 30, 8, 0).getTime();
    const e = newWorkoutEntry('yogaMorning', start, [], start + 15 * 60_000);
    expect(e.day).toBe('2026-9-30');
    expect(e.durationSec).toBe(900);
    expect(e.id).toBeTruthy();
  });
});

describe('habit link', () => {
  it('prefers the remembered habit, then fitness icons, then names', () => {
    const read = habit({ id: 'read', name: 'Read' });
    const gym = habit({ id: 'gym', name: 'Sală', icon: undefined });
    const lift = habit({ id: 'lift', name: 'Strength', icon: '🏋️' });
    expect(findFitnessHabit([read, gym, lift])?.id).toBe('lift');
    expect(findFitnessHabit([read, gym])?.id).toBe('gym');
    expect(findFitnessHabit([read, gym, lift], 'read')?.id).toBe('read');
    expect(findFitnessHabit([read])).toBeUndefined();
    expect(findFitnessHabit([habit({ id: 'y', name: 'Yoga', archived: true })])).toBeUndefined();
  });

  it('marks a habit done once, without toggling it back off', () => {
    const once = markHabitDone({}, 'h1', '2026-9-30');
    expect(once.h1).toEqual(['2026-9-30']);
    expect(markHabitDone(once, 'h1', '2026-9-30')).toBe(once);
  });
});
