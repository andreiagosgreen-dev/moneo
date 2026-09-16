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
  /** Parent task id for subtasks (Roadmap 2.2). Nesting is capped at MAX_TASK_DEPTH. */
  parentId?: string;
  /** Ids of same-project tasks that must complete first (Roadmap 2.2). */
  blockedBy?: string[];
  /** Recurrence rule; completing a recurring task spawns the next instance. */
  recurrence?: TaskRecurrence;
  /** Optional due date in epoch ms. */
  dueAt?: number;
  /** Free-form notes (Roadmap 2.2). */
  notes?: string;
  /** Manual Eisenhower quadrant override (Roadmap 3.1). Absent = auto-suggest. */
  quadrant?: TaskQuadrant;
  /** Story points for Agile planning (Roadmap 7.2). Absent = unpointed. */
  points?: number;
}

export type TaskQuadrant = 'q1' | 'q2' | 'q3' | 'q4';

export const TASK_QUADRANTS: TaskQuadrant[] = ['q1', 'q2', 'q3', 'q4'];

/** Fibonacci-ish story point scale (Roadmap 7.2). */
export const TASK_POINTS: number[] = [0, 1, 2, 3, 5, 8];

export type TaskRecurrence = 'none' | 'daily' | 'weekly';

export const TASK_RECURRENCES: TaskRecurrence[] = ['none', 'daily', 'weekly'];

/** Root = 1, child = 2, grandchild = 3 (roadmap asks for 3 levels). */
export const MAX_TASK_DEPTH = 3;

export const MAX_NOTES_LENGTH = 2000;

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
      ...(typeof t.parentId === 'string' && t.parentId ? { parentId: t.parentId } : {}),
      ...(Array.isArray(t.blockedBy)
        ? { blockedBy: t.blockedBy.filter((b) => typeof b === 'string' && b) }
        : {}),
      ...(t.recurrence === 'daily' || t.recurrence === 'weekly'
        ? { recurrence: t.recurrence }
        : {}),
      ...(typeof t.dueAt === 'number' && Number.isFinite(t.dueAt) ? { dueAt: t.dueAt } : {}),
      ...(typeof t.notes === 'string' && t.notes
        ? { notes: t.notes.slice(0, MAX_NOTES_LENGTH) }
        : {}),
      ...(t.quadrant === 'q1' || t.quadrant === 'q2' || t.quadrant === 'q3' || t.quadrant === 'q4'
        ? { quadrant: t.quadrant }
        : {}),
      ...(typeof t.points === 'number' && Number.isFinite(t.points)
        ? { points: Math.min(21, Math.max(0, Math.round(t.points))) }
        : {}),
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

/** Shared ordering: in_progress, pending, blocked, completed; then priority, then age. */
export function compareTaskOrder(a: Task, b: Task): number {
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
}

export function tasksForProject(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId).sort(compareTaskOrder);
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

/**
 * Move a task (plus its whole subtree) to another project.
 * A moved subtask whose parent stays behind becomes a root task, and
 * cross-project blocker refs are dropped so dependencies stay same-project.
 */
export function moveTask(tasks: Task[], taskId: string, projectId: string): Task[] {
  const moving = new Set([taskId, ...descendantIds(tasks, taskId)]);
  const now = Date.now();
  return tasks.map((t) => {
    if (!moving.has(t.id)) return t;
    const next: Task = { ...t, projectId, updatedAt: now };
    if (next.parentId && !moving.has(next.parentId)) delete next.parentId;
    if (next.blockedBy) {
      const kept = next.blockedBy.filter(
        (b) => !moving.has(b) && tasks.some((o) => o.id === b && o.projectId === projectId),
      );
      if (kept.length > 0) next.blockedBy = kept;
      else delete next.blockedBy;
    }
    return next;
  });
}

/**
 * Remove a task plus all its descendants; strips their ids from every
 * remaining blockedBy list so no dangling dependency survives.
 */
export function removeTask(tasks: Task[], taskId: string): Task[] {
  const gone = new Set([taskId, ...descendantIds(tasks, taskId)]);
  return tasks
    .filter((t) => !gone.has(t.id))
    .map((t) => {
      if (!t.blockedBy || !t.blockedBy.some((b) => gone.has(b))) return t;
      const kept = t.blockedBy.filter((b) => !gone.has(b));
      const next: Task = { ...t };
      if (kept.length > 0) next.blockedBy = kept;
      else delete next.blockedBy;
      return next;
    });
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

/* ---------------- subtasks (3-level hierarchy) ---------------- */

function byId(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((t) => [t.id, t]));
}

