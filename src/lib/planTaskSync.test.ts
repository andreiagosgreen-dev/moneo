import { describe, it, expect } from 'vitest';
import { planForDay, setDayPlan, type IvyPlan, type IvyTask } from './ivyLee';
import type { Task } from './tasks';
import { setTaskDone, syncPlanWithTasks, togglePlanItem } from './planTaskSync';

const DAY = '2026-9-27';

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'p1',
    title: id,
    status: 'pending',
    priority: 'p2',
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

function plan(items: Array<Partial<IvyTask> & { id: string }>): IvyPlan[] {
  return setDayPlan(
    [],
    DAY,
    items.map((x, i) => ({ text: x.id, done: false, rank: i + 1, ...x })),
  );
}

const item = (plans: IvyPlan[], id: string) =>
  planForDay(plans, DAY)!.tasks.find((x) => x.id === id)!;
const status = (tasks: Task[], id: string) => tasks.find((t) => t.id === id)!.status;

describe('togglePlanItem', () => {
  it('ticking a linked item completes the project task', () => {
    const r = togglePlanItem(plan([{ id: 'i1', taskId: 't1' }]), DAY, 'i1', [task('t1')]);
    expect(item(r.plans, 'i1').done).toBe(true);
    expect(status(r.tasks, 't1')).toBe('completed');
    expect(r.tasks[0].completedAt).toBeTypeOf('number');
  });

  it('unticking a linked item reopens the project task', () => {
    const r = togglePlanItem(plan([{ id: 'i1', taskId: 't1', done: true }]), DAY, 'i1', [
      task('t1', { status: 'completed', completedAt: 5 }),
    ]);
    expect(item(r.plans, 'i1').done).toBe(false);
    expect(status(r.tasks, 't1')).toBe('pending');
    expect(r.tasks[0].completedAt).toBeUndefined();
  });

  it('plain items flip without touching tasks', () => {
    const tasks = [task('t1')];
    const r = togglePlanItem(plan([{ id: 'i1' }]), DAY, 'i1', tasks);
    expect(item(r.plans, 'i1').done).toBe(true);
    expect(r.tasks).toBe(tasks);
  });

  it('items whose task was deleted still flip locally', () => {
    const tasks: Task[] = [];
    const r = togglePlanItem(plan([{ id: 'i1', taskId: 'gone' }]), DAY, 'i1', tasks);
    expect(item(r.plans, 'i1').done).toBe(true);
    expect(r.tasks).toBe(tasks);
  });

  it('a blocked task stays open and the item stays unticked', () => {
    const tasks = [task('t0'), task('t1', { blockedBy: ['t0'] })];
    const r = togglePlanItem(plan([{ id: 'i1', taskId: 't1' }]), DAY, 'i1', tasks);
    expect(status(r.tasks, 't1')).toBe('pending');
    expect(item(r.plans, 'i1').done).toBe(false);
  });

  it('completing the last subtask rolls up to the parent', () => {
    const tasks = [
      task('parent'),
      task('a', { parentId: 'parent', status: 'completed' }),
      task('b', { parentId: 'parent' }),
    ];
    const r = togglePlanItem(plan([{ id: 'i1', taskId: 'b' }]), DAY, 'i1', tasks);
    expect(status(r.tasks, 'parent')).toBe('completed');
  });

  it('recurring tasks spawn their next instance', () => {
    const r = togglePlanItem(plan([{ id: 'i1', taskId: 't1' }]), DAY, 'i1', [
      task('t1', { recurrence: 'daily' }),
    ]);
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks[1].status).toBe('pending');
  });

  it('unknown item or day is a no-op', () => {
    const plans = plan([{ id: 'i1' }]);
    const tasks = [task('t1')];
    expect(togglePlanItem(plans, DAY, 'nope', tasks)).toEqual({ plans, tasks });
    expect(togglePlanItem(plans, '2026-1-1', 'i1', tasks)).toEqual({ plans, tasks });
  });
});

describe('syncPlanWithTasks', () => {
  it('marks linked items done when their task completes elsewhere', () => {
    const plans = plan([{ id: 'i1', taskId: 't1' }, { id: 'i2' }]);
    const next = syncPlanWithTasks(plans, DAY, [task('t1', { status: 'completed' })]);
    expect(next).not.toBeNull();
    expect(item(next!, 'i1').done).toBe(true);
    expect(item(next!, 'i2').done).toBe(false);
  });

  it('reopens linked items when their task is reopened', () => {
    const plans = plan([{ id: 'i1', taskId: 't1', done: true }]);
    const next = syncPlanWithTasks(plans, DAY, [task('t1')]);
    expect(item(next!, 'i1').done).toBe(false);
  });

  it('returns null when already in step, for plain items, or deleted tasks', () => {
    const plans = plan([
      { id: 'i1', taskId: 't1', done: true },
      { id: 'i2', done: true },
      { id: 'i3', taskId: 'gone', done: true },
    ]);
    expect(syncPlanWithTasks(plans, DAY, [task('t1', { status: 'completed' })])).toBeNull();
    expect(syncPlanWithTasks(plans, '2026-1-1', [])).toBeNull();
  });
});

describe('setTaskDone', () => {
  it('is a no-op when the status already matches', () => {
    const tasks = [task('t1', { status: 'completed' }), task('t2')];
    expect(setTaskDone(tasks, 't1', true)).toBe(tasks);
    expect(setTaskDone(tasks, 't2', false)).toBe(tasks);
    expect(setTaskDone(tasks, 'missing', true)).toBe(tasks);
  });
});
