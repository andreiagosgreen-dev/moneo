/* Move module: pure workout-player state machine.
 *
 * Timers are wall-clock (`endsAt`), so a run survives re-renders, tab
 * switches and a backgrounded phone without drifting. The UI only ticks
 * `now` and calls these transitions.
 */
import { getExercise, getRoutine, setWorkSec, type RoutineStep } from './library';
import { lastWeight, type WorkoutEntry, type WorkoutSet } from './workouts';

export type RunPhase = 'work' | 'rest' | 'done';

export interface RunTimer {
  /** Remaining work time while paused / before start. */
  leftMs: number;
  /** Set while running. */
  endsAt?: number;
}

export interface RunState {
  routineId: string;
  startedAt: number;
  stepIdx: number;
  setIdx: number;
  phase: RunPhase;
  sets: WorkoutSet[];
  restEndsAt?: number;
  timer?: RunTimer;
  /** Input drafts for the current set (strings, like the inputs). */
  reps: string;
  kg: string;
  finishedAt?: number;
}

export function currentStep(run: RunState): RoutineStep | undefined {
  return getRoutine(run.routineId)?.steps[run.stepIdx];
}

export function nextStep(run: RunState): RoutineStep | undefined {
  return getRoutine(run.routineId)?.steps[run.stepIdx + 1];
}

/** Resets the timer and (on a new exercise) the input drafts. */
function prep(run: RunState, log: WorkoutEntry[], keepInputs: boolean): RunState {
  const step = currentStep(run);
  if (!step) return run;
  const out: RunState = {
    ...run,
    restEndsAt: undefined,
    timer: typeof step.sec === 'number' ? { leftMs: setWorkSec(step) * 1000 } : undefined,
  };
  if (keepInputs) return out;
  out.reps = typeof step.reps === 'number' ? String(step.reps) : '';
  out.kg = '';
  if (getExercise(step.ex)?.weighted) {
    const inRun = [...run.sets].reverse().find((s) => s.ex === step.ex && typeof s.kg === 'number');
    const kg = inRun?.kg ?? lastWeight(log, step.ex);
    if (kg !== undefined) out.kg = String(kg);
  }
  return out;
}

export function startRun(routineId: string, now: number, log: WorkoutEntry[]): RunState | null {
  const routine = getRoutine(routineId);
  if (!routine || routine.steps.length === 0) return null;
  return prep(
    { routineId, startedAt: now, stepIdx: 0, setIdx: 0, phase: 'work', sets: [], reps: '', kg: '' },
    log,
    false,
  );
}

function done(run: RunState, now: number): RunState {
  return { ...run, phase: 'done', finishedAt: now, timer: undefined, restEndsAt: undefined };
}

/** Logs a set and moves on: next set, next exercise (after rest) or done. */
export function logSet(run: RunState, set: WorkoutSet, now: number, log: WorkoutEntry[]): RunState {
  const routine = getRoutine(run.routineId);
  const step = currentStep(run);
  if (!routine || !step || run.phase !== 'work') return run;
  const base: RunState = { ...run, sets: [...run.sets, set] };
  let next: RunState;
  if (run.setIdx + 1 < step.sets) {
    next = prep({ ...base, setIdx: run.setIdx + 1 }, log, true);
  } else if (run.stepIdx + 1 < routine.steps.length) {
    next = prep({ ...base, stepIdx: run.stepIdx + 1, setIdx: 0 }, log, false);
  } else {
    return done(base, now);
  }
  return step.restSec > 0
    ? { ...next, phase: 'rest', restEndsAt: now + step.restSec * 1000 }
    : { ...next, phase: 'work' };
}

export function skipExercise(run: RunState, now: number, log: WorkoutEntry[]): RunState {
  const routine = getRoutine(run.routineId);
  if (!routine || run.phase === 'done') return run;
  if (run.stepIdx + 1 >= routine.steps.length) return done(run, now);
  return { ...prep({ ...run, stepIdx: run.stepIdx + 1, setIdx: 0 }, log, false), phase: 'work' };
}

export function endRest(run: RunState): RunState {
  return run.phase === 'rest' ? { ...run, phase: 'work', restEndsAt: undefined } : run;
}

export function finishRun(run: RunState, now: number): RunState {
  return run.phase === 'done' ? run : done(run, now);
}

export function timerLeftMs(run: RunState, now: number): number {
  const tm = run.timer;
  if (!tm) return 0;
  return tm.endsAt !== undefined ? Math.max(0, tm.endsAt - now) : tm.leftMs;
}

export function restLeftMs(run: RunState, now: number): number {
  return run.phase === 'rest' && run.restEndsAt !== undefined
    ? Math.max(0, run.restEndsAt - now)
    : 0;
}

export function startTimer(run: RunState, now: number): RunState {
  const tm = run.timer;
  if (!tm || tm.endsAt !== undefined || run.phase !== 'work') return run;
  return { ...run, timer: { leftMs: tm.leftMs, endsAt: now + tm.leftMs } };
}

export function pauseTimer(run: RunState, now: number): RunState {
  const tm = run.timer;
  if (!tm || tm.endsAt === undefined) return run;
  return { ...run, timer: { leftMs: Math.max(0, tm.endsAt - now) } };
}

/** The set a time-mode exercise logs: seconds actually held so far. */
export function timedSet(run: RunState, now: number): WorkoutSet | null {
  const step = currentStep(run);
  if (!step || !run.timer) return null;
  const held = Math.round((setWorkSec(step) * 1000 - timerLeftMs(run, now)) / 1000);
  return { ex: step.ex, sec: Math.max(0, held) };
}

/** The set a reps-mode exercise logs from the input drafts. */
export function repsSet(run: RunState): WorkoutSet | null {
  const step = currentStep(run);
  if (!step) return null;
  const set: WorkoutSet = { ex: step.ex };
  const reps = Number.parseInt(run.reps, 10);
  if (Number.isFinite(reps) && reps > 0) set.reps = Math.min(1000, reps);
  const kg = Number.parseFloat(run.kg.replace(',', '.'));
  if (getExercise(step.ex)?.weighted && Number.isFinite(kg) && kg >= 0) {
    set.kg = Math.min(1000, Math.round(kg * 10) / 10);
  }
  return set;
}

/** Half-way cue for "per side" holds. */
export function shouldSwitchSides(run: RunState, now: number): boolean {
  const step = currentStep(run);
  if (!step || !run.timer || run.timer.endsAt === undefined || !getExercise(step.ex)?.sides) {
    return false;
  }
  return timerLeftMs(run, now) <= (setWorkSec(step) * 1000) / 2;
}

/** Sets finished / planned, for the progress bar. */
export function runProgress(run: RunState): { done: number; total: number } {
  const steps = getRoutine(run.routineId)?.steps ?? [];
  const total = steps.reduce((sum, s) => sum + s.sets, 0);
  if (run.phase === 'done') return { done: total, total };
  const before = steps.slice(0, run.stepIdx).reduce((sum, s) => sum + s.sets, 0);
  return { done: Math.min(total, before + run.setIdx), total };
}

/* The run in progress lives outside React so switching tabs doesn't lose it. */
let active: RunState | null = null;

export function getActiveRun(): RunState | null {
  return active;
}

export function setActiveRun(run: RunState | null): void {
  active = run;
}
