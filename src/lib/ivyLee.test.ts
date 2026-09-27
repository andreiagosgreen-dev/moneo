import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dayKeyInTz } from './timezone';
import {
  loadPlans,
  savePlans,
  planForDay,
  setDayPlan,
  addTaskToDay,
  togglePlanTask,
  renamePlanTask,
  removePlanTask,
  movePlanTask,
  setPlanEstimate,
  planDoneCount,
  carryForNewDay,
  getIvyAnalytics,
  dayPlanHasLinkedTask,
  IVY_MAX_TASKS,
  IVY_FREE_MAX_TASKS,
  IVY_RETENTION_DAYS,
  type IvyTask,
} from './ivyLee';

const TZ = 'UTC';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('constants', () => {
  it('Ivy Lee capacity is 6; free tier 3', () => {
    expect(IVY_MAX_TASKS).toBe(6);
    expect(IVY_FREE_MAX_TASKS).toBe(3);
    expect(IVY_RETENTION_DAYS).toBeGreaterThan(0);
  });
});

describe('storage round-trip', () => {
  it('persists plans and restores normalized tasks', () => {
    savePlans([
      {
        dateKey: '2026-9-15',
        tasks: [
          { id: 't1', text: 'Ship landing page', done: true, rank: 1 },
          { id: 't2', text: 'Review PR', done: false, rank: 2 },
        ],
      },
    ]);
    const plans = loadPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].tasks[0]).toMatchObject({
      id: 't1',
      text: 'Ship landing page',
      done: true,
      rank: 1,
    });
    expect(plans[0].tasks).toHaveLength(2);
  });

  it('defaults malformed tasks gracefully', () => {
    savePlans([
      {
        dateKey: '2026-9-15',
        tasks: [
          { id: 't1', text: 'ok', done: 'yes' as never, rank: 1 },
          { text: 'no id' } as never,
        ],
      },
    ]);
    const plans = loadPlans();
    expect(plans[0].tasks).toHaveLength(1);
    expect(plans[0].tasks[0].done).toBe(false);
  });
});

describe('setDayPlan / addTaskToDay', () => {
  it('adds a task with the next rank', () => {
    const r = addTaskToDay([], '2026-9-16', '  Write docs  ');
    expect(r.added).toBe(true);
    const plan = planForDay(r.plans, '2026-9-16')!;
    expect(plan.tasks[0].text).toBe('Write docs');
    expect(plan.tasks[0].rank).toBe(1);
  });

  it('respects a capacity cap', () => {
    let r = addTaskToDay([], '2026-9-16', 'A');
    r = addTaskToDay(r.plans, '2026-9-16', 'B');
    r = addTaskToDay(r.plans, '2026-9-16', 'C');
    const before = r.plans;
    const full = addTaskToDay(before, '2026-9-16', 'D', IVY_FREE_MAX_TASKS);
    expect(full.added).toBe(false);
    expect(planForDay(full.plans, '2026-9-16')!.tasks).toHaveLength(IVY_FREE_MAX_TASKS);
  });

  it('rejects blank text', () => {
    const r = addTaskToDay([], '2026-9-16', '   ');
    expect(r.added).toBe(false);
  });

  it('attaches a linked taskId when given, and round-trips it through storage', () => {
    const withLink = addTaskToDay([], '2026-9-16', 'Real task', 6, undefined, 'task-123');
    const plan = planForDay(withLink.plans, '2026-9-16')!;
    expect(plan.tasks[0].taskId).toBe('task-123');
    savePlans(withLink.plans);
    const reloaded = loadPlans();
    expect(planForDay(reloaded, '2026-9-16')!.tasks[0].taskId).toBe('task-123');
  });

  it('omits taskId entirely when not given', () => {
    const r = addTaskToDay([], '2026-9-16', 'Plain text');
    const plan = planForDay(r.plans, '2026-9-16')!;
    expect(plan.tasks[0].taskId).toBeUndefined();
    expect('taskId' in plan.tasks[0]).toBe(false);
  });
});

describe('toggle / rename / remove', () => {
  let plans = setDayPlan([], '2026-9-16', [
    { id: 't1', text: 'A', done: false, rank: 1 },
    { id: 't2', text: 'B', done: false, rank: 2 },
  ]);

  it('toggles completion', () => {
    plans = togglePlanTask(plans, '2026-9-16', 't1');
    expect(planForDay(plans, '2026-9-16')!.tasks[0].done).toBe(true);
    expect(planDoneCount(planForDay(plans, '2026-9-16'))).toBe(1);
  });

  it('renames a task', () => {
    plans = renamePlanTask(plans, '2026-9-16', 't2', '  B renamed ');
    expect(planForDay(plans, '2026-9-16')!.tasks[1].text).toBe('B renamed');
  });

  it('removes a task and re-ranks the rest', () => {
    plans = removePlanTask(plans, '2026-9-16', 't1');
    const plan = planForDay(plans, '2026-9-16')!;
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].rank).toBe(1);
    expect(plan.tasks[0].text).toBe('B renamed');
  });
});

