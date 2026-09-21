import { describe, expect, it } from 'vitest';
import { stagnatingTasks, weekMinutesByProject, weeklyNarrative } from './weeklyReview';
import type { Project } from './projects';
import type { Task } from './tasks';
import type { Session } from './store';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'Project',
    color: '#000',
    category: 'work',
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Task',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'p2',
    createdAt: 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    ...overrides,
  };
}

describe('weekMinutesByProject', () => {
  it('sums minutes per project within the trailing week, sorted best-first', () => {
    const now = 100 * DAY_MS;
    const history: Session[] = [
      { id: 'a', at: now - 1 * DAY_MS, min: 30, projectId: 'p1' },
      { id: 'b', at: now - 2 * DAY_MS, min: 40, projectId: 'p1' },
      { id: 'c', at: now - 3 * DAY_MS, min: 20, projectId: 'p2' },
      { id: 'd', at: now - 10 * DAY_MS, min: 999, projectId: 'p1' }, // outside window
    ];
    const projects = [
      makeProject({ id: 'p1', name: 'Alpha' }),
      makeProject({ id: 'p2', name: 'Beta' }),
    ];
    const ranked = weekMinutesByProject(history, projects, now);
    expect(ranked).toEqual([
      { project: projects[0], minutes: 70 },
      { project: projects[1], minutes: 20 },
    ]);
  });

  it('excludes archived projects', () => {
    const now = 100 * DAY_MS;
    const history: Session[] = [{ id: 'a', at: now - 1 * DAY_MS, min: 30, projectId: 'p1' }];
    const projects = [makeProject({ id: 'p1', archived: true })];
    expect(weekMinutesByProject(history, projects, now)).toEqual([]);
  });
});

describe('stagnatingTasks', () => {
  const now = 100 * DAY_MS;

  it('flags overdue open tasks and untouched-14d+ tasks, worst first', () => {
    const tasks: Task[] = [
      makeTask({ id: 'fresh', updatedAt: now - 1 * DAY_MS }),
      makeTask({ id: 'stale', updatedAt: now - 20 * DAY_MS }),
      makeTask({ id: 'overdue', dueAt: now - 5 * DAY_MS, updatedAt: now - 1 * DAY_MS }),
      makeTask({ id: 'done', status: 'completed', updatedAt: now - 30 * DAY_MS }),
    ];
    const stale = stagnatingTasks(tasks, now);
    expect(stale.map((s) => s.task.id)).toEqual(['stale', 'overdue']);
    expect(stale.find((s) => s.task.id === 'overdue')!.overdue).toBe(true);
    expect(stale.find((s) => s.task.id === 'stale')!.overdue).toBe(false);
  });
});

describe('weeklyNarrative', () => {
  it('reports the empty-week message when nothing to report', () => {
    const text = weeklyNarrative({ history: [], tasks: [], projects: [] });
    expect(text).toBe('No focus sessions or stagnating tasks this week — quiet week.');
  });

  it('composes best-project and stagnation lines with a decision question', () => {
    const now = Date.now();
    const projects = [makeProject({ id: 'p1', name: 'Launch' })];
    const history: Session[] = [{ id: 's1', at: now - DAY_MS, min: 60, projectId: 'p1' }];
    const tasks: Task[] = [
      makeTask({
        id: 't1',
        title: 'Write docs',
        dueAt: now - 3 * DAY_MS,
        updatedAt: now - 3 * DAY_MS,
      }),
    ];
    const text = weeklyNarrative({ history, tasks, projects });
    expect(text).toContain('Launch');
    expect(text).toContain('Write docs');
    expect(text).toMatch(/reschedule it or let it go\?/);
  });
});
