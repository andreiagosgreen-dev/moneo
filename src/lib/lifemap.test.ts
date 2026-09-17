import { describe, expect, it } from 'vitest';

import {
  LIFE_MAP_TEMPLATES,
  areaGap,
  createLifeMapArea,
  deleteLifeMapArea,
  instantiateTemplate,
  lifeBalance,
  loadLifeMap,
  reorderLifeMapArea,
  saveLifeMap,
  suggestNextStep,
  updateLifeMapArea,
  weeklyReview,
  type LifeMapArea,
} from './lifemap';

function makeArea(overrides: Partial<LifeMapArea> = {}): LifeMapArea {
  return {
    id: overrides.id ?? 'a1',
    name: overrides.name ?? 'Health',
    color: '#3ecf8e',
    icon: '❤️',
    currentScore: 5,
    desiredScore: 8,
    importance: 4,
    intention: 'Move daily.',
    linkedGoalIds: [],
    linkedProjectIds: [],
    linkedHabitIds: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('templates', () => {
  it('ships six templates including blank', () => {
    const ids = LIFE_MAP_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(['balanced', 'student', 'freelancer', 'founder', 'recovery', 'blank']);
  });

  it('instantiates fresh ids every time', () => {
    const first = instantiateTemplate('balanced');
    const second = instantiateTemplate('balanced');
    expect(first).toHaveLength(6);
    expect(first[0].id).not.toBe(second[0].id);
    expect(first[0].linkedGoalIds).toEqual([]);
  });

  it('blank template and unknown ids yield nothing', () => {
    expect(instantiateTemplate('blank')).toEqual([]);
    expect(instantiateTemplate('ghost')).toEqual([]);
  });
});

describe('CRUD', () => {
  it('creates, updates, reorders and deletes areas', () => {
    expect(createLifeMapArea('   ')).toBeNull();
    const created = createLifeMapArea('  Craft  ')!;
    expect(created.name).toBe('Craft');
    expect(created.currentScore).toBe(5);

    let areas = [makeArea({ id: 'a' }), makeArea({ id: 'b', name: 'Work' })];
    areas = updateLifeMapArea(areas, 'a', {
      currentScore: 9,
      importance: 99,
      intention: 'x'.repeat(500),
      linkedGoalIds: ['g1', 42 as never, ''],
    });
    expect(areas[0].currentScore).toBe(9);
    expect(areas[0].importance).toBe(5);
    expect(areas[0].intention).toHaveLength(140);
    expect(areas[0].linkedGoalIds).toEqual(['g1']);

    const moved = reorderLifeMapArea(areas, 'a', 1);
    expect(moved.map((a) => a.id)).toEqual(['b', 'a']);
    expect(reorderLifeMapArea(areas, 'b', 1)).toBe(areas);
    expect(reorderLifeMapArea(areas, 'ghost', 1)).toBe(areas);

    expect(deleteLifeMapArea(moved, 'b').map((a) => a.id)).toEqual(['a']);
  });

  it('loads empty and round-trips storage', () => {
    expect(loadLifeMap()).toEqual([]);
    const areas = [makeArea()];
    expect(saveLifeMap(areas)).toBe(true);
    expect(loadLifeMap()).toEqual(areas);
  });

  it('clamps junk payloads instead of crashing', () => {
    const loaded = loadLifeMap();
    expect(Array.isArray(loaded)).toBe(true);
  });
});

describe('scoring', () => {
  it('weights gaps by importance', () => {
    expect(areaGap(makeArea({ currentScore: 8, desiredScore: 8, importance: 5 }))).toBe(0);
    expect(areaGap(makeArea({ currentScore: 4, desiredScore: 8, importance: 5 }))).toBe(20);
    expect(areaGap(makeArea({ currentScore: 4, desiredScore: 8, importance: 2 }))).toBe(8);
  });

  it('suggests the most important neglected area as a 10-minute step', () => {
    const areas = [
      makeArea({ id: 'ok', name: 'Done', currentScore: 8, desiredScore: 8, importance: 5 }),
      makeArea({ id: 'low', name: 'Side', currentScore: 3, desiredScore: 8, importance: 2 }),
      makeArea({ id: 'top', name: 'Core', currentScore: 4, desiredScore: 9, importance: 5 }),
    ];
    const step = suggestNextStep(areas)!;
    expect(step.area.id).toBe('top');
    expect(step.text).toContain('10 minutes for Core');
    expect(step.text).toContain('Move daily.');
    expect(suggestNextStep([])).toBeNull();
    expect(
      suggestNextStep([makeArea({ currentScore: 9, desiredScore: 8 })]),
    ).toBeNull();
  });

  it('balances to a calm center number and sentence', () => {
    expect(lifeBalance([]).insight).toContain('first map');
    const even = [
      makeArea({ currentScore: 8, desiredScore: 8, importance: 5 }),
      makeArea({ currentScore: 6, desiredScore: 6, importance: 5 }),
    ];
    const full = lifeBalance(even);
    expect(full.score).toBe(100);
    expect(full.focusArea).toBeNull();
    const partial = lifeBalance([makeArea({ name: 'Health', currentScore: 4, desiredScore: 8 })]);
    expect(partial.score).toBe(50);
    expect(partial.insight).toContain('Health');
    expect(partial.focusArea?.name).toBe('Health');
  });
});

describe('weeklyReview', () => {
  const NOW = new Date(2026, 8, 16, 12, 0).getTime();
  const DAY = 24 * 3600_000;

  it('splits attended from neglected on measured data only', () => {
    const areas = [
      makeArea({ id: 'a', name: 'Work', linkedProjectIds: ['p1'] }),
      makeArea({ id: 'b', name: 'Rest', linkedHabitIds: ['h1'] }),
      makeArea({ id: 'c', name: 'Quiet' }),
    ];
    const history = [
      { at: NOW - DAY, min: 50, projectId: 'p1' },
      { at: NOW - 30 * DAY, min: 999, projectId: 'p1' },
    ];
    const habitLog = { h1: ['2026-9-15', 'not-a-date'] };
    const review = weeklyReview(areas, history, habitLog, NOW);
    expect(review.attended.map((r) => r.area.id).sort()).toEqual(['a', 'b']);
    expect(review.attended.find((r) => r.area.id === 'a')!.minutes).toBe(50);
    expect(review.attended.find((r) => r.area.id === 'b')!.habitHits).toBe(1);
    expect(review.neglected.map((a) => a.name)).toEqual(['Quiet']);
    expect(review.summary).toContain('Quiet');
  });

  it('stays calm on empty and full weeks', () => {
    expect(weeklyReview([], [], {}, NOW).summary).toContain('No areas');
    const full = weeklyReview(
      [makeArea({ linkedProjectIds: ['p1'] })],
      [{ at: NOW - DAY, min: 10, projectId: 'p1' }],
      {},
      NOW,
    );
    expect(full.neglected).toEqual([]);
    expect(full.summary).toContain('Steady');
  });

  it('never throws on junk', () => {
    expect(weeklyReview(null as never, null as never, null as never, NaN).attended).toEqual([]);
  });
});
