import { describe, expect, it } from 'vitest';
import {
  hashValue,
  planCollection,
  stableStringify,
  type CollectionMeta,
  type RemoteRecord,
} from './recordMerge';

const NOW = 1_800_000_000_000;

function remote(recordId: string, data: unknown, updatedAt: number, deleted = false): RemoteRecord {
  return {
    collection: 'tasks',
    recordId,
    data: deleted ? null : data,
    deleted,
    updatedAt,
    serverUpdatedAt: new Date(updatedAt).toISOString(),
  };
}

function agreed(entries: Record<string, { data: unknown; t: number }>): CollectionMeta {
  const meta: CollectionMeta = {};
  for (const [id, { data, t }] of Object.entries(entries)) meta[id] = { h: hashValue(data), t };
  return meta;
}

function plan(opts: {
  local: Record<string, unknown>;
  meta?: CollectionMeta;
  remote?: RemoteRecord[];
  editedAt?: number;
}) {
  return planCollection({
    collection: 'tasks',
    local: new Map(Object.entries(opts.local)),
    meta: opts.meta,
    remote: opts.remote ?? [],
    editedAt: opts.editedAt,
    now: NOW,
  });
}

describe('stableStringify / hashValue', () => {
  it('ignores key order and undefined fields', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(
      stableStringify({ a: [1, { c: 3, d: 2 }], b: 1, z: undefined }),
    );
    expect(hashValue({ a: 1, b: 2 })).toBe(hashValue({ b: 2, a: 1 }));
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
    expect(hashValue(null)).not.toBe('');
  });
});

describe('planCollection — first sync on a device', () => {
  it('unions both sides and lets the account copy win on overlap', () => {
    const p = plan({
      local: { a: { title: 'local A' }, only: { title: 'mine' } },
      meta: undefined,
      remote: [
        remote('a', { title: 'cloud A' }, NOW - 5000),
        remote('b', { title: 'cloud B' }, NOW - 5000),
      ],
      editedAt: NOW - 1000,
    });
    expect([...p.upserts.entries()]).toEqual([
      ['a', { title: 'cloud A' }],
      ['b', { title: 'cloud B' }],
    ]);
    expect(p.deletes.size).toBe(0);
    expect(p.push).toEqual([
      {
        collection: 'tasks',
        record_id: 'only',
        data: { title: 'mine' },
        deleted: false,
        updated_at: NOW - 1000,
      },
    ]);
    expect(p.meta.only).toMatchObject({ p: true, t: NOW - 1000 });
    expect(p.meta.a).toEqual({ h: hashValue({ title: 'cloud A' }), t: NOW - 5000 });
    expect(p.conflicts).toBe(0);
  });

  it('never turns records missing from the device into deletions', () => {
    const p = plan({ local: {}, meta: undefined, remote: [remote('a', { x: 1 }, 10)] });
    expect(p.push).toEqual([]);
    expect(p.upserts.get('a')).toEqual({ x: 1 });
  });

  it('uploads everything when the account is empty (initial upload, no duplicates)', () => {
    const p = plan({ local: { a: 1, b: 2 }, meta: undefined, editedAt: NOW - 50 });
    expect(p.push.map((r) => r.record_id)).toEqual(['a', 'b']);
    expect(p.upserts.size).toBe(0);
  });
});

