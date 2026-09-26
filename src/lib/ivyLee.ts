/* Ivy Lee Method — daily planned tasks. Local-first, additive. */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { dayKeyInTz } from './timezone';

/**
 * The Ivy Lee ritual: each morning write the 6 most important things,
 * ordered. Work strictly in order until done; anything unfinished rolls
 * to tomorrow's list. Minimal, deterministic, zero dependencies.
 */

export interface IvyTask {
  id: string;
  text: string;
  done: boolean;
  rank: number; // 1..6 — position in the list
  /** Estimated minutes (morning ritual). Absent = unestimated. */
  estimateMin?: number;
  /** Real Task this entry mirrors, if any. Absent = plain freeform text. */
  taskId?: string;
}

export interface IvyPlan {
  /** Calendar day key ("YYYY-M-D") in the effective timezone. */
  dateKey: string;
  tasks: IvyTask[];
}

/** Full capacity — Pro tier unlocks all 6 slots. */
export const IVY_MAX_TASKS = 6;
/** Free tier capacity for the daily list. */
export const IVY_FREE_MAX_TASKS = 3;
/** How many past daily plans to retain (rolling window). */
export const IVY_RETENTION_DAYS = 90;

const DAY_MS = 24 * 3600_000;

export function loadPlans(): IvyPlan[] {
  const stored = read<IvyPlan[]>(STORAGE_KEYS.ivyPlans);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((p) => p && typeof p.dateKey === 'string' && Array.isArray(p.tasks))
    .map((p) => ({
      dateKey: p.dateKey,
      tasks: p.tasks
        .filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string')
        .map((t) => ({
          id: t.id,
          text: t.text,
          done: t.done === true,
          rank: typeof t.rank === 'number' ? t.rank : 0,
          ...(typeof t.estimateMin === 'number' && Number.isFinite(t.estimateMin)
            ? { estimateMin: Math.min(480, Math.max(5, Math.round(t.estimateMin))) }
            : {}),
          ...(typeof t.taskId === 'string' && t.taskId ? { taskId: t.taskId } : {}),
        }))
        .sort((a, b) => a.rank - b.rank),
    }));
}

export function savePlans(plans: IvyPlan[]): boolean {
  return write(STORAGE_KEYS.ivyPlans, plans);
}

export function planForDay(plans: IvyPlan[], dateKey: string): IvyPlan | null {
  return plans.find((p) => p.dateKey === dateKey) ?? null;
}