/** All descendant ids of a task (cycle-safe). */
export function descendantIds(tasks: Task[], taskId: string): string[] {
  const children = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.parentId) {
      const list = children.get(t.parentId) ?? [];
      list.push(t.id);
      children.set(t.parentId, list);
    }
  }
  const out: string[] = [];
  const seen = new Set([taskId]);
  const stack = [...(children.get(taskId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

/** Nesting depth of a task: root = 1 (cycle-safe, caps at MAX_TASK_DEPTH + 1). */
export function taskDepth(tasks: Task[], taskId: string): number {
  const index = byId(tasks);
  let depth = 1;
  let current = index.get(taskId)?.parentId;
  const seen = new Set([taskId]);
  while (current) {
    if (seen.has(current)) return MAX_TASK_DEPTH + 1;
    seen.add(current);
    depth += 1;
    if (depth > MAX_TASK_DEPTH + 1) return depth;
    current = index.get(current)?.parentId;
  }
  return depth;
}

/** Direct children of a task, in the shared display order. */
export function subtasksOf(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parentId === parentId).sort(compareTaskOrder);
}

/** Top-level tasks of a project (no parent), in the shared display order. */
export function rootTasks(tasks: Task[], projectId: string): Task[] {
  return tasksForProject(tasks, projectId).filter((t) => !t.parentId);
}

/** True when a new subtask may nest under parentId (same project, depth allows). */
export function canNest(tasks: Task[], parentId: string, projectId: string): boolean {
  const parent = byId(tasks).get(parentId);
  if (!parent || parent.projectId !== projectId) return false;
  return taskDepth(tasks, parentId) < MAX_TASK_DEPTH;
}

/** Create a subtask object; throws nothing — returns null when nesting is illegal. */
export function createSubtaskObject(
  tasks: Task[],
  parentId: string,
  title: string,
  priority: TaskPriority = 'p2',
): Task | null {
  const clean = title.trim();
  const parent = byId(tasks).get(parentId);
  if (!clean || !parent || !canNest(tasks, parentId, parent.projectId)) return null;
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId: parent.projectId,
    title: clean,
    status: 'pending',
    priority,
    parentId,
    createdAt: now,
    updatedAt: now,
  };
}

function wouldNestCycle(tasks: Task[], taskId: string, candidateParentId: string): boolean {
  let current: string | undefined = candidateParentId;
  const seen = new Set([taskId]);
  const index = byId(tasks);
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = index.get(current)?.parentId;
  }
  return false;
}

/**
 * Re-parent a task (or detach to root with null). Rejected (list unchanged)
 * on cross-project parents, cycles, or depth overflow.
 */
export function reparentTask(tasks: Task[], taskId: string, parentId: string | null): Task[] {
  const task = byId(tasks).get(taskId);
  if (!task) return tasks;
  if (parentId === null) {
    if (!task.parentId) return tasks;
    return tasks.map((t) =>
      t.id === taskId ? { ...t, updatedAt: Date.now(), parentId: undefined } : t,
    );
  }
  const parent = byId(tasks).get(parentId);
  if (
    !parent ||
    parentId === taskId ||
    parent.projectId !== task.projectId ||
    wouldNestCycle(tasks, taskId, parentId) ||
    taskDepth(tasks, parentId) >= MAX_TASK_DEPTH
  ) {
    return tasks;
  }
  // The moved subtree must still fit: deepest descendant depth + 1 <= max.
  const descendants = descendantIds(tasks, taskId);
  let deepest = 0;
  for (const id of descendants) {
    const rel = taskDepth(tasks, id) - taskDepth(tasks, taskId);
    if (rel > deepest) deepest = rel;
  }
  if (taskDepth(tasks, parentId) + 1 + deepest > MAX_TASK_DEPTH) return tasks;
  return tasks.map((t) => (t.id === taskId ? { ...t, parentId, updatedAt: Date.now() } : t));
}

/* ---------------- dependencies (blockers) ---------------- */

function wouldCreateCycle(tasks: Task[], taskId: string, candidateBlockerId: string): boolean {
  const index = byId(tasks);
  const stack = [candidateBlockerId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(index.get(id)?.blockedBy ?? []));
  }
  return false;
}

/**
 * Replace a task's blocker list. Kept refs must be same-project, existing,
 * non-self and cycle-free; anything else is dropped.
 */
export function setBlockedBy(tasks: Task[], taskId: string, blockerIds: string[]): Task[] {
  const task = byId(tasks).get(taskId);
  if (!task) return tasks;
  const kept = Array.from(new Set(blockerIds.filter((b) => typeof b === 'string' && b))).filter(
    (b) =>
      b !== taskId &&
      byId(tasks).get(b)?.projectId === task.projectId &&
      !wouldCreateCycle(tasks, taskId, b),
  );
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const next: Task = { ...t, updatedAt: Date.now() };
    if (kept.length > 0) next.blockedBy = kept;
    else delete next.blockedBy;
    return next;
  });
}

/** Blockers that are not completed yet (missing ids are ignored). */
export function blockingTasks(task: Task, tasks: Task[]): Task[] {
  if (!task.blockedBy || task.blockedBy.length === 0) return [];
  const index = byId(tasks);
  return task.blockedBy
    .map((b) => index.get(b))
    .filter((b): b is Task => !!b && b.status !== 'completed');
}

