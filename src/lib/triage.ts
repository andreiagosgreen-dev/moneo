/* One-card-at-a-time triage used by the morning ritual. Pure. */
import { addDays, compareDayKeys, noonPlusDays } from './dayKeys';
import { inboxTasks } from './inbox';
import { addTaskToDay, dayPlanHasLinkedTask, type IvyPlan } from './ivyLee';
import { removeTask, setDueAt, type Task } from './tasks';
import { dayKeyInTz } from './timezone';

export type TriageReason = 'inbox';
export type TriageAction = 'today' | 'tomorrow' | 'later' | 'drop';

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

/** Inbox tasks not already on today's list and not dated after today. */
export function buildSuggestions(input: {
  tasks: Task[];
  plans: IvyPlan[];
  todayKey: string;
  timezone?: string;
}): Suggestion[] {
  const tz = input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return inboxTasks(input.tasks)
    .filter((t) => !dayPlanHasLinkedTask(input.plans, input.todayKey, t.id))
    .filter(
      (t) => t.dueAt === undefined || compareDayKeys(dayKeyInTz(t.dueAt, tz), input.todayKey) <= 0,
    )
    .map((t) => ({ key: `inbox:${t.id}`, reason: 'inbox' as const, taskId: t.id, title: t.title }));
}

export function applyTriage(
  state: TriageState,
  s: Suggestion,
  action: TriageAction,
  ctx: { todayKey: string; maxTasks: number; now: number },
): TriageResult {
  const task = s.taskId ? state.tasks.find((t) => t.id === s.taskId) : undefined;
  if (action === 'later') return { ...state, ok: true };
  if (action === 'drop') {
    return {
      tasks: task ? removeTask(state.tasks, task.id) : state.tasks,
      plans: state.plans,
      ok: true,
    };
  }
  if (action === 'today') {
    if (task && dayPlanHasLinkedTask(state.plans, ctx.todayKey, task.id))
      return { ...state, ok: true };
    const res = addTaskToDay(
      state.plans,
      ctx.todayKey,
      task?.title ?? s.title,
      ctx.maxTasks,
      task?.estimateMin,
      task?.id,
    );
    if (!res.added) return { ...state, ok: false, reason: 'full' };
    return { tasks: state.tasks, plans: res.plans, ok: true };
  }
  const tomorrowKey = addDays(ctx.todayKey, 1);
  const plans =
    task && dayPlanHasLinkedTask(state.plans, tomorrowKey, task.id)
      ? state.plans
      : addTaskToDay(
          state.plans,
          tomorrowKey,
          task?.title ?? s.title,
          ctx.maxTasks,
          task?.estimateMin,
          task?.id,
        ).plans;
  const tasks = task ? setDueAt(state.tasks, task.id, noonPlusDays(ctx.now, 1)) : state.tasks;
  return { tasks, plans, ok: true };
}
