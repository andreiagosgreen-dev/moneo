/* Task management within projects — local-first, additive. */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';

export type TaskPriority = 'p0' | 'p1' | 'p2' | 'p3';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export const TASK_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];

export const TASK_PRIORITIES: TaskPriority[] = ['p0', 'p1', 'p2', 'p3'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  completed: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
};

export function loadTasks(): Task[] {
  const stored = read<Task[]>(STORAGE_KEYS.tasks);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (t) =>
        t &&
        typeof t.id === 'string' &&
        typeof t.projectId === 'string' &&
        typeof t.title === 'string',
    )
    .map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      status: TASK_STATUSES.includes(t.status) ? t.status : 'pending',
      priority: TASK_PRIORITIES.includes(t.priority) ? t.priority : 'p2',
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : Date.now(),
      ...(typeof t.completedAt === 'number' ? { completedAt: t.completedAt } : {}),
    }));
}

export function saveTasks(tasks: Task[]): boolean {
  return write(STORAGE_KEYS.tasks, tasks);
}

/** Create a task object (persistence is the caller's job via saveTasks). */
export function createTaskObject(
  projectId: string,
  title: string,
  priority: TaskPriority = 'p2',
): Task {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    title: title.trim(),
    status: 'pending',
    priority,
    createdAt: now,
    updatedAt: now,
  };
}

export function tasksForProject(tasks: Task[], projectId: string): Task[] {
  return tasks
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => {
      // status order: in_progress, pending, blocked, completed
      const rank: Record<TaskStatus, number> = {
        in_progress: 0,
        pending: 1,
        blocked: 2,
        completed: 3,
      };
      return (
        rank[a.status] - rank[b.status] ||
        priorityRank(a.priority) - priorityRank(b.priority) ||
        a.createdAt - b.createdAt
      );
    });
}

function priorityRank(p: TaskPriority): number {
  switch (p) {
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

/** Toggle status with a completedAt stamp when completing. */
export function updateTaskStatus(tasks: Task[], taskId: string, status: TaskStatus): Task[] {
  const now = Date.now();
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      status,
      updatedAt: now,
      ...(status === 'completed'
        ? { completedAt: now }
        : t.completedAt !== undefined
          ? { completedAt: undefined }
          : {}),
    };
  });
}

/** Rename a task, or move it to another project. */
export function renameTask(tasks: Task[], taskId: string, title: string): Task[] {
  const clean = title.trim();
  if (!clean) return tasks;
  return tasks.map((t) => (t.id === taskId ? { ...t, title: clean, updatedAt: Date.now() } : t));
}

export function setTaskPriority(tasks: Task[], taskId: string, priority: TaskPriority): Task[] {
  return tasks.map((t) => (t.id === taskId ? { ...t, priority, updatedAt: Date.now() } : t));
}

export function moveTask(tasks: Task[], taskId: string, projectId: string): Task[] {
  return tasks.map((t) => (t.id === taskId ? { ...t, projectId, updatedAt: Date.now() } : t));
}

export function removeTask(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((t) => t.id !== taskId);
}

/** Remove every task belonging to a project (used when deleting a project). */
export function removeTasksForProject(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.projectId !== projectId);
}

/** Minutes credited to a specific task across history. */
export function getMinutesForTask(
  taskId: string,
  history: Array<{ taskId?: string; min: number }>,
): number {
  return history.filter((s) => s.taskId === taskId).reduce((sum, s) => sum + s.min, 0);
}

/** Count completed vs total non-archived tasks for a project. */
export function projectCompletion(
  tasks: Task[],
  projectId: string,
): {
  done: number;
  total: number;
} {
  const owned = tasks.filter((t) => t.projectId === projectId);
  return {
    done: owned.filter((t) => t.status === 'completed').length,
    total: owned.length,
  };
}
