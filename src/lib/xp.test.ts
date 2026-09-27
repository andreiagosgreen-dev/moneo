import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_CELEBRATED_JUMP,
  RANKS,
  XP_RULES,
  computeXp,
  finishedProjectIds,
  focusXp,
  habitXp,
  levelFromXp,
  levelUpCheck,
  loadLastSeenLevel,
  phaseXp,
  rankForLevel,
  romanNumeral,
  saveLastSeenLevel,
  taskXp,
  xpAtLevel,
  xpToNext,
} from './xp';
import type { Project } from './projects';
import type { Session } from './store';
import type { Task } from './tasks';
import type { WaterfallPhase } from './waterfall';

const day = (d: number, h = 10) => new Date(2026, 8, d, h).getTime();

const session = (at: number, min: number): Session => ({ at, min });

const project = (id: string, extra: Partial<Project> = {}): Project => ({
  id,
  name: `Project ${id}`,
  color: '#000',
  category: 'work',
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

const task = (id: string, projectId: string, status: Task['status'], extra: Partial<Task> = {}) =>
  ({
    id,
    projectId,
    title: `Task ${id}`,
    status,
    priority: 'medium',
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  }) as Task;

const phase = (
  id: string,
  projectId: string,
  status: WaterfallPhase['status'],
): WaterfallPhase => ({
  id,
  projectId,
  name: `Phase ${id}`,
  order: 0,
  status,
  createdAt: 0,
  updatedAt: 0,
});

describe('focusXp', () => {
  it('gives 1 XP per focused minute', () => {
    expect(focusXp([session(day(1), 25), session(day(1, 14), 50)])).toBe(75);
  });

  it('caps each local day at the daily limit', () => {
    const cap = XP_RULES.focusDailyCapMin;
    expect(focusXp([session(day(1), 200), session(day(1, 15), 100)])).toBe(cap);
    expect(focusXp([session(day(1), 480), session(day(2), 480)])).toBe(cap * 2);
  });

  it('counts different days separately, under the cap', () => {
    expect(focusXp([session(day(1), 100), session(day(2), 100)])).toBe(200);
  });

  it('ignores broken entries and floors fractional minutes', () => {
    const broken = [
      session(Number.NaN, 30),
      session(day(1), -5),
      session(day(1), Number.NaN),
      session(day(1), 10.9),
      null as unknown as Session,
    ];
    expect(focusXp(broken)).toBe(10);
    expect(focusXp([])).toBe(0);
  });
});

describe('taskXp', () => {
  it('rewards finished tasks and milestones, ignores open ones', () => {
    const tasks = [
      task('a', 'p', 'completed', { completedAt: day(1) }),
      task('b', 'p', 'completed', { completedAt: day(1), milestone: true }),
      task('c', 'p', 'pending'),
      task('d', 'p', 'in_progress'),
    ];
    expect(taskXp(tasks)).toBe(XP_RULES.task + XP_RULES.milestoneTask);
  });

  it('counts at most the daily cap per day, keeping the most valuable', () => {
    const cap = XP_RULES.taskDailyCap;
    const many = Array.from({ length: cap + 5 }, (_, i) =>
      task(`t${i}`, 'p', 'completed', { completedAt: day(3), milestone: i < 2 }),
    );
    expect(taskXp(many)).toBe(2 * XP_RULES.milestoneTask + (cap - 2) * XP_RULES.task);
    const nextDay = task('x', 'p', 'completed', { completedAt: day(4) });
    expect(taskXp([...many, nextDay])).toBe(taskXp(many) + XP_RULES.task);
  });

  it('falls back to updatedAt when completedAt is missing', () => {
    const legacy = Array.from({ length: XP_RULES.taskDailyCap + 3 }, (_, i) =>
      task(`l${i}`, 'p', 'completed', { updatedAt: day(5) }),
    );
    expect(taskXp(legacy)).toBe(XP_RULES.taskDailyCap * XP_RULES.task);
  });
});

describe('habitXp', () => {
  it('gives XP per habit per checked day, deduped', () => {
    expect(habitXp({ h1: ['2026-9-1', '2026-9-2', '2026-9-2'], h2: ['2026-9-1'] })).toBe(
      3 * XP_RULES.habitCheckIn,
    );
  });

  it('survives malformed logs', () => {
    expect(habitXp({ h1: 'nope' as unknown as string[], h2: ['', '2026-9-1'] })).toBe(
      XP_RULES.habitCheckIn,
    );
    expect(habitXp(null as unknown as Record<string, string[]>)).toBe(0);
  });
});

describe('phaseXp + finishedProjectIds', () => {
  it('counts done phases only', () => {
    expect(phaseXp([phase('a', 'p', 'done'), phase('b', 'p', 'active')])).toBe(XP_RULES.phase);
  });

  it('finishes a project when all of its (3+) tasks are done', () => {
    const projects = [project('p1'), project('p2'), project('p3')];
    const tasks = [
      task('a', 'p1', 'completed'),
      task('b', 'p1', 'completed'),
      task('c', 'p1', 'completed'),
      task('d', 'p2', 'completed'),
      task('e', 'p2', 'completed'),
      task('f', 'p3', 'completed'),
      task('g', 'p3', 'completed'),
      task('h', 'p3', 'pending'),
    ];
    expect(finishedProjectIds(projects, tasks, [])).toEqual(['p1']);
  });

  it('finishes a project when all of its (3+) phases are done, archived included', () => {
    const projects = [project('p1', { archived: true })];
    const phases = [phase('a', 'p1', 'done'), phase('b', 'p1', 'done'), phase('c', 'p1', 'done')];
    expect(finishedProjectIds(projects, [], phases)).toEqual(['p1']);
    expect(finishedProjectIds(projects, [], phases.slice(0, 2))).toEqual([]);
  });
});

describe('computeXp', () => {
  it('sums every source into a breakdown', () => {
    const tasks = [
      task('a', 'p1', 'completed', { completedAt: day(1) }),
      task('b', 'p1', 'completed', { completedAt: day(1) }),
      task('c', 'p1', 'completed', { completedAt: day(1), milestone: true }),
    ];
    const xp = computeXp({
      history: [session(day(1), 30)],
      tasks,
      habitLog: { h: ['2026-9-1'] },
      phases: [phase('x', 'p1', 'done')],
      projects: [project('p1')],
    });
    expect(xp).toEqual({
      focus: 30,
      tasks: 2 * XP_RULES.task + XP_RULES.milestoneTask,
      habits: XP_RULES.habitCheckIn,
      phases: XP_RULES.phase,
      projects: XP_RULES.project,
      total: 30 + 45 + 5 + 30 + 100,
    });
  });

  it('is zero for an empty device', () => {
    expect(
      computeXp({ history: [], tasks: [], habitLog: {}, phases: [], projects: [] }).total,
    ).toBe(0);
  });
});

describe('level curve', () => {
  it('matches the planned ≈60·n^1.6 steps, rounded to 5', () => {
    expect(xpToNext(1)).toBe(60);
    expect(xpToNext(2)).toBe(180);
    expect(xpToNext(3)).toBe(350);
    for (let n = 1; n < 60; n++) {
      expect(xpToNext(n) % 5).toBe(0);
      expect(xpToNext(n + 1)).toBeGreaterThan(xpToNext(n));
    }
  });

  it('starts at level 1 with nothing earned', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, span: 60, progress: 0 });
    expect(levelFromXp(-50).level).toBe(1);
    expect(levelFromXp(Number.NaN).level).toBe(1);
  });

  it('crosses each level exactly at its threshold', () => {
    for (let lv = 2; lv <= 40; lv++) {
      const at = xpAtLevel(lv);
      expect(levelFromXp(at)).toMatchObject({ level: lv, into: 0 });
      expect(levelFromXp(at - 1).level).toBe(lv - 1);
    }
  });

  it('reports progress inside the level', () => {
    const info = levelFromXp(60 + 90);
    expect(info).toMatchObject({ level: 2, into: 90, span: 180 });
    expect(info.progress).toBeCloseTo(0.5);
  });

  it('never loops forever on absurd totals', () => {
    expect(levelFromXp(Number.MAX_SAFE_INTEGER).level).toBeLessThanOrEqual(500);
  });
});