describe('planCollection — incremental', () => {
  it('pushes nothing when nothing changed', () => {
    const p = plan({ local: { a: { v: 1 } }, meta: agreed({ a: { data: { v: 1 }, t: 100 } }) });
    expect(p.push).toEqual([]);
    expect(p.upserts.size).toBe(0);
    expect(p.meta.a.p).toBeUndefined();
  });

  it('stamps a local edit with the edit time, after the agreed version', () => {
    const p = plan({
      local: { a: { v: 2 } },
      meta: agreed({ a: { data: { v: 1 }, t: 100 } }),
      editedAt: NOW - 10,
    });
    expect(p.push).toEqual([
      { collection: 'tasks', record_id: 'a', data: { v: 2 }, deleted: false, updated_at: NOW - 10 },
    ]);
  });

  it('never stamps in the future and always moves past the agreed time', () => {
    const future = plan({
      local: { a: 2 },
      meta: agreed({ a: { data: 1, t: 100 } }),
      editedAt: NOW + 60_000,
    });
    expect(future.push[0].updated_at).toBe(NOW);
    const stale = plan({
      local: { a: 2 },
      meta: agreed({ a: { data: 1, t: NOW - 5 } }),
      editedAt: NOW - 1000,
    });
    expect(stale.push[0].updated_at).toBe(NOW - 4);
  });

  it('turns a local removal into a tombstone', () => {
    const p = plan({ local: {}, meta: agreed({ a: { data: 1, t: 100 } }), editedAt: NOW - 1 });
    expect(p.push).toEqual([
      { collection: 'tasks', record_id: 'a', data: null, deleted: true, updated_at: NOW - 1 },
    ]);
    expect(p.meta.a).toMatchObject({ d: true, h: '', p: true });
  });

  it('applies a newer remote edit and a remote tombstone locally', () => {
    const p = plan({
      local: { a: { v: 1 }, b: { v: 1 } },
      meta: agreed({ a: { data: { v: 1 }, t: 100 }, b: { data: { v: 1 }, t: 100 } }),
      remote: [remote('a', { v: 9 }, 200), remote('b', null, 200, true)],
    });
    expect(p.upserts.get('a')).toEqual({ v: 9 });
    expect([...p.deletes]).toEqual(['b']);
    expect(p.push).toEqual([]);
    expect(p.meta.b).toEqual({ h: '', t: 200, d: true });
  });

  it('last write wins: a newer local edit beats an older remote edit', () => {
    const p = plan({
      local: { a: { v: 'local' } },
      meta: agreed({ a: { data: { v: 0 }, t: 100 } }),
      remote: [remote('a', { v: 'remote' }, 150)],
      editedAt: 300,
    });
    expect(p.upserts.size).toBe(0);
    expect(p.push[0]).toMatchObject({ record_id: 'a', data: { v: 'local' }, updated_at: 300 });
    expect(p.conflicts).toBe(0);
  });

  it('last write wins: a newer remote edit beats an older local edit (counted as a conflict)', () => {
    const p = plan({
      local: { a: { v: 'local' } },
      meta: agreed({ a: { data: { v: 0 }, t: 100 } }),
      remote: [remote('a', { v: 'remote' }, 500)],
      editedAt: 300,
    });
    expect(p.upserts.get('a')).toEqual({ v: 'remote' });
    expect(p.push).toEqual([]);
    expect(p.conflicts).toBe(1);
  });

  it('a newer remote edit beats a local deletion (the record comes back)', () => {
    const p = plan({
      local: {},
      meta: agreed({ a: { data: 1, t: 100 } }),
      remote: [remote('a', 2, 500)],
      editedAt: 300,
    });
    expect(p.upserts.get('a')).toBe(2);
    expect(p.push).toEqual([]);
  });

  it('resolves a timestamp tie with different content to the account copy', () => {
    const p = plan({
      local: { a: 'local' },
      meta: { a: { h: hashValue('local'), t: 300, p: true } },
      remote: [remote('a', 'remote', 300)],
    });
    expect(p.upserts.get('a')).toBe('remote');
    expect(p.push).toEqual([]);
  });

  it('treats its own echoed version as agreed (no re-apply, no re-push)', () => {
    const p = plan({
      local: { a: 'x' },
      meta: { a: { h: hashValue('x'), t: 300 } },
      remote: [remote('a', 'x', 300)],
    });
    expect(p.upserts.size).toBe(0);
    expect(p.push).toEqual([]);
  });

  it('resends a pending version that the account has not accepted yet', () => {
    const p = plan({
      local: { a: 'x' },
      meta: { a: { h: hashValue('x'), t: 300, p: true } },
    });
    expect(p.push).toEqual([
      { collection: 'tasks', record_id: 'a', data: 'x', deleted: false, updated_at: 300 },
    ]);
  });

  it('resends ours when the account holds an older version than we agreed on', () => {
    const p = plan({
      local: { a: 'x' },
      meta: { a: { h: hashValue('x'), t: 300 } },
      remote: [remote('a', 'old', 200)],
    });
    expect(p.upserts.size).toBe(0);
    expect(p.push[0]).toMatchObject({ record_id: 'a', data: 'x', updated_at: 300 });
  });

  it('keeps the newest of duplicate remote rows', () => {
    const p = plan({
      local: {},
      meta: {},
      remote: [remote('a', 'new', 300), remote('a', 'old', 200)],
    });
    expect(p.upserts.get('a')).toBe('new');
  });
});
