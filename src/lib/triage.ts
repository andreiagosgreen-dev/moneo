/* One-card-at-a-time triage used by the morning ritual. Pure. */
import { addDays, compareDayKeys } from './dayKeys';
import { isInboxTask } from './inbox';
import {
  addTaskToDay,
  dayPlanHasLinkedTask,
  planForDay,
  setDayPlan,
  type IvyPlan,
  type IvyTask,
} from './ivyLee';
import { removeTask, setDueAt, type Task } from './tasks';
import { dayKeyInTz } from './timezone';

export type TriageReason = 'inbox' | 'overdue' | 'dueToday' | 'yesterday';
export type TriageAction = 'today' | 'tomorrow' | 'later' | 'drop';

/** "Later" on a dated task clears the date (it stays in its project). */
export const LATER_POLICY = 'clear' as const;

export interface Suggestion {
  key: string;
  reason: TriageReason;
  taskId?: string;
  planItemId?: string;
  title: string;
}

export interface TriageState {
  tasks: Task[];
  plans: IvyPlan[];
}

export interface TriageResult extends TriageState {
  ok: boolean;
  reason?: 'full';
}

export interface TriageCtx {
  todayKey: string;
  maxTasks: number;
  now: number;
}

/**
 * Overdue (oldest first) → due today → left from yesterday → inbox.
 * One card per task; tasks already on today's list are skipped unless the
 * item was carried over from yesterday.
 */
