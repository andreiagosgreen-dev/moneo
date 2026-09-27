import { describe, expect, it } from 'vitest';
import { FREE_ROADMAPS_LIMIT, canAddRoadmap } from './roadmapLimits';

describe('roadmapLimits', () => {
  it('allows one Free roadmap and unlimited Pro', () => {
    expect(FREE_ROADMAPS_LIMIT).toBe(1);
    expect(canAddRoadmap(false, 0)).toBe(true);
    expect(canAddRoadmap(false, 1)).toBe(false);
    expect(canAddRoadmap(true, 99)).toBe(true);
  });
});
