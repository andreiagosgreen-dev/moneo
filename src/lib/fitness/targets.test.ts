import { describe, expect, it } from 'vitest';
import type { Goal } from '../goals';
import type { WorkoutEntry } from './workouts';
import { sanitizeWorkoutStore } from './workouts';
import {
  cleanTargets,
  exerciseHistory,
  exerciseTotals,
  newTarget,
  periodRange,
  reportRange,
  syncExerciseGoals,
  targetProgress,
  trainedExercises,
} from './targets';

const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).getTime();
const entry = (startedAt: number, sets: WorkoutEntry['sets'], id = String(startedAt)) =>
  ({ id, routineId: 'free', day: '', startedAt, durationSec: 600, sets }) as WorkoutEntry;

// Wednesday 2026-10-07
const NOW = at(2026, 10, 7, 12);
const LOG: WorkoutEntry[] = [
  entry(at(2026, 10, 7), [
    { ex: 'pushup', reps: 20 },
    { ex: 'pushup', reps: 15 },
    { ex: 'plank', sec: 60 },
  ]),
  entry(at(2026, 10, 5), [
    { ex: 'pushup', reps: 25 },
    { ex: 'plank', sec: 45 },
  ]),
  entry(at(2026, 10, 1), [{ ex: 'pushup', reps: 30 }]),
  entry(at(2026, 9, 20), [
    { ex: 'pushup', reps: 10 },
    { ex: 'bicepsCurl', reps: 12, kg: 8 },
    { ex: 'bicepsCurl', reps: 10, kg: 10 },
  ]),
  entry(at(2025, 12, 31), [{ ex: 'pushup', reps: 100 }]),
];

describe('periods', () => {
  it('starts weeks on Monday and covers day, month and year', () => {
    const [ws, we] = periodRange('week', NOW);
    expect(new Date(ws).getDay()).toBe(1);
    expect(new Date(ws).getDate()).toBe(5);
    expect(we - ws).toBeGreaterThanOrEqual(7 * 86_400_000 - 3_600_000);
    expect(new Date(periodRange('day', NOW)[0]).getDate()).toBe(7);
    expect(new Date(periodRange('month', NOW)[0]).getDate()).toBe(1);
    expect(new Date(periodRange('year', NOW)[0]).getMonth()).toBe(0);
  });

  it('report ranges include today', () => {
    const [from, to] = reportRange('d7', NOW);
    expect(from).toBeLessThanOrEqual(at(2026, 10, 1, 0));
    expect(to).toBeGreaterThan(NOW);
    expect(reportRange('all', NOW)).toEqual([-Infinity, Infinity]);
  });
});

describe('exerciseTotals', () => {
  it('adds reps, time, sets, sessions, bests and volume', () => {
    expect(exerciseTotals(LOG, 'pushup')).toMatchObject({
      reps: 200,
      sets: 6,
      sessions: 5,
      bestReps: 100,
    });
    expect(exerciseTotals(LOG, 'plank')).toMatchObject({ sec: 105, bestSec: 60, sets: 2 });
    expect(exerciseTotals(LOG, 'bicepsCurl')).toMatchObject({ maxKg: 10, volume: 196 });
  });

  it('respects the range', () => {
    const [from, to] = periodRange('year', NOW);
    expect(exerciseTotals(LOG, 'pushup', from, to).reps).toBe(100);
  });
});

describe('targets', () => {
  it('counts progress in the current period only', () => {
    const week = targetProgress(LOG, newTarget('pushup', 100, 'week', NOW), NOW);
    expect(week).toEqual({ done: 60, amount: 100, pct: 60 });
    const day = targetProgress(LOG, newTarget('plank', 120, 'day', NOW), NOW);
    expect(day).toEqual({ done: 60, amount: 120, pct: 50 });
    const year = targetProgress(LOG, newTarget('pushup', 50, 'year', NOW), NOW);
    expect(year.pct).toBe(100);
  });

  it('cleans junk and survives the store round trip', () => {
    const good = newTarget('pushup', 1000, 'year', NOW);
    const cleaned = cleanTargets([
      good,
      good,
      { ...good, id: 'x', ex: 'nope' },
      { ...good, id: 'y', amount: -5 },
      { ...good, id: 'z', period: 'decade' },
    ]);
    expect(cleaned).toEqual([good]);
    expect(sanitizeWorkoutStore({ log: [], targets: [good] }).targets).toEqual([good]);
  });

  it('mirrors progress into a linked goal and is stable when nothing changed', () => {
    const target = { ...newTarget('pushup', 100, 'week', NOW), goalId: 'g1' };
    const goals: Goal[] = [
      { id: 'g1', title: 'Push-ups', level: 'weekly', createdAt: 0, updatedAt: 0 },
    ];
    const synced = syncExerciseGoals(goals, [target], LOG, NOW);
    expect(synced[0].progress).toBe(60);
    expect(syncExerciseGoals(synced, [target], LOG, NOW)).toBe(synced);
    expect(syncExerciseGoals(goals, [], LOG, NOW)).toBe(goals);
  });
});

describe('history and report lists', () => {
  it('buckets the last weeks oldest first', () => {
    const weeks = exerciseHistory(LOG, 'pushup', 'week', 4, NOW);
    expect(weeks).toHaveLength(4);
    expect(weeks[3].value).toBe(60);
    expect(weeks[2].value).toBe(30);
  });

  it('lists trained exercises, most sets first', () => {
    const [from, to] = reportRange('d30', NOW);
    expect(trainedExercises(LOG, from, to).map((r) => r.ex)).toEqual([
      'pushup',
      'bicepsCurl',
      'plank',
    ]);
  });
});