export function buildSuggestions(input: {
  tasks: Task[];
  plans: IvyPlan[];
  todayKey: string;
  timezone?: string;
}): Suggestion[] {
  const tz = input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = planForDay(input.plans, input.todayKey)?.tasks ?? [];
  const itemFor = (id: string) => today.find((i) => i.taskId === id);
  const byId = new Map(input.tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  const push = (reason: TriageReason, t: Task, item?: IvyTask) => {
    seen.add(t.id);
    out.push({
      key: `${reason}:${t.id}`,
      reason,
      taskId: t.id,
      ...(item ? { planItemId: item.id } : {}),
      title: t.title,
    });
  };
  const eligible = (t: Task) => {
    const item = itemFor(t.id);
    return !item || (item.carried === true && !item.done);
  };

  const dated = input.tasks
    .filter((t) => t.status !== 'completed' && t.dueAt !== undefined && eligible(t))
    .map((t) => ({ t, key: dayKeyInTz(t.dueAt!, tz) }));
  dated
    .filter((x) => compareDayKeys(x.key, input.todayKey) < 0)
    .sort((a, b) => compareDayKeys(a.key, b.key) || a.t.dueAt! - b.t.dueAt!)
    .forEach((x) => push('overdue', x.t, itemFor(x.t.id)));
  dated
    .filter((x) => x.key === input.todayKey && !seen.has(x.t.id))
    .forEach((x) => push('dueToday', x.t, itemFor(x.t.id)));

  for (const item of today) {
    if (item.carried !== true || item.done) continue;
    const t = item.taskId ? byId.get(item.taskId) : undefined;
    if (t && (seen.has(t.id) || t.status === 'completed')) continue;
    if (t) seen.add(t.id);
    out.push({
      key: `yesterday:${item.id}`,
      reason: 'yesterday',
      ...(t ? { taskId: t.id } : {}),
      planItemId: item.id,
      title: t?.title ?? item.text,
    });
  }

  input.tasks
    .filter(isInboxTask)
    .sort((a, b) => a.createdAt - b.createdAt)
    .filter((t) => !seen.has(t.id) && !dayPlanHasLinkedTask(input.plans, input.todayKey, t.id))
    .filter(
      (t) => t.dueAt === undefined || compareDayKeys(dayKeyInTz(t.dueAt, tz), input.todayKey) <= 0,
    )
    .forEach((t) => push('inbox', t));

  return out;
}

/** Move a task's due date to `days` after today, keeping a chosen time of day. */
function moveDue(tasks: Task[], task: Task, days: number, now: number): Task[] {
  const src = task.dueHasTime && task.dueAt !== undefined ? new Date(task.dueAt) : null;
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(src ? src.getHours() : 12, src ? src.getMinutes() : 0, 0, 0);
  const next = setDueAt(tasks, task.id, d.getTime());
  return src ? next.map((t) => (t.id === task.id ? { ...t, dueHasTime: true as const } : t)) : next;
}

/** Remove one item but keep today's (possibly empty) plan, so carry-over doesn't refill it. */
function removeItem(plans: IvyPlan[], key: string, itemId: string): IvyPlan[] {
  const plan = planForDay(plans, key);
  if (!plan) return plans;
  return setDayPlan(
    plans,
    key,
    plan.tasks.filter((i) => i.id !== itemId).map((i, n) => ({ ...i, rank: n + 1 })),
  );
}

function uncarry(plans: IvyPlan[], key: string, itemId: string): IvyPlan[] {
  const plan = planForDay(plans, key);
  if (!plan) return plans;
  return setDayPlan(
    plans,
    key,
    plan.tasks.map((i) => {
      if (i.id !== itemId) return i;
      const next: IvyTask = { ...i };
      delete next.carried;
      return next;
    }),
  );
}

function addTomorrow(
  plans: IvyPlan[],
  ctx: TriageCtx,
  title: string,
  task: Task | undefined,
  estimateMin?: number,
): IvyPlan[] {
  const key = addDays(ctx.todayKey, 1);
  if (task && dayPlanHasLinkedTask(plans, key, task.id)) return plans;
  return addTaskToDay(plans, key, title, ctx.maxTasks, estimateMin, task?.id).plans;
}

export function applyTriage(
  state: TriageState,
  s: Suggestion,
  action: TriageAction,
  ctx: TriageCtx,
): TriageResult {
  const task = s.taskId ? state.tasks.find((t) => t.id === s.taskId) : undefined;
  const todayItems = planForDay(state.plans, ctx.todayKey)?.tasks ?? [];
  const item = s.planItemId
    ? todayItems.find((i) => i.id === s.planItemId)
    : task
      ? todayItems.find((i) => i.taskId === task.id)
      : undefined;
  const title = task?.title ?? item?.text ?? s.title;
  const estimate = task?.estimateMin ?? item?.estimateMin;
  const withoutItem = item ? removeItem(state.plans, ctx.todayKey, item.id) : state.plans;

  if (action === 'today') {
    let plans = state.plans;
    if (item) plans = uncarry(plans, ctx.todayKey, item.id);
    else {
      const res = addTaskToDay(plans, ctx.todayKey, title, ctx.maxTasks, estimate, task?.id);
      if (!res.added) return { ...state, ok: false, reason: 'full' };
      plans = res.plans;
    }
    const tasks =
      task && s.reason === 'overdue' ? moveDue(state.tasks, task, 0, ctx.now) : state.tasks;
    return { tasks, plans, ok: true };
  }

  if (action === 'tomorrow') {
    const plans = addTomorrow(withoutItem, ctx, title, task, estimate);
    const tasks = task ? moveDue(state.tasks, task, 1, ctx.now) : state.tasks;
    return { tasks, plans, ok: true };
  }

  if (action === 'later') {
    if (s.reason === 'inbox') return { ...state, ok: true };
    const tasks =
      task && task.dueAt !== undefined && LATER_POLICY === 'clear'
        ? setDueAt(state.tasks, task.id, null)
        : state.tasks;
    return { tasks, plans: withoutItem, ok: true };
  }

  // drop: inbox tasks are deleted; project tasks only leave today and lose the date.
  if (task && isInboxTask(task)) {
    return { tasks: removeTask(state.tasks, task.id), plans: withoutItem, ok: true };
  }
  const tasks =
    task && task.dueAt !== undefined ? setDueAt(state.tasks, task.id, null) : state.tasks;
  return { tasks, plans: withoutItem, ok: true };
}

/** One-tap "tomorrow" for a single item on today's list. */
export function snoozeToTomorrow(
  state: TriageState,
  planItemId: string,
  ctx: TriageCtx,
): TriageState {
  const item = planForDay(state.plans, ctx.todayKey)?.tasks.find((i) => i.id === planItemId);
  if (!item) return state;
  const s: Suggestion = {
    key: `snooze:${item.id}`,
    reason: 'yesterday',
    ...(item.taskId ? { taskId: item.taskId } : {}),
    planItemId: item.id,
    title: item.text,
  };
  const res = applyTriage(state, s, 'tomorrow', ctx);
  return { tasks: res.tasks, plans: res.plans };
}
