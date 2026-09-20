import { describe, expect, it } from 'vitest';
import { getInsights, visibleInsights } from './insights';
import { executeInsightCta } from './insightActions';
import { buildPath } from './ai/planner';
import { buildSprint } from './ai/sprint';
import { recordFeedback, type EstimateProfiles } from './ai/learner';
import type { Session } from './store';
import type { Project } from './projects';

const DAY = 86_400_000;
const NOW = Date.now();

function project(id: string, name: string, extra: Partial<Project> = {}): Project {
  return {
    id,
    name,
    color: '#22c55e',
    category: 'work',
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

/** One rich world that lights up most rules at once. */
function richInput() {
  const projects = [project('p1', 'Client X', { deadline: NOW + 2 * DAY }), project('p2', 'Hobby')];
  const history: Session[] = [
    { id: 'a', at: NOW - 1 * DAY, min: 60, projectId: 'p1' },
    { id: 'b', at: NOW - 2 * DAY, min: 60, projectId: 'p1' },
    { id: 'c', at: NOW - 3 * DAY, min: 30, projectId: 'p2' },
  ];
  const tasks = [
    {
      id: 't1',
      projectId: 'p1',
      title: 'Draft proposal',
      status: 'pending',
      priority: 'p1',
      estimateMin: 50,
    },
  ];
  const goals = [
    {
      id: 'g1',
      title: 'Retain client',
      level: 'project' as const,
      projectId: 'p1',
      progress: 20,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const fullTasks = [
    {
      id: 't1',
      projectId: 'p1',
      title: 'Draft proposal',
      status: 'pending' as const,
      priority: 'p1' as const,
      createdAt: 1,
      updatedAt: NOW,
    },
  ];
  return { history, projects, areas: [], tasks, timezone: 'UTC', goals, fullTasks };
}

describe('QA invariants', () => {
  it('insight ids are unique per generation', () => {
    const list = getInsights(richInput());
    const ids = list.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('free users only ever see action-less core signals', () => {
    const list = getInsights(richInput());
    const free = visibleInsights(list, false);
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((i) => i.tier === 'core')).toBe(true);
    expect(free.every((i) => i.cta.type === 'none')).toBe(true);
  });

  it('every produced CTA executes cleanly through the pure executor', () => {
    const list = getInsights(richInput());
    const actionable = list.filter((i) => i.cta.type !== 'none');
    expect(actionable.length).toBeGreaterThan(0);
    for (const ins of actionable) {
      const out = executeInsightCta({ plans: [], blocks: [], tasks: [] }, ins.cta, {
        todayKey: '2026-1-15',
        maxIvy: 6,
        blockLabel: 'Deep work',
      });
      expect(Array.isArray(out.plans)).toBe(true);
      expect(Array.isArray(out.blocks)).toBe(true);
      expect(Array.isArray(out.tasks)).toBe(true);
    }
  });

  it('estimate multipliers stay in hard bounds after chaotic feedback', () => {
    let profiles: EstimateProfiles = {};
    const kinds = ['done', 'continue', 'blocked', 'misestimated'] as const;
    for (let i = 0; i < 100; i++) {
      profiles = recordFeedback(profiles, 'k', (i % 5) + 1, ((i * 7) % 9) + 1, kinds[i % 4], i);
    }
    const m = profiles.k.multiplier;
    expect(m).toBeGreaterThanOrEqual(0.5);
    expect(m).toBeLessThanOrEqual(3);
    // 'blocked' is a no-op by design: 25 of 100 iterations skip sampling.
    expect(profiles.k.samples).toBe(75);
  });

  it('generated paths keep referential integrity; sprints keep checkpoint order', () => {
    const path = buildPath({
      text: 'Learn React',
      horizonMonths: 9,
      level: 'beginner',
      hoursPerWeek: 6,
    });
    const phaseIds = new Set(path.phases.map((p) => p.id));
    const msIds = new Set(path.milestones.map((m) => m.id));
    expect(path.milestones.every((m) => phaseIds.has(m.phaseId))).toBe(true);
    expect(path.tasks.every((x) => msIds.has(x.milestoneId))).toBe(true);
    expect(path.tasks.every((x) => x.pomodoros >= 1 && x.pomodoros <= 8)).toBe(true);
    const sprint = buildSprint({ skill: 'React', hoursPerWeek: 5 });
    expect(sprint.checkpoints.map((c) => c.atHours)).toEqual([5, 10, 15, 20]);
    expect(sprint.subskillFrames.length).toBeGreaterThanOrEqual(3);
  });
});
