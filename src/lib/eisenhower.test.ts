import { describe, expect, it } from 'vitest';

import {
  URGENT_WINDOW_MS,
  actionableTasks,
  effectiveQuadrant,
  isImportant,
  isUrgent,
  quadrantCounts,
  quadrantFocus,
  quadrantMinutes,
  suggestQuadrant,
  tasksInQuadrant,
} from './eisenhower';
import type { Task } from './tasks';

const NOW = new Date(2026, 8, 16, 12, 0).getTime();
const HOUR = 3600_000;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Task',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'p2',
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    ...overrides,
  };
}

describe('suggestQuadrant', () => {
  it('maps urgent+important to Q1', () => {
    expect(suggestQuadrant(makeTask({ priority: 'p0', dueAt: NOW + HOUR }), NOW)).toBe('q1');
  });

  it('maps important-but-not-urgent to Q2', () => {
    expect(suggestQuadrant(makeTask({ priority: 'p1' }), NOW)).toBe('q2');
  });

  it('maps urgent-but-trivial to Q3', () => {
    expect(suggestQuadrant(makeTask({ priority: 'p3', dueAt: NOW + HOUR }), NOW)).toBe('q3');
  });

  it('maps the rest to Q4', () => {
    expect(suggestQuadrant(makeTask({ priority: 'p3' }), NOW)).toBe('q4');
  });

  it('treats overdue as urgent', () => {
    expect(suggestQuadrant(makeTask({ priority: 'p2', dueAt: NOW - HOUR }), NOW)).toBe('q3');
  });

  it('uses the 48h urgent window', () => {
    expect(URGENT_WINDOW_MS).toBe(48 * HOUR);
    expect(isUrgent(makeTask({ dueAt: NOW + 47 * HOUR }), NOW)).toBe(true);
    expect(isUrgent(makeTask({ dueAt: NOW + 49 * HOUR }), NOW)).toBe(false);
    expect(isUrgent(makeTask({}), NOW)).toBe(false);
  });

  it('treats p0/p1 as important', () => {
    expect(isImportant(makeTask({ priority: 'p0' }))).toBe(true);
    expect(isImportant(makeTask({ priority: 'p1' }))).toBe(true);
    expect(isImportant(makeTask({ priority: 'p2' }))).toBe(false);
  });
});

describe('effectiveQuadrant', () => {
  it('prefers the manual override', () => {
    const t = makeTask({ priority: 'p0', dueAt: NOW + HOUR, quadrant: 'q4' });
    expect(effectiveQuadrant(t, NOW)).toBe('q4');
  });

  it('falls back to the suggestion', () => {
    expect(effectiveQuadrant(makeTask({ priority: 'p1' }), NOW)).toBe('q2');
  });
});

describe('board aggregation', () => {
  const tasks = [
    makeTask({ id: 'a', priority: 'p0', dueAt: NOW + HOUR }),
    makeTask({ id: 'b', priority: 'p1' }),
    makeTask({ id: 'c', priority: 'p3' }),
    makeTask({ id: 'd', priority: 'p0', dueAt: NOW + HOUR, status: 'completed' }),
  ];

  it('excludes completed tasks from the board', () => {
    expect(actionableTasks(tasks).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('counts per quadrant', () => {
    expect(quadrantCounts(tasks, NOW)).toEqual({ q1: 1, q2: 1, q3: 0, q4: 1 });
  });

  it('filters by quadrant', () => {
    expect(tasksInQuadrant(tasks, 'q1', NOW).map((t) => t.id)).toEqual(['a']);
  });

  it('sums focus minutes per quadrant through taskIds', () => {
    const history = [
      { taskId: 'a', min: 25 },
      { taskId: 'b', min: 50 },
      { taskId: 'ghost', min: 99 },
      { min: 10 },
    ];
    expect(quadrantMinutes(tasks, history, NOW)).toEqual({ q1: 25, q2: 50, q3: 0, q4: 0 });
  });
});

describe('quadrantFocus', () => {
  it('picks Q1 first with the most urgent task', () => {
    const tasks = [
      makeTask({ id: 'late', title: 'Late', priority: 'p0', dueAt: NOW + 10 * HOUR }),
      makeTask({ id: 'now', title: 'Now', priority: 'p0', dueAt: NOW + HOUR }),
      makeTask({ id: 'deep', title: 'Deep', priority: 'p1' }),
    ];
    const focus = quadrantFocus(tasks, NOW);
    expect(focus.quadrant).toBe('q1');
    expect(focus.task!.id).toBe('now');
  });

  it('falls back to Q2 deep work when no fires burn', () => {
    const focus = quadrantFocus([makeTask({ priority: 'p1', title: 'Deep' })], NOW);
    expect(focus.quadrant).toBe('q2');
    expect(focus.task!.title).toBe('Deep');
  });

  it('reports a clear board', () => {
    const focus = quadrantFocus([], NOW);
    expect(focus.quadrant).toBeNull();
    expect(focus.task).toBeNull();
  });
});
