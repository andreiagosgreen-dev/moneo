/**
 * "Your first steps": three small wins for a new user's first days, shown
 * instead of the full app all at once.
 *
 *   1. task  — write one thing to finish today
 *   2. focus — finish one focus round
 *   3. try   — a quick workout or an AI plan
 *
 * Three out of three unlocks a colour theme. Only new users see it: an
 * account created in the last week, or (without an account) a device that
 * started with no data. Hidden once done (after a short celebration) or
 * dismissed.
 */
import { safeRead, safeWrite } from './storage/storageAdapter';
import { STORAGE_KEYS } from './storage/storageKeys';
import type { Atmosphere } from '../mono/atmosphere';

export type FirstStepId = 'task' | 'focus' | 'try';
export const FIRST_STEPS: readonly FirstStepId[] = ['task', 'focus', 'try'];

/** The theme three wins unlock (also an Apprentice reward, just earlier). */
export const FIRST_STEPS_REWARD: Atmosphere = 'azur';

/** How long a new user is offered the steps. */
const WINDOW_MS = 7 * 86_400_000;
/** The "all done" card stays this long, then the card is gone. */
const CELEBRATE_MS = 36 * 3_600_000;

export interface FirstStepsState {
  /** When this device first started empty (no account needed). */
  startedAt?: number;
  /** Steps already counted (for one-time events). */
  counted?: FirstStepId[];
  doneAt?: number;
  dismissedAt?: number;
}

export function loadFirstSteps(): FirstStepsState {
  const v = safeRead<FirstStepsState | null>(STORAGE_KEYS.firstSteps);
  if (!v || typeof v !== 'object') return {};
  const out: FirstStepsState = {};
  if (typeof v.startedAt === 'number') out.startedAt = v.startedAt;
  if (typeof v.doneAt === 'number') out.doneAt = v.doneAt;
  if (typeof v.dismissedAt === 'number') out.dismissedAt = v.dismissedAt;
  if (Array.isArray(v.counted)) {
    out.counted = FIRST_STEPS.filter((s) => v.counted!.includes(s));
  }
  return out;
}

export function saveFirstSteps(state: FirstStepsState): void {
  safeWrite(STORAGE_KEYS.firstSteps, state);
}

export interface FirstStepsProgress {
  done: Record<FirstStepId, boolean>;
  count: number;
}

export function firstStepsProgress(has: Record<FirstStepId, boolean>): FirstStepsProgress {
  const count = FIRST_STEPS.filter((s) => has[s]).length;
  return { done: { ...has }, count };
}

/** When the user counts as new: account creation, else the device's empty start. */
export function newUserSince(
  state: FirstStepsState,
  createdAt: number | null | undefined,
): number | undefined {
  return typeof createdAt === 'number' ? createdAt : state.startedAt;
}

export type FirstStepsView = 'steps' | 'celebrate' | null;

export function firstStepsView(
  state: FirstStepsState,
  createdAt: number | null | undefined,
  now: number = Date.now(),
): FirstStepsView {
  if (state.dismissedAt) return null;
  if (state.doneAt) return now - state.doneAt < CELEBRATE_MS ? 'celebrate' : null;
  const since = newUserSince(state, createdAt);
  if (since === undefined) return null;
  return now - since < WINDOW_MS ? 'steps' : null;
}

/** Whether the first-steps reward theme is unlocked on this device. */
export function hasFirstStepsReward(state: FirstStepsState = loadFirstSteps()): boolean {
  return typeof state.doneAt === 'number';
}
