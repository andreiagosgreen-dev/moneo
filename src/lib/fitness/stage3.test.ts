import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import type { TKey, Vars } from '../i18n/types';
import {
  cardioId,
  cardioKindOf,
  cardioLoad,
  cardioPace,
  newCardioEntry,
  paceClock,
} from './cardio';
import { resolveRoutine, routineTitle } from './custom';
import { getExercise, routineMinutes } from './library';
import {
  PROGRAM_DAYS,
  PROGRAM_GOALS,
  PROGRAM_MINUTES,
  buildProgram,
  cleanProgram,
  isProgramActive,
  isProgramFinished,
  mondayOf,
  programOn,
  programPool,
  programSchedule,
  programSteps,
  programWeek,
  progressStep,
  type ProgramAnswers,
} from './program';
import {
  muscleLoad,
  plannedOn,
  sanitizeWorkoutStore,
  weekGoal,
  type WorkoutStore,
} from './workouts';

const t = (k: TKey, vars?: Vars) =>
  en[k].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? ''));

/** Monday 4 January 2027, 10:00 local. */
const MON = new Date(2027, 0, 4, 10).getTime();
const DAY = 86_400_000;
const WEEK = 7 * DAY;

const answers = (over: Partial<ProgramAnswers> = {}): ProgramAnswers => ({
  goal: 'general',
  level: 2,
  place: 'home',
  gear: [],
  days: 3,
  minutes: 30,
  weeks: 6,
  ...over,
});

describe('cardio log', () => {
  it('recognises cardio ids', () => {
    expect(cardioKindOf(cardioId('run'))).toBe('run');
    expect(cardioKindOf('cardio-swim')).toBeUndefined();
    expect(cardioKindOf('home20')).toBeUndefined();
  });

  it('computes pace on foot and speed on a bike', () => {
    expect(cardioPace('run', 30 * 60, 5)).toEqual({ unit: 'perKm', sec: 360 });
    expect(paceClock(330)).toBe('5:30');
    expect(cardioPace('cycle', 60 * 60, 20.5)).toEqual({ unit: 'kmh', kmh: 20.5 });
    expect(cardioPace('walk', 1800)).toBeUndefined();
    expect(cardioPace('walk', 1800, 0)).toBeUndefined();
  });

  it('ends a session logged for today now and puts past days at noon', () => {
    const today = newCardioEntry({
      kind: 'run',
      minutes: 30,
      km: 5.123,
      dayKey: '2027-1-4',
      todayKey: '2027-1-4',
      now: MON,
    });
    expect(today).toMatchObject({
      routineId: 'cardio-run',
      day: '2027-1-4',
      startedAt: MON - 30 * 60_000,
      durationSec: 1800,
      sets: [],
      km: 5.12,
    });
    const past = newCardioEntry({
      kind: 'hike',
      minutes: 120,
      dayKey: '2027-1-2',
      todayKey: '2027-1-4',
      now: MON,
    });
    expect(past?.startedAt).toBe(new Date(2027, 0, 2, 12).getTime());
    expect(past?.km).toBeUndefined();
  });

  it('refuses unusable time and future days', () => {
    const base = { kind: 'walk' as const, dayKey: '2027-1-4', todayKey: '2027-1-4', now: MON };
    expect(newCardioEntry({ ...base, minutes: 0 })).toBeNull();
    expect(newCardioEntry({ ...base, minutes: Number.NaN })).toBeNull();
    expect(newCardioEntry({ ...base, minutes: 24 * 60 + 1 })).toBeNull();
    expect(newCardioEntry({ ...base, minutes: 20, dayKey: '2027-1-6' })).toBeNull();
  });

  it('keeps km through sanitize and feeds the body map', () => {
    const entry = newCardioEntry({
      kind: 'run',
      minutes: 45,
      km: 8,
      dayKey: '2027-1-4',
      todayKey: '2027-1-4',
      now: MON,
    })!;
    const store = sanitizeWorkoutStore({ log: [entry, { ...entry, id: 'x', km: -3 }] });
    expect(store.log[0].km).toBe(8);
    expect(store.log[1].km).toBeUndefined();
    const load = muscleLoad(store.log.slice(0, 1), 7, MON);
    expect(load.quads).toBe(cardioLoad(2700));
    expect(load.calves).toBe(cardioLoad(2700) / 2);
    expect(load.chest).toBeUndefined();
  });

  it('titles cardio entries by activity', () => {
    expect(routineTitle(t, { log: [] }, 'cardio-cycle')).toBe('Ride');
  });
});

