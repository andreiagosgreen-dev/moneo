import { describe, expect, it } from 'vitest';

import {
  FREE_GOALS_LIMIT,
  archivedGoals,
  canParent,
  childrenOf,
  createGoalObject,
  deleteGoal,
  descendantIds,
  goalProgress,
  loadGoals,
  rootGoals,
  suggestTasksForGoal,
  updateGoal,
  type Goal,
} from './goals';
import type { Task } from './tasks';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: overrides.id ?? 'g1',
    title: overrides.title ?? 'Goal',
    level: overrides.level ?? 'project',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

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

describe('goal hierarchy', () => {
  it('exposes the Free tier limit (3 goals)', () => {
    expect(FREE_GOALS_LIMIT).toBe(3);
  });

  it('creates goals with validated parent links', () => {
    const vision = makeGoal({ id: 'v', level: 'vision' });
    const ok = createGoalObject([vision], 'Q3 push', 'milestone', 'v');
    expect(ok).not.toBeNull();
    expect(ok!.parentId).toBe('v');
    // narrower parent rejected (project cannot parent a milestone)
    const project = makeGoal({ id: 'p', level: 'project' });
    expect(createGoalObject([project], 'Bad', 'milestone', 'p')).toBeNull();
    // missing parent rejected
    expect(createGoalObject([vision], 'Bad', 'milestone', 'ghost')).toBeNull();
    // empty title rejected
    expect(createGoalObject([], '   ', 'vision')).toBeNull();
  });

  it('enforces broader-parent rule via canParent', () => {
    expect(canParent('milestone', makeGoal({ level: 'vision' }))).toBe(true);
    expect(canParent('vision', makeGoal({ level: 'milestone' }))).toBe(false);
    expect(canParent('weekly', makeGoal({ level: 'weekly' }))).toBe(false);
  });

  it('lists roots broadest-first and children oldest-first', () => {
    const goals = [
      makeGoal({ id: 'w', level: 'weekly', createdAt: 3000 }),
      makeGoal({ id: 'v', level: 'vision', createdAt: 2000 }),
      makeGoal({ id: 'c', parentId: 'v', createdAt: 5000 }),
      makeGoal({ id: 'a', title: 'Archived', archived: true }),
    ];
    expect(rootGoals(goals).map((g) => g.id)).toEqual(['v', 'w']);
    expect(childrenOf(goals, 'v').map((g) => g.id)).toEqual(['c']);
    expect(archivedGoals(goals).map((g) => g.id)).toEqual(['a']);
  });

  it('deletes by re-attaching children to the grandparent', () => {
    const goals = [
      makeGoal({ id: 'v', level: 'vision' }),
      makeGoal({ id: 'm', level: 'milestone', parentId: 'v' }),
      makeGoal({ id: 'w', level: 'weekly', parentId: 'm' }),
    ];
    const next = deleteGoal(goals, 'm');
    expect(next.map((g) => g.id).sort()).toEqual(['v', 'w']);
    expect(next.find((g) => g.id === 'w')!.parentId).toBe('v');
    expect(descendantIds(goals, 'v').sort()).toEqual(['m', 'w']);
  });

  it('rejects cyclic re-parenting', () => {
    const goals = [
      makeGoal({ id: 'v', level: 'vision' }),
      makeGoal({ id: 'm', level: 'milestone', parentId: 'v' }),
    ];
    const cycled = updateGoal(goals, 'v', { parentId: 'm' });
    expect(cycled.find((g) => g.id === 'v')!.parentId).toBeUndefined();
  });

  it('updates scalar fields with clamping', () => {
    const next = updateGoal([makeGoal()], 'g1', {
      title: '  New  ',
      progress: 150,
      targetDate: 999,
    });
    expect(next[0].title).toBe('New');
    expect(next[0].progress).toBe(100);
    expect(next[0].targetDate).toBe(999);
    const cleared = updateGoal(next, 'g1', { progress: null, targetDate: null });
    expect(cleared[0].progress).toBeUndefined();
    expect(cleared[0].targetDate).toBeUndefined();
  });

  it('loads empty when storage is empty', () => {
    expect(loadGoals()).toEqual([]);
  });
});

describe('goalProgress rollup', () => {
  it('averages children', () => {
    const goals = [
      makeGoal({ id: 'v', level: 'vision' }),
      makeGoal({ id: 'a', level: 'milestone', parentId: 'v', progress: 100 }),
      makeGoal({ id: 'b', level: 'milestone', parentId: 'v', progress: 50 }),
    ];
    expect(goalProgress(goals, [], 'v')).toBe(75);
  });

  it('mirrors linked project task completion', () => {
    const goals = [makeGoal({ projectId: 'p1' })];
    const tasks = [
      makeTask({ id: 't1', projectId: 'p1', status: 'completed' }),
      makeTask({ id: 't2', projectId: 'p1' }),
    ];
    expect(goalProgress(goals, tasks, 'g1')).toBe(50);
  });

  it('falls back to manual progress, then 0', () => {
    expect(goalProgress([makeGoal({ progress: 30 })], [], 'g1')).toBe(30);
    expect(goalProgress([makeGoal()], [], 'g1')).toBe(0);
    expect(goalProgress([], [], 'ghost')).toBe(0);
  });
});

describe('suggestTasksForGoal', () => {
  it('matches learning goals', () => {
    expect(suggestTasksForGoal('Learn React')).toContain('Build a practice exercise');
  });

  it('matches launch goals', () => {
    expect(suggestTasksForGoal('Ship the SaaS')).toContain('Test with one real user');
  });

  it('matches writing, fitness and money goals', () => {
    expect(suggestTasksForGoal('Write the thesis')[1]).toBe('Ugly first draft');
    expect(suggestTasksForGoal('Run a marathon')[0]).toContain('Baseline');
    expect(suggestTasksForGoal('Save $10k')[1]).toContain('Automate');
  });

  it('falls back to generic steps, empty on blank', () => {
    expect(suggestTasksForGoal('Reorganize garage')).toContain('Weekly review');
    expect(suggestTasksForGoal('   ')).toEqual([]);
  });
});
