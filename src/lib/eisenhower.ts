/* Eisenhower Matrix (Roadmap Phase 3.1) — urgent/important triage.
 *
 * Every task has an *effective* quadrant: the manual override when the user
 * set one, otherwise an automatic suggestion from priority + due date.
 * Pure functions only; persistence stays in tasks.ts / storage.
 */
import type { Task, TaskQuadrant } from './tasks';
import { TASK_QUADRANTS } from './tasks';
import { createI18n, type I18n } from './i18n';

/** Default English translator — keeps helpers usable without a provider. */
const EN_I18N = createI18n('en');

export const QUADRANT_META: Record<TaskQuadrant, { title: string; action: string; hint: string }> =
  {
    q1: { title: 'Do', action: 'Do first', hint: 'Urgent + important' },
    q2: { title: 'Schedule', action: 'Schedule', hint: 'Not urgent + important' },
    q3: { title: 'Delegate', action: 'Delegate', hint: 'Urgent + not important' },
    q4: { title: 'Eliminate', action: 'Eliminate', hint: 'Neither urgent nor important' },
  };

/** Translation keys for quadrant chrome (UI renders via t()). */
export const QUADRANT_TEXT_KEYS: Record<TaskQuadrant, { title: string; action: string; hint: string }> = {
  q1: { title: 'matrix.q1t', action: 'matrix.q1a', hint: 'matrix.q1h' },
  q2: { title: 'matrix.q2t', action: 'matrix.q2a', hint: 'matrix.q2h' },
  q3: { title: 'matrix.q3t', action: 'matrix.q3a', hint: 'matrix.q3h' },
  q4: { title: 'matrix.q4t', action: 'matrix.q4a', hint: 'matrix.q4h' },
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
export function quadrantFocus(
  tasks: Task[],
  now: number = Date.now(),
  i18n: I18n = EN_I18N,
): QuadrantFocus {
  const order: TaskQuadrant[] = ['q1', 'q2', 'q3', 'q4'];
  const headlines: Record<TaskQuadrant, string> = {
    q1: i18n.t('matrix.head.q1'),
    q2: i18n.t('matrix.head.q2'),
    q3: i18n.t('matrix.head.q3'),
    q4: i18n.t('matrix.head.q4'),
  };
  for (const q of order) {
    const inQ = tasksInQuadrant(tasks, q, now);
    if (inQ.length > 0) return { quadrant: q, headline: headlines[q], task: topTask(inQ) };
  }
  return { quadrant: null, headline: i18n.t('matrix.head.clear'), task: null };
}
