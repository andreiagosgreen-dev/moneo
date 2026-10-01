import { describe, expect, it } from 'vitest';
import { DEFAULT_IN_PROGRESS_WIP, canPullInto, effectiveWipLimits } from './kanbanWip';

describe('kanbanWip', () => {
  it('gives free users the default In progress limit only', () => {
    expect(effectiveWipLimits({ pending: 2, in_progress: 9 }, false)).toEqual({
      in_progress: DEFAULT_IN_PROGRESS_WIP,
    });
  });

  it('keeps Pro limits and fills in the default for In progress', () => {
    expect(effectiveWipLimits({ blocked: 2 }, true)).toEqual({ blocked: 2, in_progress: 3 });
    expect(effectiveWipLimits({ in_progress: 5 }, true)).toEqual({ in_progress: 5 });
  });

  it('never limits Completed', () => {
    expect(effectiveWipLimits({ completed: 1 }, true).completed).toBeUndefined();
    expect(canPullInto('completed', 100, { completed: 1 })).toBe(true);
  });

  it('blocks a pull into a full column', () => {
    const limits = { in_progress: 3 };
    expect(canPullInto('in_progress', 2, limits)).toBe(true);
    expect(canPullInto('in_progress', 3, limits)).toBe(false);
    expect(canPullInto('pending', 50, limits)).toBe(true);
  });
});
