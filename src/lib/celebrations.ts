/* Rare, significant celebrations (Faza 27) — NOT per-task. Only for: the
 * first Goal ever fully completed, a Milestone-level Goal completed, or a
 * big total-focus-days threshold crossed. Delivered once ever per id, via
 * a shown-log mirroring the Faza 26 time-capsule delivery pattern.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { goalProgress, type Goal } from './goals';
import { localDayKey } from './projects';
import type { Task } from './tasks';
import type { Session } from './store';

/** Distinct local calendar days with at least one focus session. */
export function totalFocusDays(history: Session[]): number {
  return new Set(
    history.filter((s) => Number.isFinite(s.at)).map((s) => localDayKey(s.at)),
  ).size;
}

/** Rare on purpose — crossing any of these is a genuine milestone. */
export const FOCUS_DAYS_THRESHOLDS: number[] = [100, 250, 500, 1000];

export type CelebrationKind = 'firstGoalDone' | 'milestoneDone' | 'focusDaysMilestone';

export interface Celebration {
  /** Stable, unique key — also the shown-log entry key. */
  id: string;
  kind: CelebrationKind;
  /** Goal title (firstGoalDone/milestoneDone) or day count (focusDaysMilestone). */
  label: string;
}

export function loadCelebrationsShown(): Record<string, true> {
  const stored = read<Record<string, unknown>>(STORAGE_KEYS.celebrationsShown);
  if (!stored || typeof stored !== 'object') return {};
  const clean: Record<string, true> = {};
  for (const k of Object.keys(stored)) clean[k] = true;
  return clean;
}

export function saveCelebrationsShown(shown: Record<string, true>): boolean {
  return write(STORAGE_KEYS.celebrationsShown, shown);
}

export function markCelebrationShown(
  shown: Record<string, true>,
  id: string,
): Record<string, true> {
  return { ...shown, [id]: true };
}

/**
 * Celebrations newly earned since `shown` was last saved. Pure, never
 * throws. At most one `firstGoalDone` ever fires (global, earliest goal by
 * updatedAt); every completed Milestone-level goal fires its own
 * `milestoneDone` once; every crossed focus-days threshold fires once.
 */
export function pendingCelebrations(
  goals: Goal[],
  tasks: Task[],
  totalFocusDays: number,
  shown: Record<string, true>,
): Celebration[] {
  const out: Celebration[] = [];
  const done = goals.filter((g) => !g.archived && goalProgress(goals, tasks, g.id) >= 100);

  if (!shown.firstGoalDone && done.length > 0) {
    const earliest = [...done].sort((a, b) => a.updatedAt - b.updatedAt)[0];
    out.push({ id: 'firstGoalDone', kind: 'firstGoalDone', label: earliest.title });
  }

  for (const g of done) {
    if (g.level !== 'milestone') continue;
    const id = `milestoneDone:${g.id}`;
    if (shown[id]) continue;
    out.push({ id, kind: 'milestoneDone', label: g.title });
  }

  for (const threshold of FOCUS_DAYS_THRESHOLDS) {
    const id = `focusDays:${threshold}`;
    if (shown[id] || totalFocusDays < threshold) continue;
    out.push({ id, kind: 'focusDaysMilestone', label: String(threshold) });
  }

  return out;
}