describe('personal program', () => {
  it('only uses exercises that fit the place, gear and level', () => {
    const a = answers({ place: 'home', gear: ['dumbbell'], level: 1 });
    const p = buildProgram(a, MON)!;
    const pool = new Set(programPool(a).map((e) => e.id));
    for (const s of p.sessions) {
      for (const st of s.steps) {
        const ex = getExercise(st.ex)!;
        expect(pool.has(ex.id)).toBe(true);
        expect(ex.level).toBe(1);
        expect(['none', 'mat', 'chair', 'dumbbell']).toContain(ex.equipment);
        expect(ex.places).toContain('home');
      }
    }
  });

  it('builds a usable program for every goal, place, days and minutes', () => {
    for (const goal of PROGRAM_GOALS)
      for (const place of ['home', 'outdoor', 'gym'] as const)
        for (const days of PROGRAM_DAYS)
          for (const minutes of PROGRAM_MINUTES) {
            const p = buildProgram(answers({ goal, place, days, minutes, level: 1 }), MON);
            expect(p, `${goal}/${place}/${days}/${minutes}`).not.toBeNull();
            for (const s of p!.sessions) expect(s.steps.length).toBeGreaterThanOrEqual(3);
          }
  });

  it('is deterministic and varies sessions', () => {
    const a = answers({ goal: 'strength', place: 'gym', level: 3 });
    expect(buildProgram(a, MON)).toEqual(buildProgram(a, MON));
    const [A, B] = buildProgram(a, MON)!.sessions;
    const shared = A.steps.filter((s) => B.steps.some((x) => x.ex === s.ex));
    expect(shared.length).toBeLessThan(A.steps.length);
  });

  it('splits upper/lower from 4 days and fills the weekdays', () => {
    const p = buildProgram(answers({ goal: 'strength', days: 4, place: 'gym' }), MON)!;
    expect(p.sessions.map((s) => s.focus)).toEqual(['upper', 'lower']);
    expect(p.weekdays).toEqual([1, 2, 4, 5]);
    expect([...programSchedule(p).entries()]).toEqual([
      [1, 'p-A'],
      [2, 'p-B'],
      [4, 'p-A'],
      [5, 'p-B'],
    ]);
    const general = buildProgram(answers({ days: 3 }), MON)!;
    expect(general.sessions.map((s) => s.focus)).toEqual(['full', 'cond', 'mobility']);
  });

  it('fits the session length to the minutes asked', () => {
    const short = buildProgram(answers({ place: 'gym', minutes: 15 }), MON)!;
    const long = buildProgram(answers({ place: 'gym', minutes: 60 }), MON)!;
    const len = (steps: (typeof short.sessions)[0]['steps']) =>
      routineMinutes({ id: '', places: [], type: 'strength', icon: 'squat', steps });
    expect(long.sessions[0].steps.length).toBeGreaterThan(short.sessions[0].steps.length);
    expect(len(long.sessions[0].steps)).toBeGreaterThan(len(short.sessions[0].steps));
  });

  it('starts on this Monday and ends after the chosen weeks', () => {
    const p = buildProgram(answers({ weeks: 4 }), MON + 2 * DAY)!;
    expect(p.startedAt).toBe(mondayOf(MON));
    expect(programWeek(p, MON)).toBe(0);
    expect(programWeek(p, MON + 3 * WEEK + 6 * DAY)).toBe(3);
    expect(isProgramActive(p, MON + 3 * WEEK)).toBe(true);
    expect(isProgramActive(p, MON + 4 * WEEK)).toBe(false);
    expect(isProgramFinished(p, MON + 4 * WEEK)).toBe(true);
    expect(isProgramActive(p, MON - WEEK)).toBe(false);
  });

  it('progresses reps or seconds weekly and adds a set in the second half', () => {
    const reps = { ex: 'squat', sets: 3, reps: 10, restSec: 45 };
    expect(progressStep(reps, 0, 6)).toEqual(reps);
    expect(progressStep(reps, 2, 6)).toEqual({ ...reps, reps: 12 });
    expect(progressStep(reps, 3, 6)).toEqual({ ...reps, sets: 4, reps: 13 });
    expect(progressStep(reps, 7, 8)).toEqual({ ...reps, sets: 4, reps: 14 });
    const hold = { ex: 'plank', sets: 2, sec: 30, restSec: 10 };
    expect(progressStep(hold, 1, 4)).toEqual({ ...hold, sec: 35 });
    expect(progressStep(hold, 2, 4)).toEqual({ ...hold, sets: 3, sec: 40 });
  });

  it('plans program days, counts them in the week goal and resolves this week', () => {
    const program = buildProgram(answers({ days: 3, weeks: 4 }), MON)!;
    const store: WorkoutStore = { log: [], program, plan: [{ routineId: 'home20', days: [1] }] };
    expect(plannedOn(store, '2027-1-4')).toEqual(['p-A', 'home20']);
    expect(plannedOn(store, '2027-1-5')).toEqual([]);
    expect(plannedOn(store, '2027-1-6')).toEqual(['p-B']);
    expect(programOn(program, '2027-2-1')).toBeUndefined();
    expect(weekGoal(store, MON).goal).toBe(4);
    expect(weekGoal(store, MON + 5 * WEEK).goal).toBe(1);

    const week1 = resolveRoutine(store, 'p-A', MON)!;
    const week3 = resolveRoutine(store, 'p-A', MON + 2 * WEEK)!;
    expect(week1.steps).toEqual(program.sessions[0].steps);
    expect(week3.steps).toEqual(programSteps(program, 'p-A', MON + 2 * WEEK));
    expect(week3.steps).not.toEqual(week1.steps);
    expect(resolveRoutine(store, 'p-Z', MON)).toBeUndefined();
    expect(resolveRoutine({ log: [] }, 'p-A', MON)).toBeUndefined();
  });

  it('titles sessions and survives sanitize', () => {
    const program = buildProgram(answers(), MON)!;
    const store = sanitizeWorkoutStore(JSON.parse(JSON.stringify({ log: [], program })));
    expect(store.program).toEqual(program);
    expect(routineTitle(t, store, 'p-A')).toBe('Program A: Full body');
    expect(routineTitle(t, { log: [] }, 'p-B')).toBe('Program B');
    expect(cleanProgram({ ...program, answers: { ...program.answers, goal: 'x' } })).toBeNull();
    expect(
      cleanProgram({ ...program, sessions: [{ key: 'A', focus: 'full', steps: [] }] }),
    ).toBeNull();
    expect(
      cleanProgram({
        ...program,
        answers: { ...program.answers, days: 9, gear: ['barbell', 'band'] },
      })?.answers,
    ).toMatchObject({ days: 3, gear: ['band'] });
  });
});
