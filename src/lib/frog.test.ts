import { describe, expect, it } from 'vitest';

import {
  frogStats,
  frogStreak,
  loadFrogLog,
  pickFrog,
  recordFrog,
  saveFrogLog,
  type FrogLog,
} from './frog';
import type { Project } from './projects';
import type { Task } from './tasks';

const NOW = new Date(2026, 8, 16, 12, 0).getTime();
const HOUR = 3600_000;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Task',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'p1',
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'P',
    color: '#fff',
    category: 'work',
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('pickFrog', () => {
  const projects = [makeProject({ id: 'p1' }), makeProject({ id: 'gone', archived: true })];

  it('picks the hardest task: overdue first, then priority, due, age', () => {
    const tasks = [
      makeTask({ id: 'easy', priority: 'p3' }),
      makeTask({ id: 'hard', priority: 'p0' }),
      makeTask({ id: 'late', priority: 'p2', dueAt: NOW - HOUR }),
    ];
    expect(pickFrog(tasks, projects, NOW)!.id).toBe('late');
    const noOverdue = tasks.filter((t) => t.id !== 'late');
    expect(pickFrog(noOverdue, projects, NOW)!.id).toBe('hard');
  });

  it('ignores completed tasks and archived projects', () => {
    const tasks = [
      makeTask({ id: 'done', priority: 'p0', status: 'completed' }),
      makeTask({ id: 'archived', priority: 'p0', projectId: 'gone' }),
      makeTask({ id: 'live', priority: 'p2' }),
    ];
    expect(pickFrog(tasks, projects, NOW)!.id).toBe('live');
  });

  it('returns null when nothing actionable remains', () => {
    expect(pickFrog([], projects, NOW)).toBeNull();
    expect(pickFrog([makeTask({ status: 'completed' })], projects, NOW)).toBeNull();
  });
});

describe('frog log + streak', () => {
  // localDayKey for Sep 16 2026 = "2026-9-16"
  const log: FrogLog = {
    '2026-9-16': { taskId: 'a', done: true },
    '2026-9-15': { taskId: 'b', done: true },
    '2026-9-14': { taskId: 'c', done: false },
    '2026-9-13': { taskId: 'd', done: true },
  };

  it('counts consecutive done-days ending today', () => {
    expect(frogStreak(log, NOW)).toBe(2);
  });

  it('bridges a not-yet-done today via yesterday', () => {
    const morning: FrogLog = {
      '2026-9-16': { taskId: 'a', done: false },
      '2026-9-15': { taskId: 'b', done: true },
    };
    expect(frogStreak(morning, NOW)).toBe(1);
  });

  it('summarizes days, skips and rate', () => {
    const stats = frogStats(log, NOW);
    expect(stats.days).toBe(4);
    expect(stats.done).toBe(3);
    expect(stats.skipped).toBe(1);
    expect(stats.rate).toBe(0.75);
    expect(stats.streak).toBe(2);
  });

  it('records entries immutably and persists round-trip', () => {
    const next = recordFrog({}, '2026-9-16', 'x', false);
    expect(next).toEqual({ '2026-9-16': { taskId: 'x', done: false } });
    const done = recordFrog(next, '2026-9-16', 'x', true);
    expect(done['2026-9-16'].done).toBe(true);
    expect(loadFrogLog()).toEqual({});
    expect(saveFrogLog(done)).toBe(true);
    expect(loadFrogLog()).toEqual(done);
  });

  it('is empty without history', () => {
    expect(frogStreak({}, NOW)).toBe(0);
    expect(frogStats({}, NOW)).toEqual({ days: 0, done: 0, skipped: 0, rate: 0, streak: 0 });
  });
});
