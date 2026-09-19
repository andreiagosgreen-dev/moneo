import { describe, expect, it } from 'vitest';

import {
  FREE_OKRS_LIMIT,
  MAX_KRS_PER_OBJECTIVE,
  addKeyResult,
  childrenOf,
  createObjectiveObject,
  currentPeriod,
  deleteObjective,
  krProgress,
  loadObjectives,
  objectiveProgress,
  okrPeriods,
  okrReview,
  overallOkrProgress,
  removeKeyResult,
  rootObjectives,
  saveObjectives,
  updateKeyResult,
  updateObjective,
  type Objective,
} from './okrs';

function makeObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: overrides.id ?? 'o1',
    title: overrides.title ?? 'Objective',
    period: overrides.period ?? '2026-Q3',
    keyResults: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('objectives', () => {
  it('exposes the Free tier limit (3 objectives)', () => {
    expect(FREE_OKRS_LIMIT).toBe(3);
  });

  it('labels the current quarter', () => {
    expect(currentPeriod(new Date(2026, 8, 16).getTime())).toBe('2026-Q3');
    expect(currentPeriod(new Date(2026, 0, 5).getTime())).toBe('2026-Q1');
  });

  it('creates objectives with cascade links and loads empty', () => {
    expect(loadObjectives()).toEqual([]);
    const parent = makeObjective({ id: 'p' });
    expect(createObjectiveObject([parent], '  Team KR push  ', '2026-Q4', 'p')!.parentId).toBe('p');
    expect(createObjectiveObject([parent], 'Bad', '2026-Q4', 'ghost')).toBeNull();
    expect(createObjectiveObject([], '   ')).toBeNull();
  });

  it('cascades deletes upward and rejects cycles', () => {
    const objectives = [makeObjective({ id: 'co' }), makeObjective({ id: 'tm', parentId: 'co' })];
    const next = deleteObjective(objectives, 'co');
    expect(next.map((o) => o.id)).toEqual(['tm']);
    expect(next[0].parentId).toBeUndefined();
    const cycled = updateObjective(objectives, 'co', { parentId: 'tm' });
    expect(cycled.find((o) => o.id === 'co')!.parentId).toBeUndefined();
  });

  it('lists roots per period and distinct periods', () => {
    const objectives = [
      makeObjective({ id: 'a', period: '2026-Q3' }),
      makeObjective({ id: 'b', period: '2026-Q4', parentId: 'a' }),
      makeObjective({ id: 'c', period: '2026-Q4' }),
    ];
    expect(rootObjectives(objectives).map((o) => o.id)).toEqual(['a', 'c']);
    expect(rootObjectives(objectives, '2026-Q4').map((o) => o.id)).toEqual(['c']);
    expect(childrenOf(objectives, 'a').map((o) => o.id)).toEqual(['b']);
    expect(okrPeriods(objectives)).toEqual(['2026-Q3', '2026-Q4']);
  });

  it('persists round-trip', () => {
    const created = createObjectiveObject([], 'Grow revenue', '2026-Q3')!;
    expect(saveObjectives([created])).toBe(true);
    expect(loadObjectives()).toHaveLength(1);
  });
});

describe('key results', () => {
  it('adds, edits and removes KRs with caps', () => {
    let objectives = [makeObjective()];
    objectives = addKeyResult(objectives, 'o1', 'MRR $10k', 10000, '$');
    expect(objectives[0].keyResults).toHaveLength(1);
    expect(objectives[0].keyResults[0].current).toBe(0);
    expect(addKeyResult(objectives, 'o1', '', 5)).toBe(objectives);
    expect(addKeyResult(objectives, 'o1', 'Bad', -3)).toBe(objectives);
    objectives = updateKeyResult(objectives, 'o1', objectives[0].keyResults[0].id, {
      current: 2500,
    });
    expect(krProgress(objectives[0].keyResults[0])).toBe(0.25);
    objectives = removeKeyResult(objectives, 'o1', objectives[0].keyResults[0].id);
    expect(objectives[0].keyResults).toHaveLength(0);
    // cap respected
    for (let i = 0; i < MAX_KRS_PER_OBJECTIVE + 2; i++) {
      objectives = addKeyResult(objectives, 'o1', `KR ${i}`, 100);
    }
    expect(objectives[0].keyResults).toHaveLength(MAX_KRS_PER_OBJECTIVE);
  });

  it('caps over-achievement at 100%', () => {
    expect(krProgress({ id: 'k', title: 'K', target: 100, current: 150, unit: '' })).toBe(1);
    expect(krProgress({ id: 'k', title: 'K', target: 0, current: 5, unit: '' })).toBe(0);
  });
});

describe('progress rollup', () => {
  it('averages KRs at leaves and children at parents', () => {
    const objectives = [
      makeObjective({
        id: 'co',
        keyResults: [{ id: 'ignored', title: 'X', target: 100, current: 100, unit: '' }],
      }),
      makeObjective({
        id: 'tm',
        parentId: 'co',
        keyResults: [
          { id: 'k1', title: 'A', target: 100, current: 50, unit: '' },
          { id: 'k2', title: 'B', target: 100, current: 100, unit: '' },
        ],
      }),
    ];
    // parent with children ignores its own KRs
    expect(objectiveProgress(objectives, 'co')).toBe(75);
    expect(objectiveProgress(objectives, 'tm')).toBe(75);
    expect(objectiveProgress(objectives, 'ghost')).toBe(0);
    expect(overallOkrProgress(objectives)).toBe(75);
  });

  it('generates a quarterly review text', () => {
    const objectives = [
      makeObjective({
        id: 'co',
        keyResults: [{ id: 'k', title: 'MRR', target: 100, current: 100, unit: '$' }],
      }),
    ];
    const review = okrReview(objectives, '2026-Q3');
    expect(review).toContain('2026-Q3');
    expect(review).toContain('100%');
    expect(review).toContain('Best KR: MRR');
    expect(okrReview([], '2026-Q3')).toContain('no objectives');
  });
});