describe('ranks', () => {
  it('walks Beginner → Apprentice → Practitioner → Expert → Master', () => {
    expect(RANKS.map((r) => r.id)).toEqual([
      'beginner',
      'apprentice',
      'practitioner',
      'expert',
      'master',
    ]);
  });

  it.each([
    [1, 'beginner', 1, true],
    [3, 'beginner', 3, false],
    [4, 'apprentice', 1, true],
    [8, 'apprentice', 5, false],
    [9, 'practitioner', 1, true],
    [14, 'practitioner', 6, false],
    [15, 'expert', 1, true],
    [21, 'expert', 7, false],
    [22, 'master', 1, true],
    [30, 'master', 9, false],
  ] as const)('level %i is %s %i', (level, id, tier, isNewRank) => {
    expect(rankForLevel(level)).toEqual({ id, tier, isNewRank });
  });

  it('treats junk as level 1', () => {
    expect(rankForLevel(0)).toMatchObject({ id: 'beginner', tier: 1 });
    expect(rankForLevel(Number.NaN)).toMatchObject({ id: 'beginner', tier: 1 });
  });

  it('writes tiers as roman numerals', () => {
    expect([1, 2, 3, 4, 5, 9, 14, 40].map(romanNumeral)).toEqual([
      'I',
      'II',
      'III',
      'IV',
      'V',
      'IX',
      'XIV',
      'XL',
    ]);
    expect(romanNumeral(0)).toBe('I');
  });
});

