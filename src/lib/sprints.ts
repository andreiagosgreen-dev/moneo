/* Agile/Scrum (Roadmap Phase 7.2) — sprints, burndown, velocity, standups.
 *
 * Sprints scope to one project and reference tasks by id; task truth stays
 * in tasks.ts (status/points/completedAt). Pure functions; storage via keys.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { localDayKey } from './projects';
import { taskPoints, criticalChain, type Task, type TaskStatus } from './tasks';
import { createI18n, type I18n } from './i18n';

/** Default English translator — keeps helpers usable without a provider. */
const EN_I18N = createI18n('en');

export type WipLimits = Partial<Record<TaskStatus, number>>;

export interface BoardConfig {
  wipLimits: WipLimits;
  /** Custom display labels per status column (Roadmap 7.1 custom columns). */
  columnLabels: Partial<Record<TaskStatus, string>>;
  /** Hidden status columns (empty = all visible). */
  hidden: TaskStatus[];
}

/** Load board config (WIP limits), defaulting to unlimited. Never throws. */
export function loadBoardConfig(): BoardConfig {
  const stored = read<BoardConfig>(STORAGE_KEYS.boardConfig);
  const wip = stored?.wipLimits;
  const clean: WipLimits = {};
  if (wip && typeof wip === 'object') {
    for (const status of ['pending', 'in_progress', 'blocked', 'completed'] as const) {
      const v = (wip as Record<string, unknown>)[status];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) clean[status] = Math.floor(v);
    }
  }
  const labels: Partial<Record<TaskStatus, string>> = {};
  const rawLabels = stored?.columnLabels;
  if (rawLabels && typeof rawLabels === 'object') {
    for (const status of ['pending', 'in_progress', 'blocked', 'completed'] as const) {
      const v = (rawLabels as Record<string, unknown>)[status];
      if (typeof v === 'string' && v.trim()) labels[status] = v.trim().slice(0, 24);
    }
  }
  const hidden = Array.isArray(stored?.hidden)
    ? (stored.hidden as unknown[]).filter(
        (s): s is TaskStatus =>
          s === 'pending' || s === 'in_progress' || s === 'blocked' || s === 'completed',
      )
    : [];
  return { wipLimits: clean, columnLabels: labels, hidden };
}

export function saveBoardConfig(config: BoardConfig): boolean {
  return write(STORAGE_KEYS.boardConfig, config);
}

export type SprintStatus = 'planned' | 'active' | 'completed';

export const SPRINT_STATUSES: SprintStatus[] = ['planned', 'active', 'completed'];

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  startAt: number;
  endAt: number;
  taskIds: string[];
  status: SprintStatus;
  retro?: string;
  createdAt: number;
  updatedAt: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function loadSprints(): Sprint[] {
  const stored = read<Sprint[]>(STORAGE_KEYS.sprints);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((s) => s && typeof s.id === 'string' && typeof s.projectId === 'string')
    .map((s) => ({
      id: s.id,
      projectId: s.projectId,
      name: typeof s.name === 'string' && s.name.trim() ? s.name : 'Sprint',
      ...(typeof s.goal === 'string' && s.goal.trim() ? { goal: s.goal.slice(0, 200) } : {}),
      startAt: typeof s.startAt === 'number' && Number.isFinite(s.startAt) ? s.startAt : Date.now(),
      endAt:
        typeof s.endAt === 'number' && Number.isFinite(s.endAt)
          ? s.endAt
          : Date.now() + 14 * DAY_MS,
      taskIds: Array.isArray(s.taskIds) ? s.taskIds.filter((t) => typeof t === 'string') : [],
      status: SPRINT_STATUSES.includes(s.status as SprintStatus)
        ? (s.status as SprintStatus)
        : 'planned',
      ...(typeof s.retro === 'string' && s.retro ? { retro: s.retro.slice(0, 2000) } : {}),
      createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
      updatedAt: typeof s.updatedAt === 'number' ? s.updatedAt : Date.now(),
    }));
}

export function saveSprints(sprints: Sprint[]): boolean {
  return write(STORAGE_KEYS.sprints, sprints);
}

/** Monday-start 2-week sprint scaffolding for a project. */
export function createSprintObject(
  projectId: string,
  name: string,
  startAt: number = Date.now(),
  lengthDays = 14,
): Sprint | null {
  const clean = name.trim().slice(0, 80);
  if (!clean || !Number.isFinite(startAt)) return null;
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    name: clean,
    startAt,
    endAt: startAt + Math.max(1, Math.min(60, lengthDays)) * DAY_MS,
    taskIds: [],
    status: 'planned',
    createdAt: now,
    updatedAt: now,
  };
}

export interface SprintUpdates {
  name?: string;
  goal?: string | null;
  startAt?: number;
  endAt?: number;
  status?: SprintStatus;
  retro?: string | null;
}

