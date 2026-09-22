import { describe, expect, it } from 'vitest';
import { sessionProgressImpact } from './progress';
import type { Session } from './store';
import type { Project } from './projects';
import type { Task } from './tasks';
import type { Goal } from './goals';

const NOW = new Date('2026-09-18T12:00:00Z').getTime();

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Launch site',
    color: '#22c55e',
    category: 'work',
    tags: [],
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    projectId: 'p1',
    title: 'Do thing',
    status: 'pending',
    priority: 'p2',
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
    ...over,
  };
}

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g1',
    title: 'Ship it',
    level: 'project',
    projectId: 'p1',
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
    ...over,
  };
}

function session(over: Partial<Session> = {}): Session {
  return { id: 's1', at: NOW, min: 25, projectId: 'p1', ...over };
}

describe('sessionProgressImpact', () => {
  it('quantifies hours, task-target percent and the linked goal', () => {
    const tasks = [
      task({ id: 't1', status: 'completed' }),
      task({ id: 't2', status: 'completed' }),
      task({ id: 't3', status: 'pending' }),
      task({ id: 't4', status: 'pending' }),
    ];
    const history: Session[] = [
      { id: 's0', at: NOW - 3600_000, min: 50, projectId: 'p1' },
      session(),
    ];
    const impact = sessionProgressImpact(session(), {
      projects: [project()],
      tasks,
      goals: [goal()],
      history,
      now: NOW,
    });
    expect(impact.kind).toBe('project');
    if (impact.kind !== 'project') return;
    expect(impact.sessionMin).toBe(25);
    expect(impact.projectMinutes).toBe(75);
    expect(impact.doneTasks).toBe(2);
    expect(impact.totalTasks).toBe(4);
    expect(impact.pct).toBe(50);
    expect(impact.reachedMilestone).toBe(false);
    expect(impact.goalTitle).toBe('Ship it');
    expect(impact.goalPct).toBe(50);
    expect(impact.weekMin).toBe(75);
  });

  it('reports null percent while the project has no tasks yet', () => {
    const history = [session()];
    const impact = sessionProgressImpact(session(), {
      projects: [project()],
      tasks: [],
      goals: [],
      history,
      now: NOW,
    });
    expect(impact.kind).toBe('project');
    if (impact.kind !== 'project') return;
    expect(impact.pct).toBeNull();
    expect(impact.reachedMilestone).toBe(false);
    expect(impact.goalId).toBeNull();
    expect(impact.projectMinutes).toBe(25);
  });

  it('flags the milestone when the task target stands at 100%', () => {
    const tasks = [task({ id: 't1', status: 'completed' })];
    const impact = sessionProgressImpact(session(), {
      projects: [project()],
      tasks,
      goals: [],
      history: [session()],
      now: NOW,
    });
    expect(impact.kind).toBe('project');
    if (impact.kind !== 'project') return;
    expect(impact.pct).toBe(100);
    expect(impact.reachedMilestone).toBe(true);
  });

  it('yields bare week credit when no project is linked or found', () => {
    const history: Session[] = [
      { id: 's0', at: NOW - 1000, min: 10 },
      session({ projectId: undefined }),
    ];
    const bare = sessionProgressImpact(session({ projectId: undefined }), {
      projects: [project()],
      tasks: [],
      goals: [],
      history,
      now: NOW,
    });
    expect(bare).toEqual({ kind: 'none', sessionMin: 25, weekMin: 35 });

    const ghost = sessionProgressImpact(session({ projectId: 'missing' }), {
      projects: [project()],
      tasks: [],
      goals: [],
      history,
      now: NOW,
    });
    expect(ghost.kind).toBe('none');
  });

  it('counts only the trailing 7 days for week minutes', () => {
    const history: Session[] = [
      { id: 'old', at: NOW - 8 * 24 * 3600_000, min: 120, projectId: 'p1' },
      session(),
    ];
    const impact = sessionProgressImpact(session(), {
      projects: [project()],
      tasks: [],
      goals: [],
      history,
      now: NOW,
    });
    expect(impact.kind).toBe('project');
    if (impact.kind !== 'project') return;
    expect(impact.weekMin).toBe(25);
    expect(impact.projectMinutes).toBe(145);
  });
});
