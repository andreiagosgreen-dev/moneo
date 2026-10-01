import { beforeEach, describe, expect, it } from 'vitest';
import { loadBoot } from './boot';
import { saveSnapshot } from '../lib/store';

describe('loadBoot', () => {
  beforeEach(() => localStorage.clear());

  it('starts a fresh browser on an idle 25-minute focus round', () => {
    const boot = loadBoot();
    expect(boot.mode).toBe('focus');
    expect(boot.total).toBe(25 * 60);
    expect(boot.remaining).toBe(25 * 60);
    expect(boot.endsAt).toBeNull();
    expect(boot.tasks).toEqual([]);
    expect(boot.history).toEqual([]);
  });

  it('resumes a round that was running when the app closed, with its metadata', () => {
    const endsAt = Date.now() + 10 * 60_000;
    saveSnapshot({
      mode: 'focus',
      total: 45 * 60,
      remaining: 45 * 60,
      cycle: 1,
      endsAt,
      round: { min: 45, intention: 'Draft', areaId: null, projectId: 'p1', taskId: 't1' },
    });
    const boot = loadBoot();
    expect(boot.endsAt).toBe(endsAt);
    expect(boot.remaining).toBeGreaterThan(9 * 60);
    expect(boot.remaining).toBeLessThanOrEqual(10 * 60);
    expect(boot.roundMin).toBe(45);
    expect(boot.roundIntention).toBe('Draft');
    expect(boot.roundTaskId).toBe('t1');
  });

  it('keeps a paused position as saved', () => {
    saveSnapshot({ mode: 'short', total: 300, remaining: 120, cycle: 2 });
    const boot = loadBoot();
    expect(boot.mode).toBe('short');
    expect(boot.remaining).toBe(120);
    expect(boot.endsAt).toBeNull();
    expect(boot.cycle).toBe(2);
  });
});