export function updateSprint(sprints: Sprint[], id: string, updates: SprintUpdates): Sprint[] {
  return sprints.map((s) => {
    if (s.id !== id) return s;
    const next: Sprint = { ...s, updatedAt: Date.now() };
    if (updates.name !== undefined) next.name = updates.name.trim().slice(0, 80) || s.name;
    if (updates.goal !== undefined) {
      if (updates.goal && updates.goal.trim()) next.goal = updates.goal.trim().slice(0, 200);
      else delete next.goal;
    }
    if (updates.startAt !== undefined && Number.isFinite(updates.startAt)) {
      next.startAt = updates.startAt;
    }
    if (
      updates.endAt !== undefined &&
      Number.isFinite(updates.endAt) &&
      updates.endAt > next.startAt
    ) {
      next.endAt = updates.endAt;
    }
    if (updates.status !== undefined) next.status = updates.status;
    if (updates.retro !== undefined) {
      if (updates.retro && updates.retro.trim()) next.retro = updates.retro.slice(0, 2000);
      else delete next.retro;
    }
    return next;
  });
}

export function deleteSprint(sprints: Sprint[], id: string): Sprint[] {
  return sprints.filter((s) => s.id !== id);
}

/** Add tasks to a sprint (same-project, existing, deduped). */
export function addTasksToSprint(
  sprints: Sprint[],
  tasks: Task[],
  sprintId: string,
  taskIds: string[],
): Sprint[] {
  const sprint = sprints.find((s) => s.id === sprintId);
  if (!sprint) return sprints;
  const index = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set(sprint.taskIds);
  const valid = taskIds.filter((id) => {
    if (seen.has(id) || index.get(id)?.projectId !== sprint.projectId) return false;
    seen.add(id);
    return true;
  });
  if (valid.length === 0) return sprints;
  return sprints.map((s) =>
    s.id === sprintId ? { ...s, taskIds: [...s.taskIds, ...valid], updatedAt: Date.now() } : s,
  );
}

export function removeTaskFromSprint(
  sprints: Sprint[],
  sprintId: string,
  taskId: string,
): Sprint[] {
  return sprints.map((s) =>
    s.id === sprintId
      ? { ...s, taskIds: s.taskIds.filter((t) => t !== taskId), updatedAt: Date.now() }
      : s,
  );
}

/** Drop sprint refs to tasks that no longer exist (hygiene after deletes). */
export function pruneSprintTasks(sprints: Sprint[], tasks: Task[]): Sprint[] {
  const alive = new Set(tasks.map((t) => t.id));
  return sprints.map((s) => {
    const kept = s.taskIds.filter((id) => alive.has(id));
    return kept.length === s.taskIds.length ? s : { ...s, taskIds: kept, updatedAt: Date.now() };
  });
}

export function sprintsForProject(sprints: Sprint[], projectId: string): Sprint[] {
  return sprints
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => b.startAt - a.startAt || b.createdAt - a.createdAt);
}

export function activeSprint(sprints: Sprint[], projectId: string): Sprint | null {
  const actives = sprints
    .filter((s) => s.projectId === projectId && s.status === 'active')
    .sort((a, b) => b.startAt - a.startAt);
  return actives[0] ?? null;
}

export function sprintTasks(sprint: Sprint, tasks: Task[]): Task[] {
  const index = new Map(tasks.map((t) => [t.id, t]));
  return sprint.taskIds
    .map((id) => index.get(id))
    .filter((t): t is Task => !!t && t.projectId === sprint.projectId);
}

export interface SprintPoints {
  total: number;
  done: number;
  remaining: number;
  pct: number;
}

