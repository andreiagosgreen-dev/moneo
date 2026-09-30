/* Move module: pure workout-player state machine.
 *
 * Timers are wall-clock (`endsAt`), so a run survives re-renders, tab
 * switches and a backgrounded phone without drifting. The UI only ticks
 * `now` and calls these transitions.
 */
import { exerciseStep, getExercise, getRoutine, setWorkSec, type RoutineStep } from './library';
import { FREE_RUN_ID, MAX_CUSTOM_STEPS } from './custom';
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
  /** Steps of a custom routine or free workout; built-ins resolve by id. */
  steps?: RoutineStep[];
  /** Free workout: exercises are added one at a time while training. */
  free?: true;
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

export function runSteps(run: RunState): RoutineStep[] {
  return run.steps ?? getRoutine(run.routineId)?.steps ?? [];
}

export function currentStep(run: RunState): RoutineStep | undefined {
  return runSteps(run)[run.stepIdx];
}

export function nextStep(run: RunState): RoutineStep | undefined {
  return runSteps(run)[run.stepIdx + 1];
}

/** A free workout waiting for its next exercise. */
export function isPicking(run: RunState): boolean {
  return run.free === true && run.phase === 'work' && currentStep(run) === undefined;
}

/** Resets the timer and (on a new exercise) the input drafts. */
function prep(run: RunState, log: WorkoutEntry[], keepInputs: boolean): RunState {
  const step = currentStep(run);
  if (!step) return { ...run, restEndsAt: undefined, timer: undefined };
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

/** Starts a built-in routine, or a custom one when its `steps` are given. */
export function startRun(
  routineId: string,
  now: number,
  log: WorkoutEntry[],
  steps?: RoutineStep[],
): RunState | null {
  const list = steps ?? getRoutine(routineId)?.steps;
  if (!list || list.length === 0) return null;
  const base: RunState = {
    routineId,
    startedAt: now,
    stepIdx: 0,
    setIdx: 0,
    phase: 'work',
    sets: [],
    reps: '',
    kg: '',
  };
  if (steps) base.steps = steps.map((s) => ({ ...s }));
  return prep(base, log, false);
}

export function startFreeRun(now: number): RunState {
  return {
    routineId: FREE_RUN_ID,
    steps: [],
    free: true,
    startedAt: now,
    stepIdx: 0,
    setIdx: 0,
    phase: 'work',
    sets: [],
    reps: '',
    kg: '',
  };
}

/** Free workout: queue an exercise; starts it right away when none is active. */
export function addFreeStep(run: RunState, exId: string, log: WorkoutEntry[]): RunState {
  if (!run.free || run.phase === 'done' || !getExercise(exId)) return run;
  const steps = runSteps(run);
  if (steps.length >= MAX_CUSTOM_STEPS) return run;
  const next: RunState = { ...run, steps: [...steps, exerciseStep(exId)] };
  return isPicking(run) ? { ...prep(next, log, false), phase: 'work' } : next;
}

function done(run: RunState, now: number): RunState {
  return { ...run, phase: 'done', finishedAt: now, timer: undefined, restEndsAt: undefined };
}

/** Free workout past its last exercise: back to the picker. */
function toPicker(run: RunState): RunState {
  return {
    ...run,
    stepIdx: runSteps(run).length,
    setIdx: 0,
    phase: 'work',
    timer: undefined,
    restEndsAt: undefined,
  };
}

/** Logs a set and moves on: next set, next exercise (after rest) or done. */
export function logSet(run: RunState, set: WorkoutSet, now: number, log: WorkoutEntry[]): RunState {
  const steps = runSteps(run);
  const step = currentStep(run);
  if (!step || run.phase !== 'work') return run;
  const base: RunState = { ...run, sets: [...run.sets, set] };
  let next: RunState;
  if (run.setIdx + 1 < step.sets) {
    next = prep({ ...base, setIdx: run.setIdx + 1 }, log, true);
  } else if (run.stepIdx + 1 < steps.length) {
    next = prep({ ...base, stepIdx: run.stepIdx + 1, setIdx: 0 }, log, false);
  } else if (run.free) {
    return toPicker(base);
  } else {
    return done(base, now);
  }
  return step.restSec > 0
    ? { ...next, phase: 'rest', restEndsAt: now + step.restSec * 1000 }
    : { ...next, phase: 'work' };
}

export function skipExercise(run: RunState, now: number, log: WorkoutEntry[]): RunState {
  const steps = runSteps(run);
  if (run.phase === 'done' || (run.free && isPicking(run))) return run;
  if (run.stepIdx + 1 >= steps.length) return run.free ? toPicker(run) : done(run, now);
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
  const steps = runSteps(run);
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
