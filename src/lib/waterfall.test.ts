import { describe, expect, it } from 'vitest';

import {
  WATERFALL_STARTERS,
  createPhaseObject,
  deletePhase,
  loadPhases,
  phasesForProject,
  seedStarterPhases,
  setPhaseStatus,
  updatePhase,
  waterfallProgress,
  type WaterfallPhase,
} from './waterfall';
import { ganttRows } from './sprints';
import type { Task } from './tasks';

const NOW = new Date(2026, 8, 16, 12, 0).getTime();
const DAY = 24 * 3600_000;

function makePhase(overrides: Partial<WaterfallPhase> = {}): WaterfallPhase {
  return {
    id: overrides.id ?? 'w1',
    projectId: overrides.projectId ?? 'p1',
    name: overrides.name ?? 'Phase',
    order: overrides.order ?? 0,
    status: overrides.status ?? 'todo',
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

describe('waterfall', () => {
  it('loads empty and offers 5 starter phases', () => {
    expect(loadPhases()).toEqual([]);
    expect(WATERFALL_STARTERS.map((s) => s.name)).toEqual([
      'Requirements',
      'Design',
      'Implementation',
      'Testing',
      'Deployment',
    ]);
  });

  it('seeds starters once per project', () => {
    const seeded = seedStarterPhases([], 'p1');
    expect(seeded).toHaveLength(5);
    expect(seeded.map((p) => p.order)).toEqual([0, 1, 2, 3, 4]);
    expect(seedStarterPhases(seeded, 'p1')).toBe(seeded);
    expect(seedStarterPhases(seeded, 'p2')).toHaveLength(10);
  });

  it('creates phases with order and gates', () => {
    expect(createPhaseObject('p1', '  Beta  ', 2, 'Users onboarded')!.gate).toBe('Users onboarded');
    expect(createPhaseObject('p1', '   ', 0)).toBeNull();
  });

  it('enforces strict sequence todo→active→done', () => {
    const phases = [makePhase({ id: 'a', order: 0 }), makePhase({ id: 'b', order: 1 })];
    // cannot skip: b activates only after a is done
    expect(setPhaseStatus(phases, 'b', 'active', NOW)).toBe(phases);
    // cannot complete from todo
    expect(setPhaseStatus(phases, 'a', 'done', NOW)).toBe(phases);
    const started = setPhaseStatus(phases, 'a', 'active', NOW);
    expect(started[0].status).toBe('active');
    expect(started[0].startedAt).toBe(NOW);
    // only one active at a time — b still blocked (a not done)
    expect(setPhaseStatus(started, 'b', 'active', NOW)).toBe(started);
    const doneA = setPhaseStatus(started, 'a', 'done', NOW);
    const activeB = setPhaseStatus(doneA, 'b', 'active', NOW);
    expect(activeB[1].status).toBe('active');
    // no moving backwards
    expect(setPhaseStatus(activeB, 'a', 'todo', NOW)).toBe(activeB);
  });

  it('updates, deletes and measures progress', () => {
    const phases = [makePhase({ id: 'a' }), makePhase({ id: 'b' })];
    expect(updatePhase(phases, 'a', { name: 'Alpha', gate: 'Done' })[0].name).toBe('Alpha');
    expect(deletePhase(phases, 'a').map((p) => p.id)).toEqual(['b']);
    expect(waterfallProgress(phases, 'p1')).toBe(0);
    const half = setPhaseStatus(setPhaseStatus(phases, 'a', 'active', NOW), 'a', 'done', NOW);
    expect(waterfallProgress(half, 'p1')).toBe(50);
    expect(phasesForProject(half, 'p9')).toEqual([]);
  });
});

describe('ganttRows', () => {
  it('builds clamped bars with overdue and critical flags', () => {
    const tasks = [
      makeTask({ id: 'a', createdAt: NOW - 5 * DAY, dueAt: NOW + 5 * DAY }),
      makeTask({
        id: 'b',
        createdAt: NOW - 20 * DAY,
        status: 'completed',
        completedAt: NOW - 15 * DAY,
      }),
      makeTask({ id: 'late', createdAt: NOW - 3 * DAY, dueAt: NOW - DAY }),
      makeTask({ id: 'other', projectId: 'p2' }),
    ];
    const { rows, windowStart, windowEnd } = ganttRows(tasks, 'p1', NOW, 14, 30);
    expect(rows.map((r) => r.task.id)).toEqual(['b', 'a', 'late']);
    expect(windowEnd - windowStart).toBe(44 * DAY);
    for (const r of rows) {
      expect(r.start).toBeGreaterThanOrEqual(windowStart);
      expect(r.end).toBeLessThanOrEqual(windowEnd);
      expect(r.end).toBeGreaterThan(r.start);
    }
    expect(rows.find((r) => r.task.id === 'late')!.overdue).toBe(true);
    expect(rows.find((r) => r.task.id === 'a')!.overdue).toBe(false);
  });

  it('flags the critical chain', () => {
    const tasks = [
      makeTask({ id: 'a', createdAt: NOW - 2 * DAY }),
      makeTask({ id: 'b', createdAt: NOW - DAY, blockedBy: ['a'] }),
    ];
    const { rows } = ganttRows(tasks, 'p1', NOW);
    expect(
      rows
        .filter((r) => r.critical)
        .map((r) => r.task.id)
        .sort(),
    ).toEqual(['a', 'b']);
  });
});