export function sprintPoints(sprint: Sprint, tasks: Task[]): SprintPoints {
  const scoped = sprintTasks(sprint, tasks);
  const total = scoped.reduce((sum, t) => sum + taskPoints(t), 0);
  const done = scoped
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + taskPoints(t), 0);
  return {
    total,
    done,
    remaining: total - done,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export interface BurndownDay {
  dayKey: string;
  label: string;
  ideal: number;
  actual: number;
}

/**
 * Daily remaining-points series from sprint start to end (capped at 60
 * days). Actual burns down by completedAt day; ideal is linear. Never throws.
 */
export function burndown(sprint: Sprint, tasks: Task[], now: number = Date.now()): BurndownDay[] {
  const scoped = sprintTasks(sprint, tasks);
  const total = scoped.reduce((sum, t) => sum + taskPoints(t), 0);
  const spanDays = Math.max(1, Math.min(60, Math.ceil((sprint.endAt - sprint.startAt) / DAY_MS)));
  const days: BurndownDay[] = [];
  for (let i = 0; i <= spanDays; i++) {
    const dayStart = sprint.startAt + i * DAY_MS;
    if (dayStart > now + DAY_MS) break;
    const doneByDay = scoped
      .filter(
        (t) =>
          t.status === 'completed' &&
          typeof t.completedAt === 'number' &&
          t.completedAt < dayStart + DAY_MS,
      )
      .reduce((sum, t) => sum + taskPoints(t), 0);
    days.push({
      dayKey: localDayKey(dayStart),
      label: new Date(dayStart).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      ideal: Math.max(0, Math.round(total * (1 - i / spanDays))),
      actual: total - doneByDay,
    });
  }
  return days;
}

/** Average done-points over the last N completed sprints (0 when none). */
export function velocity(sprints: Sprint[], tasks: Task[], projectId: string, last = 3): number {
  const done = sprints
    .filter((s) => s.projectId === projectId && s.status === 'completed')
    .sort((a, b) => b.endAt - a.endAt)
    .slice(0, Math.max(1, last));
  if (done.length === 0) return 0;
  const sum = done.reduce((acc, s) => acc + sprintPoints(s, tasks).done, 0);
  return Math.round((sum / done.length) * 10) / 10;
}

export interface Standup {
  done: string[];
  today: string[];
  blocked: string[];
}

/** Yesterday-done / today-todo / blocked, from sprint task states. */
export function standup(sprint: Sprint, tasks: Task[]): Standup {
  const scoped = sprintTasks(sprint, tasks);
  return {
    done: scoped.filter((t) => t.status === 'completed').map((t) => t.title),
    today: scoped
      .filter((t) => t.status === 'pending' || t.status === 'in_progress')
      .map((t) => t.title),
    blocked: scoped.filter((t) => t.status === 'blocked').map((t) => t.title),
  };
}

export function formatStandup(standup: Standup, i18n: I18n = EN_I18N): string {
  const section = (key: string, items: string[]) =>
    `${i18n.t(key as never)}: ${items.length > 0 ? items.join('; ') : i18n.t('agile.su.none')}`;
  return [
    section('agile.su.yesterday', standup.done),
    section('agile.su.today', standup.today),
    section('agile.su.blocked', standup.blocked),
  ].join('\n');
}

/* ---------------- gantt rows (Roadmap 7.4, lightweight) ---------------- */

export interface GanttRow {
  task: Task;
  /** Clamped bar start (epoch ms). */
  start: number;
  /** Clamped bar end (epoch ms): due → completed → now. */
  end: number;
  overdue: boolean;
  critical: boolean;
}

export interface GanttWindow {
  rows: GanttRow[];
  windowStart: number;
  windowEnd: number;
}

/**
 * Timeline rows for a project's tasks over [now-daysPast, now+daysFuture].
 * Bars clamp to the window; tasks without dates anchor at creation.
 * Never throws.
 */
export function ganttRows(
  tasks: Task[],
  projectId: string,
  now: number = Date.now(),
  daysPast = 14,
  daysFuture = 30,
): GanttWindow {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const windowStart = safeNow - Math.max(1, daysPast) * DAY_MS;
  const windowEnd = safeNow + Math.max(1, daysFuture) * DAY_MS;
  const critical = new Set(criticalChain(tasks, projectId).map((t) => t.id));
  const rows: GanttRow[] = [];
  for (const t of tasks) {
    if (t.projectId !== projectId) continue;
    const done = t.status === 'completed';
    const rawEnd =
      typeof t.dueAt === 'number' && Number.isFinite(t.dueAt)
        ? t.dueAt
        : typeof t.completedAt === 'number'
          ? t.completedAt
          : safeNow;
    const start = Math.min(Math.max(t.createdAt, windowStart), windowEnd);
    const end = Math.min(Math.max(Math.max(rawEnd, start + DAY_MS / 4), windowStart), windowEnd);
    rows.push({
      task: t,
      start,
      end,
      overdue:
        !done && typeof t.dueAt === 'number' && Number.isFinite(t.dueAt) && t.dueAt < safeNow,
      critical: critical.has(t.id),
    });
  }
  rows.sort((a, b) => a.start - b.start || a.task.createdAt - b.task.createdAt);
  return { rows, windowStart, windowEnd };
}

export interface GanttDayLine {
  /** Local midnight for this day (epoch ms). */
  at: number;
  /** JS Date#getDay() (0=Sun..6=Sat), local time. */
  dow: number;
  isWeekend: boolean;
  /** Monday — used to place the week-boundary ruler label. */
  isWeekStart: boolean;
}

/**
 * Local-calendar day boundaries covering [windowStart, windowEnd) for Gantt
 * ruler gridlines, weekend shading and week-start labels. Steps via
 * `setDate(+1)` and re-reads local midnight each time rather than adding a
 * fixed 24h — a fixed increment drifts an hour across a DST transition and
 * would silently misalign every later gridline. Never throws.
 */
export function ganttDayLines(windowStart: number, windowEnd: number): GanttDayLine[] {
  if (!(windowEnd > windowStart)) return [];
  const lines: GanttDayLine[] = [];
  const cursor = new Date(windowStart);
  cursor.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cursor.getTime() < windowEnd && guard++ < 400) {
    const at = cursor.getTime();
    const dow = cursor.getDay();
    lines.push({ at, dow, isWeekend: dow === 0 || dow === 6, isWeekStart: dow === 1 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return lines;
}
