import { describe, expect, it, beforeEach } from 'vitest';
import {
  EXERCISES,
  FIT_CATEGORIES,
  ROUTINES,
  fitKey,
  getExercise,
  routineMinutes,
  setWorkSec,
} from './library';
import {
  MAX_WORKOUTS,
  addWorkout,
  findFitnessHabit,
  lastWeight,
  loadWorkouts,
  markHabitDone,
  newWorkoutEntry,
  sanitizeWorkoutStore,
  saveWorkouts,
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
  it('has 36 exercises with unique ids across the 4 categories', () => {
    expect(EXERCISES).toHaveLength(36);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(36);
    for (const c of FIT_CATEGORIES) {
      expect(EXERCISES.filter((e) => e.category === c).length).toBeGreaterThanOrEqual(8);
    }
  });

  it('every exercise has a dose that matches its mode', () => {
    for (const e of EXERCISES) {
      if (e.mode === 'reps') expect(e.reps).toBeGreaterThan(0);
      else expect(e.sec).toBeGreaterThan(0);
      expect(e.sets).toBeGreaterThan(0);
    }
  });

  it('ships 6 routines that only use known exercises', () => {
    expect(ROUTINES).toHaveLength(6);
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
      ...EXERCISES.flatMap((e) => [fitKey.exName(e.id), fitKey.exCue(e.id)]),
      ...ROUTINES.flatMap((r) => [fitKey.rtName(r.id), fitKey.rtDesc(r.id)]),
      ...FIT_CATEGORIES.map(fitKey.cat),
      ...EXERCISES.map((e) => fitKey.muscle(e.muscle)),
      ...EXERCISES.map((e) => fitKey.eq(e.equipment)),
    ];
    for (const [name, dict] of Object.entries(LOCALES)) {
      for (const k of keys) {
        expect(typeof dict[k], `${name}: ${k}`).toBe('string');
        expect(dict[k].length, `${name}: ${k}`).toBeGreaterThan(0);
      }
    }
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
