import { describe, expect, it } from 'vitest';
import {
  buildLastWeekRecap,
  lastWeekRange,
  loadRecapSeen,
  recapHasActivity,
  saveRecapSeen,
  shouldShowRecap,
  snapshotAt,
} from './weekRecap';
import type { Task } from './tasks';
import type { XpInput } from './xp';

const noonUtc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12);

function done(id: string, completedAt: number): Task {
  return {
    id,
    projectId: 'p',
    title: id,
    status: 'completed',
    priority: 'p2',
    createdAt: 1,
    updatedAt: completedAt,
    completedAt,
  };
}

/** Today is Wednesday 2026-10-7, so last week is 2026-9-28 .. 2026-10-4. */
const TODAY = '2026-10-7';

const fixture: XpInput = {
  history: [
    { at: noonUtc(2026, 9, 20), min: 30 }, // before
    { at: noonUtc(2026, 9, 30), min: 25 },
    { at: noonUtc(2026, 10, 2), min: 40 },
    { at: noonUtc(2026, 10, 6), min: 50 }, // this week
  ],
  tasks: [
    done('before', noonUtc(2026, 9, 20)),
    done('during', noonUtc(2026, 10, 1)),
    done('after', noonUtc(2026, 10, 6)),
  ],
  habitLog: { h1: ['2026-9-20', '2026-9-29', '2026-10-3', '2026-10-6'] },
  phases: [],
  projects: [],
};

describe('lastWeekRange', () => {
  it('is the previous Monday..Sunday for a Monday and for a Sunday', () => {
    expect(lastWeekRange('2026-10-5')).toEqual({ start: '2026-9-28', end: '2026-10-4' });
    expect(lastWeekRange('2026-10-11')).toEqual({ start: '2026-9-28', end: '2026-10-4' });
    expect(lastWeekRange('2027-1-4')).toEqual({ start: '2026-12-28', end: '2027-1-3' });
  });
});

describe('snapshotAt', () => {
  it('drops later sessions, later completions and later habit days', () => {
    const snap = snapshotAt(fixture, '2026-10-4', 'UTC');
    expect(snap.history).toHaveLength(3);
    expect(snap.tasks.find((t) => t.id === 'after')!.status).toBe('pending');
    expect(snap.tasks.find((t) => t.id === 'during')!.status).toBe('completed');
    expect(snap.habitLog.h1).toEqual(['2026-9-20', '2026-9-29', '2026-10-3']);
  });
});

describe('buildLastWeekRecap', () => {
  it('sums last week only and derives the XP gained', () => {
    const r = buildLastWeekRecap({ ...fixture, timezone: 'UTC', todayKey: TODAY });
    expect(r).toMatchObject({
      start: '2026-9-28',
      end: '2026-10-4',
      focusMin: 65,
      sessions: 2,
      tasksDone: 1,
      habitCheckins: 2,
      bestDay: { key: '2026-10-2', min: 40 },
    });
    // 65 focus minutes + one task (10) + two habit check-ins (2 × 5).
    expect(r.xpGained).toBe(85);
    expect(r.newBadges).toEqual([]);
    expect(recapHasActivity(r)).toBe(true);
  });

  it('lists a badge first earned during the week', () => {
    const r = buildLastWeekRecap({
      history: [{ at: noonUtc(2026, 9, 30), min: 25 }],
      tasks: [],
      habitLog: {},
      phases: [],
      projects: [],
      timezone: 'UTC',
      todayKey: TODAY,
    });
    expect(r.newBadges).toContain('firstFocus');
  });

  it('reports no activity for an empty week', () => {
    const r = buildLastWeekRecap({
      history: [],
      tasks: [],
      habitLog: {},
      phases: [],
      projects: [],
      timezone: 'UTC',
      todayKey: TODAY,
    });
    expect(recapHasActivity(r)).toBe(false);
    expect(r.xpGained).toBe(0);
    expect(r.bestDay).toBeNull();
  });
});

describe('shouldShowRecap', () => {
  const recap = buildLastWeekRecap({ ...fixture, timezone: 'UTC', todayKey: TODAY });

  it('shows once per week until dismissed, never on the first run', () => {
    expect(shouldShowRecap({ todayKey: TODAY, seenMonday: null, recap, firstRun: false })).toBe(
      true,
    );
    expect(shouldShowRecap({ todayKey: TODAY, seenMonday: null, recap, firstRun: true })).toBe(
      false,
    );
    saveRecapSeen('2026-10-5');
    expect(loadRecapSeen()).toBe('2026-10-5');
    expect(
      shouldShowRecap({ todayKey: TODAY, seenMonday: loadRecapSeen(), recap, firstRun: false }),
    ).toBe(false);
    expect(
      shouldShowRecap({
        todayKey: '2026-10-12',
        seenMonday: loadRecapSeen(),
        recap,
        firstRun: false,
      }),
    ).toBe(true);
  });
});
