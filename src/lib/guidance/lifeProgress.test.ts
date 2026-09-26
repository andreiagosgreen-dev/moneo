import { describe, expect, it } from 'vitest';
import {
  buildLifeHubSnapshot,
  focusDayPct,
  lifeNextStep,
  projectsDonePct,
  todayPlanPct,
} from './lifeProgress';
import type { IvyPlan } from '../ivyLee';
import type { LifeMapArea } from '../lifemap';
import type { Project } from '../projects';
import type { Task } from '../tasks';

function plan(tasks: Array<{ done: boolean }>): IvyPlan {
  return {
    dateKey: '2026-9-25',
    tasks: tasks.map((t, i) => ({
      id: `t${i}`,
      text: `Task ${i}`,
      done: t.done,
      rank: i + 1,
    })),
  };
}

function area(gap: boolean): LifeMapArea {
  return {
    id: 'a1',
    name: 'Health',
    color: '#3ecf8e',
    icon: '❤️',
    currentScore: gap ? 4 : 8,
    desiredScore: 8,
    importance: 3,
    intention: 'Walk',
    linkedGoalIds: [],
    linkedProjectIds: [],
    linkedHabitIds: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('todayPlanPct', () => {
  it('is 0 on empty and 100 when all done', () => {
    expect(todayPlanPct(null)).toBe(0);
    expect(todayPlanPct(plan([]))).toBe(0);
    expect(todayPlanPct(plan([{ done: true }, { done: true }]))).toBe(100);
    expect(todayPlanPct(plan([{ done: true }, { done: false }]))).toBe(50);
  });
});

describe('focusDayPct', () => {
  it('scales with sessions and minutes', () => {
    expect(focusDayPct(0, 0)).toBe(0);
    expect(focusDayPct(1, 0)).toBe(40);
    expect(focusDayPct(1, 25)).toBe(60);
    expect(focusDayPct(3, 100)).toBe(100);
  });
});

describe('projectsDonePct', () => {
  it('ignores archived projects', () => {
    const projects = [
      { id: 'p1', archived: false },
      { id: 'p2', archived: true },
    ] as Project[];
    const tasks = [
      { id: '1', projectId: 'p1', status: 'completed' },
      { id: '2', projectId: 'p1', status: 'pending' },
      { id: '3', projectId: 'p2', status: 'completed' },
    ] as Task[];
    expect(projectsDonePct(tasks, projects)).toBe(50);
  });
});

describe('lifeNextStep', () => {
  it('asks to write when there is no plan', () => {
    expect(lifeNextStep(null, []).kind).toBe('writePlan');
  });

  it('asks to work when open items remain', () => {
    expect(lifeNextStep(plan([{ done: false }]), []).kind).toBe('workFocus');
  });

  it('asks to tune map when the day is done and life has gaps', () => {
    expect(lifeNextStep(plan([{ done: true }]), [area(true)]).kind).toBe('tuneMap');
  });

  it('keeps rhythm when the day plan is done and life is balanced', () => {
    expect(lifeNextStep(plan([{ done: true }]), [area(false)]).kind).toBe('keepRhythm');
  });
});

describe('buildLifeHubSnapshot', () => {
  it('returns four frames and a next step', () => {
    const snap = buildLifeHubSnapshot({
      plan: plan([{ done: true }, { done: false }]),
      focusSessions: 1,
      focusMin: 25,
      tasks: [],
      projects: [],
      lifeMap: [],
    });
    expect(snap.frames).toHaveLength(4);
    expect(snap.frames.map((f) => f.id)).toEqual(['today', 'focus', 'projects', 'life']);
    expect(snap.next.kind).toBe('workFocus');
  });
});
