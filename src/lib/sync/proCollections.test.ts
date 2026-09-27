import { describe, expect, it } from 'vitest';
import { PRO_SYNC_COLLECTION_NAMES } from '../../../cloudflare/workers/proSync';
import { STORAGE_KEYS } from '../storage/storageKeys';
import {
  MAX_RECORD_ID_LENGTH,
  PRO_SYNC_COLLECTIONS,
  PRO_SYNC_KEYS,
  joinRecords,
  splitRecords,
} from './proCollections';

describe('PRO_SYNC_COLLECTIONS registry', () => {
  it('matches the Worker allowlist exactly', () => {
    expect(new Set(PRO_SYNC_COLLECTIONS.map((c) => c.name))).toEqual(PRO_SYNC_COLLECTION_NAMES);
  });

  it('uses unique, database-safe names and unique storage keys', () => {
    const names = PRO_SYNC_COLLECTIONS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
    expect(new Set(PRO_SYNC_KEYS).size).toBe(PRO_SYNC_KEYS.length);
  });

  it('covers the planning stores and leaves device-only / Gate 9 data out', () => {
    for (const key of [
      STORAGE_KEYS.projects,
      STORAGE_KEYS.tasks,
      STORAGE_KEYS.goals,
      STORAGE_KEYS.habits,
      STORAGE_KEYS.habitLog,
      STORAGE_KEYS.journal,
      STORAGE_KEYS.lifeMap,
      STORAGE_KEYS.roadmaps,
      STORAGE_KEYS.waterfall,
    ]) {
      expect(PRO_SYNC_KEYS).toContain(key);
    }
    for (const key of [
      STORAGE_KEYS.history,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.syncState,
      STORAGE_KEYS.proSync,
      STORAGE_KEYS.proSyncEdits,
      STORAGE_KEYS.aiByok,
      STORAGE_KEYS.locale,
    ]) {
      expect(PRO_SYNC_KEYS).not.toContain(key);
    }
  });
});

describe('splitRecords', () => {
  it('list: one record per item id, skipping malformed and duplicate items', () => {
    const recs = splitRecords({ kind: 'list', idField: 'id' }, [
      { id: 'a', v: 1 },
      { id: 'a', v: 2 },
      { v: 'no id' },
      'junk',
      { id: 'x'.repeat(MAX_RECORD_ID_LENGTH + 1) },
      { id: 'b', v: 3 },
    ]);
    expect([...recs.entries()]).toEqual([
      ['a', { id: 'a', v: 1 }],
      ['b', { id: 'b', v: 3 }],
    ]);
  });

  it('list with a custom id field (daily plans by dateKey)', () => {
    const recs = splitRecords({ kind: 'list', idField: 'dateKey' }, [{ dateKey: '2026-09-27' }]);
    expect([...recs.keys()]).toEqual(['2026-09-27']);
  });

  it('map, set and value shapes', () => {
    expect([...splitRecords({ kind: 'map' }, { d1: { a: 1 }, d2: null }).keys()]).toEqual(['d1']);
    expect([...splitRecords({ kind: 'set' }, ['2026-01-01', 5, '']).keys()]).toEqual([
      '2026-01-01',
    ]);
    expect([...splitRecords({ kind: 'value' }, { wip: 3 }).entries()]).toEqual([
      ['value', { wip: 3 }],
    ]);
    expect(splitRecords({ kind: 'value' }, null).size).toBe(0);
  });

  it('never throws on the wrong type', () => {
    expect(splitRecords({ kind: 'list', idField: 'id' }, { not: 'a list' }).size).toBe(0);
    expect(splitRecords({ kind: 'map' }, ['x']).size).toBe(0);
    expect(splitRecords({ kind: 'set' }, 'x').size).toBe(0);
  });
});

describe('joinRecords', () => {
  it('list: keeps local order and unknown items, replaces, removes, appends', () => {
    const next = joinRecords(
      { kind: 'list', idField: 'id' },
      [{ id: 'a', v: 1 }, { legacy: true }, { id: 'b', v: 1 }, { id: 'c', v: 1 }],
      {
        upserts: new Map<string, unknown>([
          ['b', { id: 'b', v: 2 }],
          ['z', { id: 'z', v: 1 }],
        ]),
        deletes: new Set(['c']),
      },
    );
    expect(next).toEqual([
      { id: 'a', v: 1 },
      { legacy: true },
      { id: 'b', v: 2 },
      { id: 'z', v: 1 },
    ]);
  });

  it('map and set', () => {
    expect(
      joinRecords(
        { kind: 'map' },
        { a: 1, b: 2 },
        {
          upserts: new Map([['c', 3]]),
          deletes: new Set(['a']),
        },
      ),
    ).toEqual({ b: 2, c: 3 });
    expect(
      joinRecords({ kind: 'set' }, ['x', 'y'], {
        upserts: new Map([
          ['z', true],
          ['x', true],
        ]),
        deletes: new Set(['y']),
      }),
    ).toEqual(['x', 'z']);
  });

  it('value: replace, remove the key, or keep', () => {
    const shape = { kind: 'value' } as const;
    expect(
      joinRecords(shape, { a: 1 }, { upserts: new Map([['value', { a: 2 }]]), deletes: new Set() }),
    ).toEqual({ a: 2 });
    expect(
      joinRecords(shape, { a: 1 }, { upserts: new Map(), deletes: new Set(['value']) }),
    ).toBeUndefined();
    expect(joinRecords(shape, { a: 1 }, { upserts: new Map(), deletes: new Set() })).toEqual({
      a: 1,
    });
  });

  it('round-trips: split then join with no changes is identity', () => {
    for (const c of PRO_SYNC_COLLECTIONS) {
      const sample =
        c.shape.kind === 'list'
          ? [{ [c.shape.idField]: 'r1', n: 1 }]
          : c.shape.kind === 'map'
            ? { r1: { n: 1 } }
            : c.shape.kind === 'set'
              ? ['r1']
              : { n: 1 };
      splitRecords(c.shape, sample);
      expect(joinRecords(c.shape, sample, { upserts: new Map(), deletes: new Set() })).toEqual(
        sample,
      );
    }
  });
});
