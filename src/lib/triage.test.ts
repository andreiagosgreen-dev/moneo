import { describe, expect, it } from 'vitest';
import { applyTriage, buildSuggestions, snoozeToTomorrow } from './triage';
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
    expect(s.map((x) => [x.reason, x.taskId])).toEqual([
      ['overdue', 'overdue'],
      ['inbox', 'a'],
    ]);
    expect(s[1]).toMatchObject({ key: 'inbox:a', reason: 'inbox', title: 'Idea' });
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

describe('triage — suggestions for today', () => {
  const day = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
  const proj = (over: Partial<Task>) => task({ projectId: 'p1', ...over });
  const carried = (over: Partial<IvyPlan['tasks'][number]>) => ({
    id: 'c1',
    text: 'Left',
    done: false,
    rank: 1,
    carried: true as const,
    ...over,
  });

  it('orders overdue (oldest first), due today, yesterday, inbox and dedupes', () => {
    const tasks = [
      proj({ id: 'late2', title: 'Late 2', dueAt: day(9, 29) }),
      proj({ id: 'late1', title: 'Late 1', dueAt: day(9, 20) }),
      proj({ id: 'today', title: 'Today', dueAt: day(9, 30, 18) }),
      proj({ id: 'planned', title: 'Planned', dueAt: day(9, 30) }),
      proj({ id: 'done', status: 'completed', dueAt: day(9, 1) }),
      proj({ id: 'carriedLate', title: 'Carried late', dueAt: day(9, 25) }),
      task({ id: 'inbox', title: 'Inbox idea' }),
    ];
    const plans: IvyPlan[] = [
      {
        dateKey: TODAY,
        tasks: [
          { id: 'p', text: 'Planned', done: false, rank: 1, taskId: 'planned' },
          carried({ id: 'c1', rank: 2, taskId: 'carriedLate', text: 'Carried late' }),
          carried({ id: 'c2', rank: 3, text: 'Freeform left' }),
        ],
      },
    ];
    const s = buildSuggestions({ tasks, plans, todayKey: TODAY, timezone: TZ });
    expect(s.map((x) => `${x.reason}:${x.title}`)).toEqual([
      'overdue:Late 1',
      'overdue:Carried late',
      'overdue:Late 2',
      'dueToday:Today',
      'yesterday:Freeform left',
      'inbox:Inbox idea',
    ]);
    expect(s[1].planItemId).toBe('c1');
  });

  it('"today" on an overdue task plans it and dates it today (keeping the time)', () => {
    const state = {
      tasks: [proj({ dueAt: day(9, 25, 8), dueHasTime: true })],
      plans: [] as IvyPlan[],
    };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    const res = applyTriage(state, s, 'today', ctx);
    expect(res.plans[0].tasks[0].taskId).toBe('t1');
    expect(res.tasks[0]).toMatchObject({ dueAt: day(9, 30, 8), dueHasTime: true });
  });

  it('"today" on a carried item just keeps it (no longer carried)', () => {
    const state = { tasks: [] as Task[], plans: [{ dateKey: TODAY, tasks: [carried({})] }] };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    const res = applyTriage(state, s, 'today', ctx);
    expect(res.plans[0].tasks[0].carried).toBeUndefined();
    expect(res.plans[0].tasks).toHaveLength(1);
  });

  it('"today" respects capacity', () => {
    const state = { tasks: [proj({ dueAt: day(9, 30) })], plans: [full] };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    expect(applyTriage(state, s, 'today', ctx)).toMatchObject({ ok: false, reason: 'full' });
  });

  it('"tomorrow" moves a carried linked item to tomorrow and re-dates the task', () => {
    const state = {
      tasks: [proj({ dueAt: day(9, 29) })],
      plans: [{ dateKey: TODAY, tasks: [carried({ taskId: 't1', text: 'Idea' })] }],
    };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    const res = applyTriage(state, s, 'tomorrow', ctx);
    expect(res.plans.find((p) => p.dateKey === TODAY)!.tasks).toEqual([]);
    expect(res.plans.find((p) => p.dateKey === '2026-10-1')!.tasks[0].taskId).toBe('t1');
    expect(res.tasks[0].dueAt).toBe(day(10, 1));
  });

  it('"later" and "drop" never delete a project task; they clear the date', () => {
    const state = {
      tasks: [proj({ dueAt: day(9, 29) })],
      plans: [] as IvyPlan[],
    };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    for (const action of ['later', 'drop'] as const) {
      const res = applyTriage(state, s, action, ctx);
      expect(res.tasks).toHaveLength(1);
      expect(res.tasks[0].dueAt).toBeUndefined();
    }
  });

  it('"drop" removes a carried freeform item', () => {
    const state = { tasks: [] as Task[], plans: [{ dateKey: TODAY, tasks: [carried({})] }] };
    const [s] = buildSuggestions({ ...state, todayKey: TODAY, timezone: TZ });
    expect(applyTriage(state, s, 'drop', ctx).plans).toEqual([{ dateKey: TODAY, tasks: [] }]);
  });

  it('snoozeToTomorrow moves one Today item', () => {
    const state = {
      tasks: [proj({ dueAt: day(9, 30) })],
      plans: [
        {
          dateKey: TODAY,
          tasks: [{ id: 'x', text: 'Idea', done: false, rank: 1, taskId: 't1' }],
        },
      ],
    };
    const res = snoozeToTomorrow(state, 'x', ctx);
    expect(res.plans.find((p) => p.dateKey === TODAY)!.tasks).toEqual([]);
    expect(res.plans.find((p) => p.dateKey === '2026-10-1')!.tasks[0].taskId).toBe('t1');
    expect(res.tasks[0].dueAt).toBe(day(10, 1));
    expect(snoozeToTomorrow(state, 'missing', ctx)).toBe(state);
  });
});
