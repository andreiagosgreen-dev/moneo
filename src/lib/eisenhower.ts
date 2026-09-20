/* Eisenhower Matrix (Roadmap Phase 3.1) — urgent/important triage.
 *
 * Every task has an *effective* quadrant: the manual override when the user
 * set one, otherwise an automatic suggestion from priority + due date.
 * Pure functions only; persistence stays in tasks.ts / storage.
 */
import type { Task, TaskQuadrant } from './tasks';
import { TASK_QUADRANTS } from './tasks';
import type { TKey } from './i18n/types';

export const QUADRANT_META: Record<TaskQuadrant, { title: TKey; action: TKey; hint: TKey }> = {
  q1: { title: 'matrix.q1.title', action: 'matrix.q1.action', hint: 'matrix.q1.hint' },
  q2: { title: 'matrix.q2.title', action: 'matrix.q2.action', hint: 'matrix.q2.hint' },
  q3: { title: 'matrix.q3.title', action: 'matrix.q3.action', hint: 'matrix.q3.hint' },
  q4: { title: 'matrix.q4.title', action: 'matrix.q4.action', hint: 'matrix.q4.hint' },
};

/** Due within this window counts as urgent (overdue always counts). */
export const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isUrgent(task: Task, now: number = Date.now()): boolean {
  if (typeof task.dueAt !== 'number' || !Number.isFinite(task.dueAt)) return false;
  return task.dueAt <= now + URGENT_WINDOW_MS;
}

export function isImportant(task: Task): boolean {
  return task.priority === 'p0' || task.priority === 'p1';
}

/** Automatic quadrant from priority + due date (manual override wins). */
export function suggestQuadrant(task: Task, now: number = Date.now()): TaskQuadrant {
  const urgent = isUrgent(task, now);
  const important = isImportant(task);
  if (urgent && important) return 'q1';
  if (!urgent && important) return 'q2';
  if (urgent && !important) return 'q3';
  return 'q4';
}

export function effectiveQuadrant(task: Task, now: number = Date.now()): TaskQuadrant {
  if (task.quadrant && TASK_QUADRANTS.includes(task.quadrant)) return task.quadrant;
  return suggestQuadrant(task, now);
}

/** Incomplete tasks only — the board is for action, not archives. */
export function actionableTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== 'completed');
}

export function tasksInQuadrant(
  tasks: Task[],
  quadrant: TaskQuadrant,
  now: number = Date.now(),
): Task[] {
  return actionableTasks(tasks).filter((t) => effectiveQuadrant(t, now) === quadrant);
}

export interface QuadrantCounts {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export function quadrantCounts(tasks: Task[], now: number = Date.now()): QuadrantCounts {
  const counts: QuadrantCounts = { q1: 0, q2: 0, q3: 0, q4: 0 };
  for (const t of actionableTasks(tasks)) counts[effectiveQuadrant(t, now)] += 1;
  return counts;
}

/** Focus minutes per quadrant, joined through session taskIds. */
export function quadrantMinutes(
  tasks: Task[],
  history: Array<{ taskId?: string; min: number }>,
  now: number = Date.now(),
): QuadrantCounts {
  const minutes: QuadrantCounts = { q1: 0, q2: 0, q3: 0, q4: 0 };
  const index = new Map(tasks.map((t) => [t.id, t]));
  for (const s of history) {
    if (!s.taskId || typeof s.min !== 'number') continue;
    const task = index.get(s.taskId);
    if (!task) continue;
    minutes[effectiveQuadrant(task, now)] += s.min;
  }
  return minutes;
}

export interface QuadrantFocus {
  quadrant: TaskQuadrant | null;
  headline: string;
  /** Top pick inside the focus quadrant (by due date, then priority). */
  task: Task | null;
}

function topTask(candidates: Task[]): Task | null {
  if (candidates.length === 0) return null;
  return candidates.slice().sort((a, b) => {
    const aDue = typeof a.dueAt === 'number' ? a.dueAt : Number.POSITIVE_INFINITY;
    const bDue = typeof b.dueAt === 'number' ? b.dueAt : Number.POSITIVE_INFINITY;
    return aDue - bDue || a.createdAt - b.createdAt;
  })[0];
}

/**
 * Daily "what to focus on": Q1 first, then Q2 deep work, then Q3, else prune Q4.
 * Never throws.
 */
export function quadrantFocus(tasks: Task[], now: number = Date.now()): QuadrantFocus {
  const order: TaskQuadrant[] = ['q1', 'q2', 'q3', 'q4'];
  const headlines: Record<TaskQuadrant, string> = {
    q1: 'Clear the urgent + important first.',
    q2: 'No fires — invest in deep work.',
    q3: 'Delegate or timebox these.',
    q4: 'Nothing pressing — prune or park Q4.',
  };
  for (const q of order) {
    const inQ = tasksInQuadrant(tasks, q, now);
    if (inQ.length > 0) return { quadrant: q, headline: headlines[q], task: topTask(inQ) };
  }
  return { quadrant: null, headline: 'Board clear — plan tomorrow.', task: null };
}
