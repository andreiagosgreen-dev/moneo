/**
 * The free Pro trial as a short tour: one suggestion a day on Today.
 *
 *   day 1 — the first steps card (firstSteps.ts)
 *   day 2 — turn a goal into a plan
 *   day 3 — a 10-minute workout
 *   day 4 — see where the time goes (reports)
 *   days 5–7 — the trial note with what the user did (signupTrial.ts),
 *              plus one email on day 5 (Worker cron)
 */
import { safeRead, safeWrite } from './storage/storageAdapter';
import { STORAGE_KEYS } from './storage/storageKeys';

export type TourTip = 'plan' | 'move' | 'reports';
const BY_DAY: Record<number, TourTip> = { 2: 'plan', 3: 'move', 4: 'reports' };
const DAY_MS = 86_400_000;

/** Day of the trial, 1 on the sign-up day. */
export function trialDay(createdAt: number, now: number = Date.now()): number {
  return Math.floor((now - createdAt) / DAY_MS) + 1;
}

export function loadDismissedTips(): TourTip[] {
  const v = safeRead<unknown>(STORAGE_KEYS.trialTour);
  return Array.isArray(v) ? v.filter((x): x is TourTip => Object.values(BY_DAY).includes(x)) : [];
}

export function dismissTip(tip: TourTip): TourTip[] {
  const next = [...new Set([...loadDismissedTips(), tip])];
  safeWrite(STORAGE_KEYS.trialTour, next);
  return next;
}

/** Today's tip while the trial runs, unless dismissed. */
export function tourTip(
  createdAt: number | null | undefined,
  dismissed: readonly TourTip[],
  now: number = Date.now(),
): TourTip | null {
  if (typeof createdAt !== 'number') return null;
  const tip = BY_DAY[trialDay(createdAt, now)];
  return tip && !dismissed.includes(tip) ? tip : null;
}
