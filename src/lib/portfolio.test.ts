import { describe, expect, it } from 'vitest';
import { buildPortfolioData, buildPortfolioHTML } from './portfolio';
import type { Project } from './projects';
import type { Task } from './tasks';
import type { Goal } from './goals';
import type { Skill } from './skills';
import type { Session } from './store';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'Project',
    color: '#fff',
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
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: overrides.id ?? 's1',
    name: overrides.name ?? 'Rust',
    category: 'backend',
    level: 3,
    targetLevel: 5,
    minutesLogged: 0,
    xp: 0,
    resources: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('buildPortfolioData', () => {
  it('includes only 100%-complete projects, sorted by most focused time', () => {
    const projects = [
      makeProject({ id: 'done-small', name: 'Small' }),
      makeProject({ id: 'done-big', name: 'Big' }),
      makeProject({ id: 'partial', name: 'Partial' }),
      makeProject({ id: 'empty', name: 'Empty' }), // no tasks at all
    ];
    const tasks: Task[] = [
      makeTask({ id: 'a', projectId: 'done-small', status: 'completed' }),
      makeTask({ id: 'b', projectId: 'done-big', status: 'completed' }),
      makeTask({ id: 'c', projectId: 'done-big', status: 'completed' }),
      makeTask({ id: 'd', projectId: 'partial', status: 'completed' }),
      makeTask({ id: 'e', projectId: 'partial', status: 'pending' }),
    ];
    const history: Session[] = [
      { id: 'x', at: 1, min: 10, projectId: 'done-small' },
      { id: 'y', at: 2, min: 90, projectId: 'done-big' },
    ];
    const data = buildPortfolioData(projects, tasks, [], [], history, 1000);
    expect(data.projects.map((p) => p.name)).toEqual(['Big', 'Small']);
    expect(data.totalMinutes).toBe(100);
  });

  it('includes only fully-achieved, non-archived goals', () => {
    const goals: Goal[] = [
      { id: 'g1', title: 'Ship v1', level: 'project', progress: 100, createdAt: 1, updatedAt: 1 },
      { id: 'g2', title: 'Half done', level: 'project', progress: 50, createdAt: 1, updatedAt: 1 },
      {
        id: 'g3',
        title: 'Archived done',
        level: 'project',
        progress: 100,
        archived: true,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const data = buildPortfolioData([], [], goals, [], []);
    expect(data.goalsAchieved).toEqual(['Ship v1']);
  });

  it('includes only skills at level 4+, strongest first', () => {
    const skills = [
      makeSkill({ id: 's1', name: 'Low', level: 2 }),
      makeSkill({ id: 's2', name: 'Strong', level: 4 }),
      makeSkill({ id: 's3', name: 'Expert', level: 5 }),
    ];
    const data = buildPortfolioData([], [], [], skills, []);
    expect(data.topSkills.map((s) => s.name)).toEqual(['Expert', 'Strong']);
  });
});

describe('buildPortfolioHTML', () => {
  it('never throws and renders empty-state copy for an empty portfolio', () => {
    const html = buildPortfolioHTML(
      buildPortfolioData([], [], [], [], []),
    );
    expect(html).toContain('<html');
    expect(html).toContain('Nothing completed yet.');
    expect(html).toContain('No goals fully achieved yet.');
    expect(html).toContain('No skills at level 4+ yet.');
  });

  it('escapes untrusted project/goal/skill names', () => {
    const projects = [makeProject({ id: 'p1', name: '<script>alert(1)</script>' })];
    const tasks = [makeTask({ id: 't1', projectId: 'p1', status: 'completed' })];
    const html = buildPortfolioHTML(buildPortfolioData(projects, tasks, [], [], []));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