function taskId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `ivy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Upsert one day's plan (prunes anything outside the retention window). */
export function setDayPlan(plans: IvyPlan[], dateKey: string, tasks: IvyTask[]): IvyPlan[] {
  const next = plans.filter((p) => p.dateKey !== dateKey);
  next.push({
    dateKey,
    tasks: tasks.map((t) => ({ ...t })).sort((a, b) => a.rank - b.rank),
  });
  return prune(next);
}

function prune(plans: IvyPlan[]): IvyPlan[] {
  const cutoff = Date.now() - IVY_RETENTION_DAYS * DAY_MS;
  const kept = plans.filter((p) => {
    const [y, m, d] = p.dateKey.split('-').map(Number);
    if (!y || !m || !d) return true; // unknown key — keep rather than drop
    const ts = new Date(y, m - 1, d).getTime();
    return ts >= cutoff;
  });
  return kept.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function addTaskToDay(
  plans: IvyPlan[],
  dateKey: string,
  text: string,
  maxTasks: number = IVY_MAX_TASKS,
  estimateMin?: number,
  linkedTaskId?: string,
): { plans: IvyPlan[]; added: boolean } {
  const clean = text.trim();
  if (!clean) return { plans, added: false };
  const existing = planForDay(plans, dateKey);
  const tasks = existing ? [...existing.tasks] : [];
  if (tasks.length >= maxTasks) return { plans, added: false };
  const rank = tasks.length + 1;
  tasks.push({
    id: taskId(),
    text: clean,
    done: false,
    rank,
    ...(typeof estimateMin === 'number' && Number.isFinite(estimateMin)
      ? { estimateMin: Math.min(480, Math.max(5, Math.round(estimateMin))) }
      : {}),
    ...(typeof linkedTaskId === 'string' && linkedTaskId ? { taskId: linkedTaskId } : {}),
  });
  return { plans: setDayPlan(plans, dateKey, tasks), added: true };
}

/** Set (or clear with null) a planned task's minute estimate. */
export function setPlanEstimate(
  plans: IvyPlan[],
  dateKey: string,
  taskId: string,
  minutes: number | null,
): IvyPlan[] {
  const plan = planForDay(plans, dateKey);
  if (!plan) return plans;
  return setDayPlan(
    plans,
    dateKey,
    plan.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const next: IvyTask = { ...t };
      if (minutes !== null && Number.isFinite(minutes)) {
        next.estimateMin = Math.min(480, Math.max(5, Math.round(minutes)));
      } else delete next.estimateMin;
      return next;
    }),
  );
}

export function togglePlanTask(plans: IvyPlan[], dateKey: string, taskId: string): IvyPlan[] {
  const plan = planForDay(plans, dateKey);
  if (!plan) return plans;
  return setDayPlan(plans, dateKey, [
    ...plan.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
  ]);
}

/** True when today's plan already mirrors this project task. */
export function dayPlanHasLinkedTask(
  plans: IvyPlan[],
  dateKey: string,
  linkedTaskId: string,
): boolean {
  if (!linkedTaskId) return false;
  const plan = planForDay(plans, dateKey);
  return !!plan?.tasks.some((t) => t.taskId === linkedTaskId);
}

export function renamePlanTask(
  plans: IvyPlan[],
  dateKey: string,
  taskId: string,
  text: string,
): IvyPlan[] {
  const clean = text.trim();
  if (!clean) return plans;
  const plan = planForDay(plans, dateKey);
  if (!plan) return plans;
  return setDayPlan(plans, dateKey, [
    ...plan.tasks.map((t) => (t.id === taskId ? { ...t, text: clean } : t)),
  ]);
}

export function removePlanTask(plans: IvyPlan[], dateKey: string, taskId: string): IvyPlan[] {
  const plan = planForDay(plans, dateKey);
  if (!plan) return plans;
  const tasks = plan.tasks.filter((t) => t.id !== taskId).map((t, i) => ({ ...t, rank: i + 1 }));
  return tasks.length === 0
    ? plans.filter((p) => p.dateKey !== dateKey)
    : setDayPlan(plans, dateKey, tasks);
}

/**
 * Re-prioritize by moving a task up (-1) or down (+1) within the day's list.
 * Out-of-range moves leave the list unchanged. Ranks are re-stamped.
 */
export function movePlanTask(
  plans: IvyPlan[],
  dateKey: string,
  taskId: string,
  dir: -1 | 1,
): IvyPlan[] {
  const plan = planForDay(plans, dateKey);
  if (!plan) return plans;
  const idx = plan.tasks.findIndex((t) => t.id === taskId);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= plan.tasks.length) return plans;
  const tasks = [...plan.tasks];
  [tasks[idx], tasks[swap]] = [tasks[swap], tasks[idx]];
  return setDayPlan(
    plans,
    dateKey,
    tasks.map((t, i) => ({ ...t, rank: i + 1 })),
  );
}

export function planDoneCount(plan: IvyPlan | null): number {
  return plan ? plan.tasks.filter((t) => t.done).length : 0;
}

export function planUnfinished(plan: IvyPlan | null): IvyTask[] {
  return plan ? plan.tasks.filter((t) => !t.done) : [];
}

/**
 * Ivy Lee carry-over: build today's list from yesterday's unfinished items
 * when today has no plan yet. Returns the updated plans plus whether the
 * list changed, so the caller can persist once.
 */
export function carryForNewDay(
  plans: IvyPlan[],
  timezone: string,
): { plans: IvyPlan[]; changed: boolean } {
  const todayKey = dayKeyInTz(Date.now(), timezone);
  if (planForDay(plans, todayKey)) return { plans, changed: false };
  const yesterdayKey = dayKeyInTz(Date.now() - DAY_MS, timezone);
  const unfinished = planUnfinished(planForDay(plans, yesterdayKey));
  if (unfinished.length === 0) return { plans, changed: false };
  const tasks: IvyTask[] = unfinished.map((t, i) => ({
    id: taskId(),
    text: t.text,
    done: false,
    rank: i + 1,
  }));
  return {
    plans: setDayPlan(plans, todayKey, tasks),
    changed: true,
  };
}

/* ---------- analytics ---------- */

export interface IvyAnalytics {
  /** Average completion fraction (0..1) across recent active days. */
  average: number;
  /** Days (within the last 7) where every planned task was completed. */
  perfectDays: number;
  /** Active planned days within the last 7 with at least one task. */
  activeDays: number;
}

export function getIvyAnalytics(plans: IvyPlan[]): IvyAnalytics {
  const now = Date.now();
  const weekFloor = now - 7 * DAY_MS;
  const recent = plans
    .filter((p) => {
      const [y, m, d] = p.dateKey.split('-').map(Number);
      if (!y || !m || !d) return true;
      return new Date(y, m - 1, d).getTime() >= weekFloor;
    })
    .filter((p) => p.tasks.length > 0);

  const totalDays = recent.length;
  if (totalDays === 0) return { average: 0, perfectDays: 0, activeDays: 0 };

  const totalFraction = recent.reduce((sum, p) => {
    const done = p.tasks.filter((t) => t.done).length;
    return sum + done / p.tasks.length;
  }, 0);

  const perfect = recent.filter((p) => p.tasks.every((t) => t.done)).length;

  return {
    average: totalFraction / totalDays,
    perfectDays: perfect,
    activeDays: totalDays,
  };
}
