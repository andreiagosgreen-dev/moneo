/* Eat the Frog (Roadmap Phase 3.2) — one hardest task per day.
 *
 * The frog is picked deterministically (priority → overdue → earliest due →
 * oldest), so every surface agrees on "today's frog" without extra state.
 * Completion history lives in a day-keyed log that powers streaks and
 * procrastination analytics. Pure functions; storage via STORAGE_KEYS.frogLog.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { localDayKey } from './projects';
import type { Project } from './projects';
import type { Task } from './tasks';

export interface FrogEntry {
  /** Task picked as the frog that day. */
  taskId: string;
  /** True once the frog task reached completed. */
  done: boolean;
}

export type FrogLog = Record<string, FrogEntry>;

function priorityRank(priority: Task['priority']): number {
  switch (priority) {
    case 'p0':
      return 0;
    case 'p1':
      return 1;
    case 'p2':
      return 2;
    case 'p3':
      return 3;
  }
}

/**
 * Pick today's frog: hardest incomplete task in active projects.
 * Overdue beats everything; then priority, earliest due, oldest first.
 * Returns null when nothing actionable remains. Never throws.
 */
export function pickFrog(
  tasks: Task[],
  projects: Project[],
  now: number = Date.now(),
): Task | null {
  const active = new Set(projects.filter((p) => !p.archived).map((p) => p.id));
  const pool = tasks.filter((t) => t.status !== 'completed' && active.has(t.projectId));
  if (pool.length === 0) return null;
  return pool.slice().sort((a, b) => {
    const aOver = typeof a.dueAt === 'number' && a.dueAt < now ? 0 : 1;
    const bOver = typeof b.dueAt === 'number' && b.dueAt < now ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    if (priorityRank(a.priority) !== priorityRank(b.priority)) {
      return priorityRank(a.priority) - priorityRank(b.priority);
    }
    const aDue = typeof a.dueAt === 'number' ? a.dueAt : Number.POSITIVE_INFINITY;
    const bDue = typeof b.dueAt === 'number' ? b.dueAt : Number.POSITIVE_INFINITY;
    return aDue - bDue || a.createdAt - b.createdAt;
  })[0];
}

export function loadFrogLog(): FrogLog {
  const stored = read<FrogLog>(STORAGE_KEYS.frogLog);
  if (!stored || typeof stored !== 'object') return {};
  const clean: FrogLog = {};
  for (const [k, v] of Object.entries(stored)) {
    if (v && typeof v.taskId === 'string' && typeof v.done === 'boolean') {
      clean[k] = { taskId: v.taskId, done: v.done };
    }
  }
  return clean;
}

export function saveFrogLog(log: FrogLog): boolean {
  return write(STORAGE_KEYS.frogLog, log);
}

/** Pure: record (or refresh) a day's frog entry. */
export function recordFrog(log: FrogLog, dayKey: string, taskId: string, done: boolean): FrogLog {
  return { ...log, [dayKey]: { taskId, done } };
}

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return localDayKey(dt.getTime());
}

/**
 * Consecutive done-days ending today (or yesterday, so a morning streak
 * doesn't read 0). Never throws.
 */
export function frogStreak(log: FrogLog, now: number = Date.now()): number {
  let cursor = localDayKey(now);
  if (!log[cursor]?.done) cursor = shiftDayKey(cursor, -1);
  let streak = 0;
  while (log[cursor]?.done) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

export interface FrogStats {
  days: number;
  done: number;
  /** Picked but never completed — the procrastination signal. */
  skipped: number;
  rate: number;
  streak: number;
}

export function frogStats(log: FrogLog, now: number = Date.now()): FrogStats {
  const entries = Object.values(log);
  const done = entries.filter((e) => e.done).length;
  const days = entries.length;
  return {
    days,
    done,
    skipped: days - done,
    rate: days === 0 ? 0 : done / days,
    streak: frogStreak(log, now),
  };
}
