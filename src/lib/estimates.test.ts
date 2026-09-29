import { describe, expect, it } from 'vitest';
import { estimateAccuracy, estimateVsActual, verdictFor } from './estimates';
import type { Session } from './store';
import type { Task } from './tasks';

const task = (id: string, estimateMin?: number, done = true): Task => ({
  id,
  projectId: 'p',
  title: id,
  status: done ? 'completed' : 'pending',
  priority: 'p2',
  createdAt: 0,
  updatedAt: 0,
  ...(estimateMin ? { estimateMin } : {}),
});
const s = (taskId: string, min: number): Session => ({ at: 1, min, taskId });

describe('estimates', () => {
  it('verdict bands at 80% / 120%', () => {
    expect(verdictFor(0.79)).toBe('under');
    expect(verdictFor(0.8)).toBe('on');
    expect(verdictFor(1.2)).toBe('on');
    expect(verdictFor(1.21)).toBe('over');
  });

  it('estimateVsActual', () => {
    expect(estimateVsActual(undefined, 30)).toBeNull();
    expect(estimateVsActual(50, 0)).toBeNull();
    expect(estimateVsActual(50, 35)).toEqual({
      estimateMin: 50,
      actualMin: 35,
      ratio: 0.7,
      verdict: 'under',
    });
    expect(estimateVsActual(50, 65)?.verdict).toBe('over');
    expect(estimateVsActual(50, 50)?.verdict).toBe('on');
  });

  it('estimateAccuracy needs three finished tracked tasks', () => {
    const history = [s('a', 25), s('b', 50), s('c', 20), s('d', 30)];
    expect(estimateAccuracy([task('a', 25), task('b', 25)], history)).toBeNull();
    const acc = estimateAccuracy(
      [task('a', 25), task('b', 25), task('c', 20), task('d', 30, false), task('e', 30)],
      history,
    );
    expect(acc).toEqual({ total: 3, onTarget: 2, pct: 67 });
  });
});
