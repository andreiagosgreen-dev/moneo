import type { TaskStatus } from './tasks';
import type { WipLimits } from './sprints';

/**
 * Kanban work-in-progress limits.
 *
 * Everyone gets the core Kanban rule — at most 3 tasks "In progress" — so the
 * board pushes you to finish before you start. Pro can tune (or add) a limit
 * per column. "Completed" is never limited: finishing should always be possible.
 */
export const DEFAULT_IN_PROGRESS_WIP = 3;

export function effectiveWipLimits(saved: WipLimits, isPro: boolean): WipLimits {
  if (!isPro) return { in_progress: DEFAULT_IN_PROGRESS_WIP };
  const limits: WipLimits = { ...saved };
  if (limits.in_progress === undefined) limits.in_progress = DEFAULT_IN_PROGRESS_WIP;
  delete limits.completed;
  return limits;
}

/** True when one more card may enter `status` (a column already holding `count`). */
export function canPullInto(status: TaskStatus, count: number, limits: WipLimits): boolean {
  if (status === 'completed') return true;
  const limit = limits[status];
  return limit === undefined || count < limit;
}
