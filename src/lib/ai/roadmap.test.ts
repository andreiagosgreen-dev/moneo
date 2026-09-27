import { describe, expect, it, beforeEach } from 'vitest';
import type { BuiltPath } from './types';
import {
  addStep,
  moveStep,
  recalcRoadmap,
  removeStep,
  roadmapEta,
  roadmapFromBuiltPath,
  roadmapProgress,
  syncStepsFromTasks,
  updateStep,
} from './roadmap';

beforeEach(() => {
  localStorage.clear();
});

const samplePath: BuiltPath = {
  goal: 'Learn math',
  kind: 'learning',
  horizonMonths: 12,
  level: 'beginner',
  hoursPerWeek: 5,
  phases: [],
  milestones: [{ id: 'ms-1', phaseId: 'p1', title: 'M1' }],
  tasks: [
    { draftId: 'd1', milestoneId: 'ms-1', title: 'Step A', pomodoros: 2, priority: 'p1' },
    { draftId: 'd2', milestoneId: 'ms-1', title: 'Step B', pomodoros: 2, priority: 'p2' },
    { draftId: 'd3', milestoneId: 'ms-1', title: 'Step C', pomodoros: 1, priority: 'p3' },
  ],
  totalPomodoros: 5,
  fitsCapacity: true,
  assumptions: [],
};

describe('roadmap model', () => {
  it('builds from BuiltPath and supports edit/move/remove', () => {
    let r = roadmapFromBuiltPath(samplePath, 'build', 'local', [], 25);
    expect(r.steps).toHaveLength(3);
    expect(roadmapProgress(r)).toBe(0);
    r = updateStep(r, r.steps[0].id, { done: true });
    expect(roadmapProgress(r)).toBe(33);
    const top = r.steps[0].id;
    r = moveStep(r, r.steps[1].id, -1);
    expect(r.steps[0].id).not.toBe(top);
    r = removeStep(r, r.steps[0].id);
    expect(r.steps).toHaveLength(2);
    r = addStep(r, 'New step', 40);
    expect(r.steps[r.steps.length - 1]?.title).toBe('New step');
  });

  it('recalcs ETA when daily pace doubles', () => {
    let r = roadmapFromBuiltPath(samplePath, 'build', 'local', [], 25);
    // 5 pomodoros * 25 = 125 remaining at 25/day → 5 days
    expect(roadmapEta(r).daysLeft).toBe(5);
    r = recalcRoadmap(r, 120);
    // pace blends toward 120; remaining still 125 → fewer days
    const eta = roadmapEta(r);
    expect(eta.paceMinPerDay).toBeGreaterThan(25);
    expect(eta.daysLeft).toBeLessThan(5);
  });

  it('syncs step.done from linked task status', () => {
    let r = roadmapFromBuiltPath(samplePath, 'build', 'local', [], 25);
    const tid = 'task-1';
    r = { ...r, steps: r.steps.map((s, i) => (i === 0 ? { ...s, taskId: tid } : s)) };
    const synced = syncStepsFromTasks(r, (id) => (id === tid ? 'completed' : null));
    expect(synced?.steps[0]?.done).toBe(true);
    expect(syncStepsFromTasks(synced!, (id) => (id === tid ? 'completed' : null))).toBeNull();
  });
});