describe('levelUpCheck', () => {
  it('adopts the current level silently on first run', () => {
    expect(levelUpCheck(7, null)).toEqual({ celebrate: null, seen: 7 });
    expect(levelUpCheck(7, Number.NaN)).toEqual({ celebrate: null, seen: 7 });
  });

  it('celebrates a new level once', () => {
    const first = levelUpCheck(5, 4);
    expect(first).toEqual({ celebrate: 5, seen: 5 });
    expect(levelUpCheck(5, first.seen)).toEqual({ celebrate: null, seen: 5 });
  });

  it('never lowers the mark, so un-check + re-check cannot replay it', () => {
    expect(levelUpCheck(4, 5)).toEqual({ celebrate: null, seen: 5 });
    expect(levelUpCheck(5, 5)).toEqual({ celebrate: null, seen: 5 });
  });

  it('celebrates small jumps, absorbs big ones (sync pull / restore) quietly', () => {
    expect(levelUpCheck(3 + MAX_CELEBRATED_JUMP, 3)).toEqual({
      celebrate: 3 + MAX_CELEBRATED_JUMP,
      seen: 3 + MAX_CELEBRATED_JUMP,
    });
    expect(levelUpCheck(12, 2)).toEqual({ celebrate: null, seen: 12 });
  });
});

describe('last seen level storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips and rejects junk', () => {
    expect(loadLastSeenLevel()).toBeNull();
    saveLastSeenLevel(6);
    expect(loadLastSeenLevel()).toBe(6);
    localStorage.setItem('moneo:xp-seen', JSON.stringify({ level: 'x' }));
    expect(loadLastSeenLevel()).toBeNull();
    localStorage.setItem('moneo:xp-seen', JSON.stringify({ level: 0 }));
    expect(loadLastSeenLevel()).toBeNull();
  });
});