describe('carryForNewDay', () => {
  it("moves yesterday's unfinished tasks into a fresh day", () => {
    const todayKey = dayKeyInTz(Date.now(), TZ);
    const yKey = dayKeyInTz(Date.now() - 24 * 3600_000, TZ);
    const yesterdayPlan = setDayPlan([], yKey, [
      { id: 't1', text: 'Unfinished task', done: false, rank: 1 },
      { id: 't2', text: 'Done task', done: true, rank: 2 },
    ]);
    const { plans, changed } = carryForNewDay(yesterdayPlan, TZ);
    expect(changed).toBe(true);
    const today = plans.find((p) => p.dateKey === todayKey);
    expect(today).toBeDefined();
    expect(today!.tasks.map((t) => t.text)).toEqual(['Unfinished task']);
    expect(today!.tasks.every((t) => !t.done)).toBe(true);
  });

  it('does nothing when today already has a plan', () => {
    const todayKey = dayKeyInTz(Date.now(), TZ);
    const withToday = setDayPlan([], todayKey, [
      { id: 't1', text: 'Fresh plan', done: false, rank: 1 },
    ]);
    const { plans, changed } = carryForNewDay(withToday, TZ);
    expect(changed).toBe(false);
    expect(plans).toHaveLength(1);
  });

  it('does nothing when nothing needs carrying', () => {
    const yKey = dayKeyInTz(Date.now() - 24 * 3600_000, TZ);
    const doneAll = setDayPlan([], yKey, [{ id: 't1', text: 'Finished', done: true, rank: 1 }]);
    const { plans, changed } = carryForNewDay(doneAll, TZ);
    expect(changed).toBe(false);
    void plans;
  });
});

describe('dayPlanHasLinkedTask', () => {
  it('detects linked project tasks on the day plan', () => {
    const key = '2026-9-25';
    const plans = setDayPlan([], key, [
      { id: 'i1', text: 'Hard thing', done: false, rank: 1, taskId: 'task-9' },
    ]);
    expect(dayPlanHasLinkedTask(plans, key, 'task-9')).toBe(true);
    expect(dayPlanHasLinkedTask(plans, key, 'other')).toBe(false);
    expect(dayPlanHasLinkedTask([], key, 'task-9')).toBe(false);
  });
});

describe('getIvyAnalytics', () => {
  function plan(dateKey: string, done: number, total: number) {
    const tasks: IvyTask[] = Array.from({ length: total }, (_, i) => ({
      id: `t${i}`,
      text: `task ${i}`,
      done: i < done,
      rank: i + 1,
    }));
    return { dateKey, tasks };
  }

  it('computes average completion and perfect days', () => {
    // Keys must stay inside getIvyAnalytics's rolling 7-day window, so
    // derive them from now instead of hardcoding calendar dates.
    const key = (daysAgo: number) => dayKeyInTz(Date.now() - daysAgo * 24 * 3600_000, TZ);
    const plans = [
      plan(key(1), 3, 3), // perfect (100%)
      plan(key(2), 2, 4), // 50%
      plan(key(3), 0, 2), // 0%
    ];
    const analytics = getIvyAnalytics(plans);
    expect(analytics.activeDays).toBe(3);
    expect(analytics.perfectDays).toBe(1);
    expect(analytics.average).toBeCloseTo((1 + 0.5 + 0) / 3, 5);
  });

  it('ignores days with no tasks', () => {
    const analytics = getIvyAnalytics([{ dateKey: '2026-9-10', tasks: [] }]);
    expect(analytics.activeDays).toBe(0);
    expect(analytics.average).toBe(0);
  });
});

describe('movePlanTask', () => {
  const plans = [
    {
      dateKey: '2026-9-16',
      tasks: [
        { id: 'a', text: 'A', done: false, rank: 1 },
        { id: 'b', text: 'B', done: false, rank: 2 },
        { id: 'c', text: 'C', done: false, rank: 3 },
      ],
    },
  ];

  it('swaps with the neighbor and re-stamps ranks', () => {
    const next = planForDay(movePlanTask(plans, '2026-9-16', 'b', -1), '2026-9-16')!;
    expect(next.tasks.map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(next.tasks.map((t) => t.rank)).toEqual([1, 2, 3]);
    const down = planForDay(movePlanTask(plans, '2026-9-16', 'b', 1), '2026-9-16')!;
    expect(down.tasks.map((t) => t.id)).toEqual(['a', 'c', 'b']);
  });

  it('ignores out-of-range moves and unknown ids/days', () => {
    expect(movePlanTask(plans, '2026-9-16', 'a', -1)).toBe(plans);
    expect(movePlanTask(plans, '2026-9-16', 'c', 1)).toBe(plans);
    expect(movePlanTask(plans, '2026-9-16', 'ghost', 1)).toBe(plans);
    expect(movePlanTask(plans, '2026-9-99', 'a', 1)).toBe(plans);
  });
});

describe('setPlanEstimate', () => {
  const plans = [
    {
      dateKey: '2026-9-16',
      tasks: [
        { id: 'a', text: 'A', done: false, rank: 1 },
        { id: 'b', text: 'B', done: false, rank: 2 },
      ],
    },
  ];

  it('sets, clamps and clears estimates', () => {
    const next = planForDay(setPlanEstimate(plans, '2026-9-16', 'a', 50), '2026-9-16')!;
    expect(next.tasks[0].estimateMin).toBe(50);
    expect(
      planForDay(setPlanEstimate(plans, '2026-9-16', 'a', 2), '2026-9-16')!.tasks[0].estimateMin,
    ).toBe(5);
    expect(
      planForDay(setPlanEstimate(plans, '2026-9-16', 'a', null), '2026-9-16')!.tasks[0].estimateMin,
    ).toBeUndefined();
  });

  it('accepts estimates at creation time', () => {
    const { plans: next, added } = addTaskToDay([], '2026-9-16', 'Deep work', 6, 90);
    expect(added).toBe(true);
    expect(planForDay(next, '2026-9-16')!.tasks[0].estimateMin).toBe(90);
  });

  it('ignores unknown days and ids', () => {
    expect(setPlanEstimate(plans, '2026-9-99', 'a', 30)).toBe(plans);
    expect(setPlanEstimate(plans, '2026-9-16', 'ghost', 30)).toEqual(plans);
  });
});