/** A task completes only when every blocker is done. */
export function canComplete(task: Task, tasks: Task[]): { ok: boolean; blockers: string[] } {
  const blockers = blockingTasks(task, tasks).map((b) => b.title);
  return blockers.length === 0 ? { ok: true, blockers: [] } : { ok: false, blockers: blockers };
}

/* ---------------- recurrence / due dates / notes ---------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

function nextDueAt(recurrence: TaskRecurrence, from: number): number {
  return from + (recurrence === 'weekly' ? 7 * DAY_MS : DAY_MS);
}

/**
 * Complete a task, spawning the next instance when it recurs.
 * Returns the updated list plus the spawned task (if any). Never throws.
 */
export function completeTask(
  tasks: Task[],
  taskId: string,
  now: number = Date.now(),
): { tasks: Task[]; spawned: Task | null } {
  const task = byId(tasks).get(taskId);
  if (!task || task.status === 'completed') return { tasks, spawned: null };
  if (!canComplete(task, tasks).ok) return { tasks, spawned: null };
  let next = updateTaskStatus(tasks, taskId, 'completed');
  let spawned: Task | null = null;
  if (task.recurrence === 'daily' || task.recurrence === 'weekly') {
    const base = Math.max(task.dueAt ?? now, now);
    spawned = {
      ...createTaskObject(task.projectId, task.title, task.priority),
      ...(task.parentId ? { parentId: task.parentId } : {}),
      recurrence: task.recurrence,
      dueAt: nextDueAt(task.recurrence, base),
    };
    next = [...next, spawned];
  }
  return { tasks: next, spawned };
}

export function setRecurrence(tasks: Task[], taskId: string, recurrence: TaskRecurrence): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const next: Task = { ...t, updatedAt: Date.now() };
    if (recurrence === 'none') delete next.recurrence;
    else next.recurrence = recurrence;
    return next;
  });
}

export function setDueAt(tasks: Task[], taskId: string, dueAt: number | null): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const next: Task = { ...t, updatedAt: Date.now() };
    if (dueAt !== null && Number.isFinite(dueAt)) next.dueAt = dueAt;
    else delete next.dueAt;
    return next;
  });
}

export function setNotes(tasks: Task[], taskId: string, notes: string): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const next: Task = { ...t, updatedAt: Date.now() };
    const clean = notes.trim().slice(0, MAX_NOTES_LENGTH);
    if (clean) next.notes = clean;
    else delete next.notes;
    return next;
  });
}

/** Set (or clear with null) the manual Eisenhower quadrant override. */
export function setTaskQuadrant(
  tasks: Task[],
  taskId: string,
  quadrant: TaskQuadrant | null,
): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const next: Task = { ...t, updatedAt: Date.now() };
    if (quadrant !== null && TASK_QUADRANTS.includes(quadrant)) next.quadrant = quadrant;
    else delete next.quadrant;
    return next;
  });
}

/** Set (or clear with null) story points. Out-of-scale values are clamped 0-21. */
export function setTaskPoints(tasks: Task[], taskId: string, points: number | null): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const next: Task = { ...t, updatedAt: Date.now() };
    if (points !== null && Number.isFinite(points)) {
      next.points = Math.min(21, Math.max(0, Math.round(points)));
    } else delete next.points;
    return next;
  });
}

/** Effective points for planning math (unpointed counts as 1). */
export function taskPoints(task: Task): number {
  return typeof task.points === 'number' ? task.points : 1;
}

/* ---------------- critical path (Roadmap 7.4, lightweight) ---------------- */

/**
 * Longest dependency chain among a project's incomplete tasks, ordered
 * blockers-first (the work that gates everything else). Cycle-safe.
 * Never throws.
 */
export function criticalChain(tasks: Task[], projectId: string): Task[] {
  const index = new Map<string, Task>();
  for (const t of tasks) {
    if (t.projectId === projectId && t.status !== 'completed') index.set(t.id, t);
  }
  const memo = new Map<string, Task[]>();
  const chainEndingAt = (id: string, visiting: Set<string>): Task[] => {
    const cached = memo.get(id);
    if (cached) return cached;
    const task = index.get(id);
    if (!task || visiting.has(id)) return [];
    visiting.add(id);
    let best: Task[] = [];
    for (const b of task.blockedBy ?? []) {
      if (!index.has(b)) continue;
      const candidate = chainEndingAt(b, visiting);
      if (candidate.length > best.length) best = candidate;
    }
    visiting.delete(id);
    const chain = [...best, task];
    memo.set(id, chain);
    return chain;
  };
  let longest: Task[] = [];
  for (const id of index.keys()) {
    const chain = chainEndingAt(id, new Set());
    if (chain.length > longest.length) longest = chain;
  }
  return longest;
}
