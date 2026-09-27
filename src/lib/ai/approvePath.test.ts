import { describe, expect, it, beforeEach } from 'vitest';
import { approveRoadmapCompose, packForKind, kindForRoadmap } from './approvePath';
import { roadmapFromBuiltPath, type Roadmap } from './roadmap';
import type { BuiltPath } from './types';
import { WATERFALL_PACKS } from '../waterfall';

beforeEach(() => {
  localStorage.clear();
});

const samplePath: BuiltPath = {
  goal: 'Build a drone',
  kind: 'build',
  horizonMonths: 6,
  level: 'beginner',
  hoursPerWeek: 5,
  phases: [],
  milestones: [{ id: 'ms-1', phaseId: 'p1', title: 'M1' }],
  tasks: [
    { draftId: 'd1', milestoneId: 'ms-1', title: 'Spec airframe', pomodoros: 2, priority: 'p1' },
    { draftId: 'd2', milestoneId: 'ms-1', title: 'Order BOM', pomodoros: 1, priority: 'p2' },
  ],
  totalPomodoros: 3,
  fitsCapacity: true,
  assumptions: [],
};

describe('approvePath', () => {
  it('maps build kind to hardware waterfall pack', () => {
    expect(packForKind('build')).toBe('build');
    expect(WATERFALL_PACKS.build.length).toBeGreaterThanOrEqual(6);
  });

  it('composes project, tasks with step.taskId, and waterfall phases', () => {
    const roadmap = roadmapFromBuiltPath(samplePath, 'build', 'local', [], 25);
    expect(kindForRoadmap(roadmap)).toBe('build');
    const result = approveRoadmapCompose({
      roadmap,
      projects: [],
      tasks: [],
      phases: [],
      paceMinPerDay: 40,
    });
    expect(result.projectId).toBeTruthy();
    expect(result.projects).toHaveLength(1);
    expect(result.tasks).toHaveLength(2);
    expect(result.roadmap.steps.every((s) => !!s.taskId)).toBe(true);
    expect(result.focusTaskId).toBe(result.roadmap.steps[0].taskId);
    const scoped = result.phases.filter((p) => p.projectId === result.projectId);
    expect(scoped).toHaveLength(WATERFALL_PACKS.build.length);
    expect(scoped[0]?.status).toBe('active');
    expect(result.roadmap.actualMinPerDay).toBeGreaterThan(0);
    expect(result.roadmap.steps[0]?.title.startsWith('ai.tpl.')).toBe(false);
  });

  it('does not reseeds waterfall when phases already exist', () => {
    const roadmap = roadmapFromBuiltPath(samplePath, 'build', 'local', [], 25);
    const first = approveRoadmapCompose({
      roadmap,
      projects: [],
      tasks: [],
      phases: [],
    });
    const again: Roadmap = {
      ...roadmapFromBuiltPath(samplePath, 'build', 'local', [], 25),
      title: 'Second drone',
    };
    const second = approveRoadmapCompose({
      roadmap: again,
      projects: first.projects,
      tasks: first.tasks,
      phases: first.phases,
    });
    // New project gets its own pack; old project phases unchanged count + new pack
    expect(second.phases.length).toBe(WATERFALL_PACKS.build.length * 2);
  });
});
