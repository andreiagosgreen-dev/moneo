import { describe, expect, it } from 'vitest';
import {
  FOCUS_DAYS_THRESHOLDS,
  markCelebrationShown,
  pendingCelebrations,
  totalFocusDays,
} from './celebrations';
import type { Goal } from './goals';
import type { Task } from './tasks';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: overrides.id ?? 'g1',
    title: overrides.title ?? 'Goal',
    level: overrides.level ?? 'project',
    createdAt: 1000,
    updatedAt: 1000,
    progress: 100,
    ...overrides,
  };
}

describe('totalFocusDays', () => {
  it('counts distinct local calendar days, ignoring bad entries', () => {
    const day = (offset: number) => {
      const d = new Date(2026, 8, 15 - offset, 12, 0);
      return d.getTime();
    };
    const history = [
      { at: day(0), min: 25 },
      { at: day(0), min: 30 }, // same day, doesn't double-count
      { at: day(1), min: 25 },
      { at: NaN, min: 25 },
    ];
    expect(totalFocusDays(history)).toBe(2);
  });
});

describe('pendingCelebrations', () => {
  const tasks: Task[] = [];

  it('fires firstGoalDone once, for the earliest completed goal', () => {
    const goals = [
      makeGoal({ id: 'a', title: 'Older', progress: 100, updatedAt: 1000 }),
      makeGoal({ id: 'b', title: 'Newer', progress: 100, updatedAt: 2000 }),
    ];
    const pending = pendingCelebrations(goals, tasks, 0, {});
    const first = pending.find((c) => c.kind === 'firstGoalDone');
    expect(first?.label).toBe('Older');
  });

  it('does not fire firstGoalDone again once shown', () => {
    const goals = [makeGoal({ id: 'a', progress: 100 })];
    const shown = markCelebrationShown({}, 'firstGoalDone');
    expect(pendingCelebrations(goals, tasks, 0, shown)).toHaveLength(0);
  });

  it('fires milestoneDone per completed milestone-level goal, once each', () => {
    const goals = [
      makeGoal({ id: 'm1', level: 'milestone', title: 'Ship v1', progress: 100 }),
      makeGoal({ id: 'm2', level: 'milestone', title: 'Ship v2', progress: 40 }),
    ];
    const shown = markCelebrationShown({}, 'firstGoalDone');
    const pending = pendingCelebrations(goals, tasks, 0, shown);
    expect(pending).toEqual([{ id: 'milestoneDone:m1', kind: 'milestoneDone', label: 'Ship v1' }]);
  });

  it('ignores archived goals entirely', () => {
    const goals = [makeGoal({ id: 'a', progress: 100, archived: true })];
    expect(pendingCelebrations(goals, tasks, 0, {})).toHaveLength(0);
  });

  it('fires focusDaysMilestone once per crossed threshold', () => {
    const pending = pendingCelebrations([], tasks, FOCUS_DAYS_THRESHOLDS[0], {});
    expect(pending).toEqual([
      { id: `focusDays:${FOCUS_DAYS_THRESHOLDS[0]}`, kind: 'focusDaysMilestone', label: '100' },
    ]);
    const shown = markCelebrationShown({}, `focusDays:${FOCUS_DAYS_THRESHOLDS[0]}`);
    expect(pendingCelebrations([], tasks, FOCUS_DAYS_THRESHOLDS[0], shown)).toHaveLength(0);
  });
});
