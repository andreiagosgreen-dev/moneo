import { beforeEach, describe, expect, it } from 'vitest';
import { ICONS, isAllowedIcon } from './icons';
import { loadHabits } from './habits';
import { loadTasks } from './tasks';
import { STORAGE_KEYS } from './storage/storageKeys';

describe('icons', () => {
  beforeEach(() => localStorage.clear());

  it('is a unique curated list of 48', () => {
    expect(ICONS).toHaveLength(48);
    expect(new Set(ICONS).size).toBe(ICONS.length);
  });

  it('allows only listed glyphs', () => {
    expect(isAllowedIcon('📚')).toBe(true);
    expect(isAllowedIcon('<b>')).toBe(false);
    expect(isAllowedIcon(3)).toBe(false);
    expect(isAllowedIcon(undefined)).toBe(false);
  });

  it('loaders drop unknown icons', () => {
    localStorage.setItem(
      STORAGE_KEYS.habits,
      JSON.stringify([
        { id: 'a', name: 'Read', frequency: 'daily', targetPerWeek: 7, icon: '📚' },
        { id: 'b', name: 'Run', frequency: 'daily', targetPerWeek: 7, icon: 'javascript:' },
      ]),
    );
    const habits = loadHabits();
    expect(habits[0].icon).toBe('📚');
    expect('icon' in habits[1]).toBe(false);

    localStorage.setItem(
      STORAGE_KEYS.tasks,
      JSON.stringify([
        {
          id: 't1',
          projectId: 'p',
          title: 'A',
          status: 'pending',
          priority: 'p2',
          createdAt: 1,
          updatedAt: 1,
          icon: '🏠',
        },
        {
          id: 't2',
          projectId: 'p',
          title: 'B',
          status: 'pending',
          priority: 'p2',
          createdAt: 1,
          updatedAt: 1,
          icon: 'x',
        },
      ]),
    );
    const tasks = loadTasks();
    expect(tasks.find((x) => x.id === 't1')?.icon).toBe('🏠');
    expect(tasks.find((x) => x.id === 't2')?.icon).toBeUndefined();
  });
});
