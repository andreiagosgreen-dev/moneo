/* Inbox ("Cutia de idei"): tasks captured without a project. They live in the
 * normal task list with an empty projectId, so they sync and export like any
 * other task and never count toward the Free project limit. */
import type { QuickAdd } from './quickAdd';
import { createTaskObject, moveTask, type Task } from './tasks';

export const INBOX_PROJECT_ID = '';

export function isInboxTask(t: Task): boolean {
  return t.projectId === INBOX_PROJECT_ID && t.status !== 'completed' && !t.parentId;
}

/** Open inbox tasks, oldest first. */
export function inboxTasks(tasks: Task[]): Task[] {
  return tasks.filter(isInboxTask).sort((a, b) => a.createdAt - b.createdAt);
}

/** null when nothing but tokens was typed. */
export function createInboxTask(q: QuickAdd): Task | null {
  if (!q.title.trim()) return null;
  const task = createTaskObject(INBOX_PROJECT_ID, q.title, q.priority ?? 'p2');
  if (q.dueAt !== null) {
    task.dueAt = q.dueAt;
    if (q.hasTime) task.dueHasTime = true;
  }
  if (q.estimateMin !== null) task.estimateMin = Math.min(480, Math.max(5, q.estimateMin));
  return task;
}

export function assignProject(tasks: Task[], id: string, projectId: string): Task[] {
  return moveTask(tasks, id, projectId);
}
