import { describe, expect, it } from 'vitest';
import { applyTriage, buildSuggestions } from './triage';
import type { IvyPlan } from './ivyLee';
import type { Task } from './tasks';

const NOW = new Date(2026, 8, 30, 10, 0).getTime();
const TODAY = '2026-9-30';
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ctx = { todayKey: TODAY, maxTasks: 3, now: NOW };

function task(over: Partial<Task>): Task {
  return {
    id: 't1',
    projectId: '',
    title: 'Idea',
    status: 'pending',
    priority: 'p2',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

const full: IvyPlan = {
  dateKey: TODAY,
  tasks: [1, 2, 3].map((rank) => ({ id: `i${rank}`, text: `x${rank}`, done: false, rank })),
};

describe('triage — inbox suggestions', () => {
  it('suggests inbox tasks not already planned today and not dated later', () => {
    const tasks = [
      task({ id: 'a', createdAt: 1 }),
      task({ id: 'b', createdAt: 2 }),
      task({ id: 'later', createdAt: 3, dueAt: new Date(2026, 9, 2, 12).getTime() }),
      task({ id: 'overdue', createdAt: 4, dueAt: new Date(2026, 8, 28, 12).getTime() }),
      task({ id: 'proj', projectId: 'p1' }),
    ];
    const plans: IvyPlan[] = [
      { dateKey: TODAY, tasks: [{ id: 'i1', text: 'Idea', done: false, rank: 1, taskId: 'b' }] },
    ];
    const s = buildSuggestions({ tasks, plans, todayKey: TODAY, timezone: TZ });
    expect(s.map((x) => x.taskId)).toEqual(['a', 'overdue']);
    expect(s[0]).toMatchObject({ key: 'inbox:a', reason: 'inbox', title: 'Idea' });
  });

  it('"today" adds a linked item to today\'s list', () => {
    const state = { tasks: [task({ estimateMin: 25 })], plans: [] as IvyPlan[] };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    const res = applyTriage(state, s, 'today', ctx);
    expect(res.ok).toBe(true);
    expect(res.plans[0].tasks[0]).toMatchObject({ text: 'Idea', taskId: 't1', estimateMin: 25 });
  });

  it('"today" fails when the list is full and changes nothing', () => {
    const state = { tasks: [task({})], plans: [full] };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    const res = applyTriage(state, s, 'today', ctx);
    expect(res).toMatchObject({ ok: false, reason: 'full' });
    expect(res.plans).toBe(state.plans);
  });

  it('"tomorrow" plans it for tomorrow and dates it tomorrow', () => {
    const state = { tasks: [task({})], plans: [] as IvyPlan[] };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    const res = applyTriage(state, s, 'tomorrow', ctx);
    expect(res.ok).toBe(true);
    expect(res.plans.find((p) => p.dateKey === '2026-10-1')?.tasks[0].taskId).toBe('t1');
    expect(res.tasks[0].dueAt).toBe(new Date(2026, 9, 1, 12).getTime());
  });

  it('"later" keeps everything; "drop" deletes the task', () => {
    const state = { tasks: [task({})], plans: [] as IvyPlan[] };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    const later = applyTriage(state, s, 'later', ctx);
    expect(later.tasks).toBe(state.tasks);
    expect(later.plans).toBe(state.plans);
    expect(applyTriage(state, s, 'drop', ctx).tasks).toHaveLength(0);
  });
});
