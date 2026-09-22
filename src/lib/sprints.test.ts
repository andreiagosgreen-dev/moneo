import { describe, expect, it } from 'vitest';

import {
  activeSprint,
  addTasksToSprint,
  burndown,
  createSprintObject,
  deleteSprint,
  formatStandup,
  ganttDayLines,
  loadBoardConfig,
  loadSprints,
  pruneSprintTasks,
  removeTaskFromSprint,
  saveBoardConfig,
  sprintPoints,
  sprintTasks,
  sprintsForProject,
  standup,
  updateSprint,
  velocity,
  type Sprint,
} from './sprints';
import type { Task } from './tasks';

const DAY = 24 * 3600_000;
const START = new Date(2026, 8, 14, 9, 0).getTime(); // Mon Sep 14 2026

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Task',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'p1',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: overrides.id ?? 's1',
    projectId: overrides.projectId ?? 'p1',
    name: overrides.name ?? 'Sprint 1',
    startAt: START,
    endAt: START + 14 * DAY,
    taskIds: [],
    status: 'planned',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('sprint lifecycle', () => {
  it('creates 2-week planned sprints and loads empty', () => {
    expect(loadSprints()).toEqual([]);
    const s = createSprintObject('p1', '  Sprint 7  ', START)!;
    expect(s.name).toBe('Sprint 7');
    expect(s.status).toBe('planned');
    expect(s.endAt - s.startAt).toBe(14 * DAY);
    expect(createSprintObject('p1', '   ')).toBeNull();
  });

  it('updates, deletes and scopes sprints per project', () => {
    const sprints = [
      makeSprint({ id: 'a', projectId: 'p1', startAt: START }),
      makeSprint({ id: 'b', projectId: 'p2', startAt: START + DAY }),
    ];
    expect(sprintsForProject(sprints, 'p1').map((s) => s.id)).toEqual(['a']);
    const renamed = updateSprint(sprints, 'a', { status: 'active', goal: 'Ship it' });
    expect(activeSprint(renamed, 'p1')!.id).toBe('a');
    expect(activeSprint(renamed, 'p2')).toBeNull();
    expect(deleteSprint(renamed, 'a').map((s) => s.id)).toEqual(['b']);
  });

  it('adds same-project tasks deduped, removes and prunes dead refs', () => {
    const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2', projectId: 'p2' })];
    const withTasks = addTasksToSprint([makeSprint()], tasks, 's1', ['t1', 't2', 't1', 'ghost']);
    expect(withTasks[0].taskIds).toEqual(['t1']);
    expect(sprintTasks(withTasks[0], tasks).map((t) => t.id)).toEqual(['t1']);
    const removed = removeTaskFromSprint(withTasks, 's1', 't1');
    expect(removed[0].taskIds).toEqual([]);
    const pruned = pruneSprintTasks(withTasks, []);
    expect(pruned[0].taskIds).toEqual([]);
  });
});

describe('sprint math', () => {
  const tasks = [
    makeTask({ id: 'a', points: 5, status: 'completed', completedAt: START + 2 * DAY }),
    makeTask({ id: 'b', points: 3 }),
    makeTask({ id: 'c' }), // unpointed counts as 1
  ];
  const sprint = makeSprint({ taskIds: ['a', 'b', 'c'] });

  it('sums total/done/remaining points', () => {
    expect(sprintPoints(sprint, tasks)).toEqual({ total: 9, done: 5, remaining: 4, pct: 56 });
  });

  it('builds a burndown with linear ideal and actuals', () => {
    const series = burndown(sprint, tasks, START + 14 * DAY);
    expect(series.length).toBeGreaterThan(10);
    expect(series[0]).toMatchObject({ ideal: 9, actual: 9 });
    const last = series[series.length - 1];
    expect(last.ideal).toBe(0);
    expect(last.actual).toBe(4); // 5 of 9 burned
  });

  it('averages velocity over completed sprints', () => {
    const sprints = [
      makeSprint({ id: 's1', status: 'completed', endAt: START }),
      makeSprint({ id: 's2', status: 'completed', endAt: START + DAY }),
      makeSprint({ id: 's3', status: 'active' }),
    ];
    // both completed sprints reference the same fixture: 5 done points each
    const withTasks = sprints.map((s) =>
      s.status === 'completed' ? { ...s, taskIds: ['a', 'b', 'c'] } : s,
    );
    expect(velocity(withTasks, tasks, 'p1')).toBe(5);
    expect(velocity(withTasks, tasks, 'p9')).toBe(0);
  });

  it('formats a standup from task states', () => {
    const scoped = [
      makeTask({ id: 'a', title: 'API done', status: 'completed' }),
      makeTask({ id: 'b', title: 'UI build', status: 'in_progress' }),
      makeTask({ id: 'c', title: 'Keys waiting', status: 'blocked' }),
    ];
    const text = formatStandup(standup(makeSprint({ taskIds: ['a', 'b', 'c'] }), scoped));
    expect(text).toContain('Yesterday: API done');
    expect(text).toContain('Today: UI build');
    expect(text).toContain('Blocked: Keys waiting');
  });

  it('loads default board config and persists labels', () => {
    expect(loadBoardConfig()).toEqual({ wipLimits: {}, columnLabels: {}, hidden: [] });
    expect(
      saveBoardConfig({
        wipLimits: { pending: 3 },
        columnLabels: { pending: 'Todo', in_progress: 'Doing' },
        hidden: ['blocked'],
      }),
    ).toBe(true);
    const loaded = loadBoardConfig();
    expect(loaded.wipLimits).toEqual({ pending: 3 });
    expect(loaded.columnLabels).toEqual({ pending: 'Todo', in_progress: 'Doing' });
    expect(loaded.hidden).toEqual(['blocked']);
  });
});

describe('ganttDayLines', () => {
  it('returns one entry per calendar day touched by the range, including a partial last day', () => {
    const start = new Date(2026, 8, 14, 10, 0).getTime(); // Mon Sep 14 2026, 10:00
    const end = start + 4 * DAY; // Fri Sep 18 2026, 10:00 — touches 5 calendar days
    const lines = ganttDayLines(start, end);
    expect(lines).toHaveLength(5);
    expect(lines.map((l) => l.dow)).toEqual([1, 2, 3, 4, 5]); // Mon..Fri
    expect(lines[0].isWeekStart).toBe(true);
    expect(lines.slice(1).every((l) => !l.isWeekStart)).toBe(true);
  });

  it('flags weekend days', () => {
    const start = new Date(2026, 8, 18, 0, 0).getTime(); // Fri Sep 18 2026
    const end = start + 3 * DAY;
    const lines = ganttDayLines(start, end);
    expect(lines.map((l) => l.isWeekend)).toEqual([false, true, true]); // Fri, Sat, Sun
  });

  it('produces exactly one entry per calendar day over a long range (no skip/duplicate across any DST transition the runtime observes)', () => {
    const start = new Date(2026, 0, 1, 12, 0).getTime();
    const end = start + 400 * DAY;
    const lines = ganttDayLines(start, end);
    const dateStrings = lines.map((l) => new Date(l.at).toDateString());
    expect(new Set(dateStrings).size).toBe(dateStrings.length);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].dow).toBe((lines[i - 1].dow + 1) % 7);
    }
  });

  it('returns empty for a degenerate or empty window', () => {
    expect(ganttDayLines(1000, 1000)).toEqual([]);
    expect(ganttDayLines(2000, 1000)).toEqual([]);
  });
});
