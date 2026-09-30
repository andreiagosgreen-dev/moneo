import { afterEach, describe, expect, it } from 'vitest';
import {
  currentStep,
  endRest,
  finishRun,
  getActiveRun,
  logSet,
  pauseTimer,
  repsSet,
  restLeftMs,
  runProgress,
  setActiveRun,
  shouldSwitchSides,
  skipExercise,
  startRun,
  startTimer,
  timedSet,
  timerLeftMs,
  type RunState,
} from './player';
import type { WorkoutEntry } from './workouts';

const T0 = 1_800_000_000_000;

afterEach(() => setActiveRun(null));

function toStep(run: RunState, exId: string): RunState {
  let r = run;
  for (let i = 0; i < 20 && currentStep(r)?.ex !== exId; i++) r = skipExercise(r, T0, []);
  return r;
}

describe('workout player', () => {
  it('starts on the first exercise with the planned reps', () => {
    const run = startRun('home20', T0, [])!;
    expect(run.phase).toBe('work');
    expect(currentStep(run)?.ex).toBe('squat');
    expect(run.reps).toBe('15');
    expect(run.timer).toBeUndefined();
    expect(startRun('nope', T0, [])).toBeNull();
  });

  it('logs a set, rests, then keeps the edited reps for the next set', () => {
    let run = startRun('home20', T0, [])!;
    run = { ...run, reps: '12' };
    run = logSet(run, repsSet(run)!, T0, []);
    expect(run.sets).toEqual([{ ex: 'squat', reps: 12 }]);
    expect(run.phase).toBe('rest');
    expect(run.setIdx).toBe(1);
    expect(restLeftMs(run, T0 + 5_000)).toBe(20_000);
    expect(run.reps).toBe('12');
    run = endRest(run);
    expect(run.phase).toBe('work');
  });

  it('moves to the next exercise after the last set and resets the inputs', () => {
    let run = startRun('home20', T0, [])!;
    for (let i = 0; i < 3; i++)
      run = endRest(logSet({ ...run, reps: '9' }, repsSet({ ...run, reps: '9' })!, T0, []));
    expect(currentStep(run)?.ex).toBe('pushup');
    expect(run.setIdx).toBe(0);
    expect(run.reps).toBe('10');
    expect(runProgress(run)).toEqual({ done: 3, total: 19 });
  });

  it('runs a wall-clock timer for timed holds', () => {
    let run = toStep(startRun('homeCore', T0, [])!, 'plank');
    expect(timerLeftMs(run, T0)).toBe(40_000);
    run = startTimer(run, T0);
    expect(timerLeftMs(run, T0 + 15_000)).toBe(25_000);
    run = pauseTimer(run, T0 + 15_000);
    expect(timerLeftMs(run, T0 + 99_000)).toBe(25_000);
    expect(timedSet(run, T0 + 99_000)).toEqual({ ex: 'plank', sec: 15 });
  });

  it('cues switching sides half-way through a per-side hold', () => {
    let run = toStep(startRun('yogaMorning', T0, [])!, 'warrior2');
    run = startTimer(run, T0);
    expect(shouldSwitchSides(run, T0 + 30_000)).toBe(false);
    expect(shouldSwitchSides(run, T0 + 46_000)).toBe(true);
  });

  it('prefills the last weight used for an exercise', () => {
    const log: WorkoutEntry[] = [
      {
        id: 'a',
        routineId: 'gymFull',
        day: '2026-9-28',
        startedAt: T0 - 1e6,
        durationSec: 1800,
        sets: [{ ex: 'backSquat', reps: 8, kg: 70 }],
      },
    ];
    const run = startRun('gymFull', T0, log)!;
    expect(run.kg).toBe('70');
    expect(repsSet({ ...run, kg: '72,5', reps: '8' })).toEqual({
      ex: 'backSquat',
      reps: 8,
      kg: 72.5,
    });
    expect(repsSet({ ...run, kg: '', reps: 'x' })).toEqual({ ex: 'backSquat' });
  });

  it('finishes when the last exercise is skipped or on demand', () => {
    const run = startRun('homeCore', T0, [])!;
    const early = finishRun(run, T0 + 60_000);
    expect(early.phase).toBe('done');
    expect(early.finishedAt).toBe(T0 + 60_000);
    let r = run;
    for (let i = 0; i < 5; i++) r = skipExercise(r, T0 + 1, []);
    expect(r.phase).toBe('done');
    expect(runProgress(r).done).toBe(runProgress(r).total);
  });

  it('parks the run outside React', () => {
    const run = startRun('home20', T0, [])!;
    setActiveRun(run);
    expect(getActiveRun()).toBe(run);
  });
});
