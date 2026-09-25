import { describe, expect, it } from 'vitest';
import { buildWeeklyRecap, drawRecapCard, RECAP_W, RECAP_H, type RecapStrings } from './recap';
import { dayKeyInTz } from './timezone';
import type { Session } from './store';
import type { Project } from './projects';
import type { Task } from './tasks';
import type { Goal } from './goals';

const DAY = 24 * 3600_000;
const NOW = new Date('2026-09-18T12:00:00Z').getTime(); // a Thursday

const mondayKeyOf = (at: number) => {
  const d = new Date(at);
  const dow = (d.getDay() + 6) % 7;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  return `${m.getFullYear()}-${m.getMonth() + 1}-${m.getDate()}`;
};

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Launch site',
    color: '#22c55e',
    category: 'work',
    tags: [],
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY,
    ...over,
  };
}

describe('buildWeeklyRecap', () => {
  it('aggregates totals, days, top projects and goals in motion', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        projectId: 'p1',
        title: 'A',
        status: 'completed',
        priority: 'p1',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 't2',
        projectId: 'p1',
        title: 'B',
        status: 'pending',
        priority: 'p2',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 't3',
        projectId: 'p2',
        title: 'C',
        status: 'pending',
        priority: 'p2',
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const goals: Goal[] = [
      { id: 'g1', title: 'Ship it', level: 'project', projectId: 'p1', createdAt: 1, updatedAt: 1 },
    ];
    const history: Session[] = [
      { id: 's1', at: NOW - 2 * DAY, min: 25, projectId: 'p1' },
      { id: 's2', at: NOW - DAY, min: 50, projectId: 'p1' },
      { id: 's3', at: NOW, min: 25, projectId: 'p2' },
      { id: 'old', at: NOW - 30 * DAY, min: 60, projectId: 'p1' },
    ];
    // Trailing 7 UTC days ending at NOW — matches rangeDayKeys('week') shape, pinned so Date.now() drift cannot break CI.
    const weekKeys = Array.from({ length: 7 }, (_, i) => dayKeyInTz(NOW - (6 - i) * DAY, 'UTC'));
    const recap = buildWeeklyRecap({
      history,
      projects: [project(), project({ id: 'p2', name: 'Blog', color: '#3b82f6' })],
      tasks,
      goals,
      timezone: 'UTC',
      dayKeys: weekKeys,
    });
    expect(recap.dayKeys).toHaveLength(7);
    expect(recap.sessionCount).toBe(3);
    expect(recap.totalMin).toBe(100);
    expect(recap.days.reduce((s, d) => s + d.min, 0)).toBe(100);
    expect(recap.topProjects[0]).toMatchObject({ projectId: 'p1', min: 75, pct: 50 });
    expect(recap.topProjects[1]).toMatchObject({ projectId: 'p2', pct: 0 });
    expect(recap.goalsInMotion).toEqual([{ goalId: 'g1', title: 'Ship it', pct: 50 }]);
  });

  it('is empty-safe: no sessions, no projects, no goals', () => {
    const recap = buildWeeklyRecap({
      history: [],
      projects: [],
      tasks: [],
      goals: [],
      timezone: 'UTC',
    });
    expect(recap.sessionCount).toBe(0);
    expect(recap.totalMin).toBe(0);
    expect(recap.topProjects).toEqual([]);
    expect(recap.goalsInMotion).toEqual([]);
    expect(recap.days).toHaveLength(7);
  });

  it('accepts fixed day keys (test seam) and honors the monday window', () => {
    const mondayAt = NOW - ((new Date(NOW).getDay() + 6) % 7) * DAY;
    const keys = Array.from({ length: 7 }, (_, i) => mondayKeyOf(mondayAt + i * DAY));
    const recap = buildWeeklyRecap({
      history: [{ id: 's1', at: mondayAt + 3600_000, min: 25, projectId: 'p1' }],
      projects: [project()],
      tasks: [],
      goals: [],
      timezone: 'UTC',
      dayKeys: keys,
    });
    expect(recap.dayKeys).toEqual(keys);
    expect(recap.totalMin).toBe(25);
    expect(recap.days[0].min).toBe(25);
  });
});

describe('drawRecapCard', () => {
  const strings: RecapStrings = {
    title: 'Weekly recap',
    weekLabel: 'Last 7 days',
    sessionsLabel: 'sessions',
    streakLine: '3-day streak',
    topLabel: 'Top project',
    brand: 'Moneo',
  };
  it('fails soft without a 2d context (jsdom)', () => {
    const canvas = document.createElement('canvas');
    const recap = buildWeeklyRecap({
      history: [],
      projects: [],
      tasks: [],
      goals: [],
      timezone: 'UTC',
    });
    expect(drawRecapCard(canvas, recap, strings, (m) => `${m}m`)).toBe(false);
    expect(canvas.width).toBe(RECAP_W);
    expect(canvas.height).toBe(RECAP_H);
  });
});
