import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  createSavedFilter,
  matchesFilter,
  removeSavedFilter,
} from './savedFilters';
import type { Task } from './tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Task',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'p2',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('createSavedFilter / removeSavedFilter', () => {
  it('creates with trimmed name and criteria, ignoring blank names', () => {
    const created = createSavedFilter([], '  Urgent  ', { priority: 'p0' }, 5000);
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe('Urgent');
    expect(created[0].priority).toBe('p0');
    expect(createSavedFilter([], '   ', {})).toEqual([]);
  });

  it('removes by id', () => {
    const created = createSavedFilter([], 'A', {}, 1);
    expect(removeSavedFilter(created, created[0].id)).toEqual([]);
  });
});

describe('matchesFilter / applyFilter', () => {
  const now = 100_000;
  const dayMs = 24 * 60 * 60 * 1000;

  it('matches on status/priority/project independently', () => {
    const task = makeTask({ status: 'in_progress', priority: 'p1', projectId: 'pA' });
    expect(matchesFilter(task, { status: 'in_progress' })).toBe(true);
    expect(matchesFilter(task, { status: 'blocked' })).toBe(false);
    expect(matchesFilter(task, { priority: 'p1', projectId: 'pA' })).toBe(true);
    expect(matchesFilter(task, { projectId: 'pB' })).toBe(false);
  });

  it('dueWithinDays excludes tasks with no due date, includes overdue and near-term', () => {
    const noDue = makeTask({ id: 'a' });
    const overdue = makeTask({ id: 'b', dueAt: now - dayMs });
    const soon = makeTask({ id: 'c', dueAt: now + dayMs });
    const far = makeTask({ id: 'd', dueAt: now + 30 * dayMs });
    const tasks = [noDue, overdue, soon, far];
    const matched = applyFilter(tasks, { dueWithinDays: 3 }, now).map((t) => t.id);
    expect(matched).toEqual(['b', 'c']);
  });
});
