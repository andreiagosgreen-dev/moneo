import { describe, expect, it } from 'vitest';
import { type Badge, type BadgeId, computeBadges, longestFocusStreak } from './badges';
import { RANKS, xpAtLevel } from './xp';
import type { Project } from './projects';
import type { Session } from './store';
import type { Task } from './tasks';

const day = (d: number, h = 10) => new Date(2026, 8, d, h).getTime();

const session = (at: number, min: number): Session => ({ at, min });

const project = (id: string): Project => ({
  id,
  name: `Project ${id}`,
  color: '#000',
  category: 'work',
  tags: [],
  createdAt: 0,
  updatedAt: 0,
});

const task = (id: string, projectId: string, status: Task['status'], completedAt = day(1)) =>
  ({
    id,
    projectId,
    title: `Task ${id}`,
    status,
    priority: 'p2',
    createdAt: 0,
    updatedAt: 0,
    completedAt,
  }) as Task;

const empty = { history: [], tasks: [], habitLog: {}, phases: [], projects: [] };

const byId = (badges: Badge[]) =>
  Object.fromEntries(badges.map((b) => [b.id, b])) as Record<BadgeId, Badge>;

const levelOf = (id: string) => RANKS.find((r) => r.id === id)!.firstLevel;

describe('longestFocusStreak', () => {
  it('counts the longest run of consecutive local days', () => {
    const history = [1, 2, 3, 5, 6, 7, 8, 9].map((d) => session(day(d), 25));
    expect(longestFocusStreak(history)).toBe(5);
  });

  it('counts several rounds on one day once and ignores invalid ones', () => {
    const history = [
      session(day(1, 8), 25),
      session(day(1, 20), 25),
      session(day(2), 0),
      session(Number.NaN, 25),
    ];
    expect(longestFocusStreak(history)).toBe(1);
  });

  it('crosses month boundaries', () => {
    const history = [
      session(new Date(2026, 8, 29).getTime(), 25),
      session(new Date(2026, 8, 30).getTime(), 25),
      session(new Date(2026, 9, 1).getTime(), 25),
    ];
    expect(longestFocusStreak(history)).toBe(3);
  });

  it('is 0 without focus', () => {
    expect(longestFocusStreak([])).toBe(0);
  });
});

describe('computeBadges', () => {
  it('returns every badge locked, in a stable order, for a new user', () => {
    const badges = computeBadges(empty);
    expect(badges.map((b) => b.id)).toEqual([
      'firstFocus',
      'focus10h',
      'streak7',
      'firstProject',
      'tasks50',
      'apprentice',
      'practitioner',
      'expert',
    ]);
    expect(badges.every((b) => !b.earned)).toBe(true);
    expect(byId(badges).tasks50.progress).toEqual({ value: 0, target: 50 });
  });

  it('earns the focus badges from focus history', () => {
    const history = Array.from({ length: 7 }, (_, i) => session(day(i + 1), 90));
    const b = byId(computeBadges({ ...empty, history }));
    expect(b.firstFocus.earned).toBe(true);
    expect(b.focus10h.earned).toBe(true);
    expect(b.focus10h.progress).toEqual({ value: 10, target: 10 });
    expect(b.streak7.earned).toBe(true);
  });

  it('reports partial progress for locked focus badges', () => {
    const history = [session(day(1), 125), session(day(3), 60)];
    const b = byId(computeBadges({ ...empty, history }));
    expect(b.firstFocus.earned).toBe(true);
    expect(b.focus10h).toMatchObject({ earned: false, progress: { value: 3, target: 10 } });
    expect(b.streak7).toMatchObject({ earned: false, progress: { value: 1, target: 7 } });
  });

  it('earns the project and task badges', () => {
    const projects = [project('p1')];
    const tasks = Array.from({ length: 50 }, (_, i) =>
      task(`t${i}`, i < 3 ? 'p1' : 'p2', 'completed'),
    );
    const b = byId(computeBadges({ ...empty, projects, tasks }));
    expect(b.firstProject.earned).toBe(true);
    expect(b.tasks50.earned).toBe(true);
  });

  it('does not count open tasks or unfinished projects', () => {
    const projects = [project('p1')];
    const tasks = [
      task('a', 'p1', 'completed'),
      task('b', 'p1', 'completed'),
      task('c', 'p1', 'pending'),
    ];
    const b = byId(computeBadges({ ...empty, projects, tasks }));
    expect(b.firstProject.earned).toBe(false);
    expect(b.tasks50.progress).toEqual({ value: 2, target: 50 });
  });

  it('earns rank badges from total XP at the rank thresholds', () => {
    const apprentice = xpAtLevel(levelOf('apprentice'));
    const below = byId(computeBadges({ ...empty, totalXp: apprentice - 1 }));
    expect(below.apprentice.earned).toBe(false);
    expect(below.apprentice.progress).toEqual({ value: apprentice - 1, target: apprentice });

    const at = byId(computeBadges({ ...empty, totalXp: apprentice }));
    expect(at.apprentice.earned).toBe(true);
    expect(at.practitioner.earned).toBe(false);

    const expert = byId(computeBadges({ ...empty, totalXp: xpAtLevel(levelOf('expert')) }));
    expect(expert.apprentice.earned && expert.practitioner.earned && expert.expert.earned).toBe(
      true,
    );
  });

  it('computes XP itself when no total is given', () => {
    const history = Array.from({ length: 10 }, (_, i) => session(day(i + 1), 240));
    const b = byId(computeBadges({ ...empty, history }));
    expect(b.apprentice.earned).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const history = [session(day(1), 30), session(day(2), 30)];
    expect(computeBadges({ ...empty, history })).toEqual(computeBadges({ ...empty, history }));
  });
});
