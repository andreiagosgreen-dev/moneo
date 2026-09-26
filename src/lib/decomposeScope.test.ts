import { describe, expect, it } from 'vitest';
import {
  childLevelsBelow,
  decomposeGoalChildren,
  decomposeGoalTaskDrafts,
  decomposeProjectTasks,
  estimateMinForLevel,
  levelFromDurationMonths,
  shouldAutoDecompose,
  type DecomposeTaskDraft,
} from './decomposeScope';
import type { Goal } from './goals';

function root(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'root',
    title: 'Master craft',
    level: 'years10',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

const label = (level: string) => level;

describe('levelFromDurationMonths', () => {
  it('maps long spans onto the spine including 7y', () => {
    expect(levelFromDurationMonths(120)).toBe('years10');
    expect(levelFromDurationMonths(84)).toBe('years7');
    expect(levelFromDurationMonths(60)).toBe('years5');
    expect(levelFromDurationMonths(12)).toBe('vision');
    expect(levelFromDurationMonths(1)).toBe('project');
    expect(levelFromDurationMonths(0.2)).toBe('weekly');
  });
});

describe('decomposeGoalChildren', () => {
  it('chains 10y → 7y → … → day with target dates', () => {
    const now = Date.UTC(2026, 0, 1);
    const end = Date.UTC(2036, 0, 1);
    const kids = decomposeGoalChildren(root({ targetDate: end }), {
      now,
      label,
    });
    expect(shouldAutoDecompose('years10')).toBe(true);
    expect(childLevelsBelow('years10')[0]).toBe('years7');
    expect(kids.map((k) => k.level)).toEqual([
      'years7',
      'years5',
      'years3',
      'vision',
      'milestone',
      'project',
      'weekly',
      'daily',
    ]);
    expect(kids[0].parentId).toBe('root');
    expect(kids[1].parentId).toBe(kids[0].id);
    expect(kids.every((k) => typeof k.targetDate === 'number' && k.targetDate! > now)).toBe(true);
    expect(kids[0].title).toContain('Master craft');
  });

  it('respects maxChildren for Free caps', () => {
    const kids = decomposeGoalChildren(root(), { label, maxChildren: 2, now: 1_000 });
    expect(kids).toHaveLength(2);
    expect(kids.map((k) => k.level)).toEqual(['years7', 'years5']);
  });

  it('is silent for daily leaves', () => {
    expect(decomposeGoalChildren(root({ level: 'daily' }), { label })).toEqual([]);
    expect(shouldAutoDecompose('daily')).toBe(false);
  });
});

describe('decomposeProjectTasks', () => {
  it('expands a multi-year deadline into checkpoints and day-hour slices', () => {
    const start = Date.UTC(2026, 0, 1);
    const end = Date.UTC(2031, 0, 1); // ~5y
    const drafts = decomposeProjectTasks('Ship product', start, end, label);
    expect(drafts.length).toBeGreaterThan(3);
    expect(drafts.some((d: DecomposeTaskDraft) => d.level === 'daily' && d.estimateMin === 120)).toBe(
      true,
    );
    expect(drafts.some((d) => d.title.includes('Ship product'))).toBe(true);
  });

  it('returns empty when deadline is not after start', () => {
    expect(decomposeProjectTasks('X', 100, 50, label)).toEqual([]);
  });
});

describe('decomposeGoalTaskDrafts', () => {
  it('builds Focus-selectable hour tasks from weekly/daily children', () => {
    const kids = decomposeGoalChildren(root({ level: 'weekly' }), {
      label,
      now: 1_000,
    });
    const drafts = decomposeGoalTaskDrafts(kids, 'Master craft', label);
    expect(drafts.some((d) => d.estimateMin === 60 || d.estimateMin === 120)).toBe(true);
    expect(estimateMinForLevel('daily')).toBe(60);
  });
});
