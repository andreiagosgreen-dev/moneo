/* Keeps the daily plan (Azi / Focus "up next") and project tasks in step. */
import { planForDay, setDayPlan, togglePlanTask, type IvyPlan } from './ivyLee';
import { completeTask, syncParentCompletion, updateTaskStatus, type Task } from './tasks';

/**
 * Complete or reopen a project task exactly like the Projects checkbox does:
 * recurrence spawn + blocker gate on complete, parent roll-up either way.
 */
export function setTaskDone(tasks: Task[], taskId: string, done: boolean): Task[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;
  if (done) {
    if (task.status === 'completed') return tasks;
    return syncParentCompletion(completeTask(tasks, taskId).tasks, taskId);
  }
  if (task.status !== 'completed') return tasks;
  return syncParentCompletion(updateTaskStatus(tasks, taskId, 'pending'), taskId);
}

/**
 * Tick a plan item. Linked items drive their project task and then mirror its
 * real status (a blocked task stays unticked); plain items just flip.
 */
export function togglePlanItem(
  plans: IvyPlan[],
  dateKey: string,
  itemId: string,
  tasks: Task[],
): { plans: IvyPlan[]; tasks: Task[] } {
  const item = planForDay(plans, dateKey)?.tasks.find((x) => x.id === itemId);
  if (!item) return { plans, tasks };
  const linked = item.taskId ? tasks.find((t) => t.id === item.taskId) : undefined;
  if (!linked) return { plans: togglePlanTask(plans, dateKey, itemId), tasks };
  const nextTasks = setTaskDone(tasks, linked.id, !item.done);
  const synced = syncPlanWithTasks(plans, dateKey, nextTasks);
  return { plans: synced ?? plans, tasks: nextTasks };
}

/**
 * Mirror project task status onto that day's linked plan items. Returns null
 * when nothing changed. Items whose task was deleted are left alone.
 */
export function syncPlanWithTasks(
  plans: IvyPlan[],
  dateKey: string,
  tasks: Task[],
): IvyPlan[] | null {
  const plan = planForDay(plans, dateKey);
  if (!plan) return null;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let changed = false;
  const next = plan.tasks.map((item) => {
    const task = item.taskId ? byId.get(item.taskId) : undefined;
    if (!task) return item;
    const done = task.status === 'completed';
    if (done === item.done) return item;
    changed = true;
    return { ...item, done };
  });
  return changed ? setDayPlan(plans, dateKey, next) : null;
}
