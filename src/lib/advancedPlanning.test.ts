import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasAgileData,
  loadAdvancedPlanning,
  saveAdvancedPlanning,
} from './advancedPlanning';
import { STORAGE_KEYS } from './storage/storageKeys';
import type { Sprint } from './sprints';
import type { WaterfallPhase } from './waterfall';

function setRaw(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

beforeEach(() => {
  localStorage.clear();
});

describe('advancedPlanning toggle', () => {
  it('stays off for brand-new users', () => {
    expect(hasAgileData()).toBe(false);
    expect(loadAdvancedPlanning()).toBe(false);
  });

  it('stays on for users who already have sprints or phases', () => {
    const sprint: Sprint = {
      id: 's1',
      projectId: 'p1',
      name: 'Sprint 1',
      startAt: 1,
      endAt: 2,
      taskIds: [],
      status: 'planned',
      createdAt: 1,
      updatedAt: 1,
    };
    setRaw(STORAGE_KEYS.sprints, [sprint]);
    expect(loadAdvancedPlanning()).toBe(true);

    localStorage.clear();
    const phase: WaterfallPhase = {
      id: 'w1',
      projectId: 'p1',
      name: 'Build',
      order: 0,
      status: 'todo',
      createdAt: 1,
      updatedAt: 1,
    };
    setRaw(STORAGE_KEYS.waterfall, [phase]);
    expect(loadAdvancedPlanning()).toBe(true);
  });

  it('an explicit choice always wins and round-trips', () => {
    expect(saveAdvancedPlanning(true)).toBe(true);
    expect(loadAdvancedPlanning()).toBe(true);
    expect(saveAdvancedPlanning(false)).toBe(true);
    expect(loadAdvancedPlanning()).toBe(false);
  });

  it('ignores a corrupt stored value and falls back to data', () => {
    setRaw(STORAGE_KEYS.advancedPlanning, 'yes-please');
    expect(loadAdvancedPlanning()).toBe(false);
  });
});
