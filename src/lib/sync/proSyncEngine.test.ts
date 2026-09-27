import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../storage/storageKeys';
import { PRO_SYNC_COLLECTIONS } from './proCollections';
import {
  PULL_OVERLAP_MS,
  PUSH_BATCH_SIZE,
  pullSince,
  runProSync,
  type ProSyncLocalIO,
  type PullResult,
  type PushResult,
} from './proSyncEngine';
import { emptyProSyncMeta, loadProSyncMeta, markEdited, saveProSyncMeta } from './proSyncState';
import type { PushRecord, RemoteRecord } from './recordMerge';

const NOW = 1_800_000_000_000;
const USER = 'user-1';

function memoryIO(initial: Record<string, unknown> = {}) {
  const map = new Map<string, unknown>(Object.entries(initial));
  const io: ProSyncLocalIO = {
    read: (k) => map.get(k) ?? null,
    write: (k, v) => {
      map.set(k, v);
      return true;
    },
    remove: (k) => void map.delete(k),
  };
  return { io, map };
}

function row(
  collection: string,
  recordId: string,
  data: unknown,
  updatedAt: number,
  server = updatedAt,
): RemoteRecord {
  return {
    collection,
    recordId,
    data,
    deleted: data === null,
    updatedAt,
    serverUpdatedAt: new Date(server).toISOString(),
  };
}

function fakeRepos(opts: {
  rows?: RemoteRecord[];
  pull?: () => PullResult;
  push?: (batch: PushRecord[]) => PushResult;
}) {
  const pullCalls: Array<string | null> = [];
  const pushCalls: PushRecord[][] = [];
  return {
    pullCalls,
    pushCalls,
    repos: {
      pullRecords: async (_userId: string, since: string | null): Promise<PullResult> => {
        pullCalls.push(since);
        return opts.pull ? opts.pull() : { ok: true, rows: opts.rows ?? [] };
      },
      pushRecords: async (batch: PushRecord[]): Promise<PushResult> => {
        pushCalls.push(batch);
        return opts.push ? opts.push(batch) : { ok: true };
      },
    },
  };
}

function run(
  repos: ReturnType<typeof fakeRepos>['repos'],
  io: ProSyncLocalIO,
  extra: Partial<Parameters<typeof runProSync>[0]> = {},
) {
  return runProSync({
    userId: USER,
    isPro: true,
    syncEnabled: true,
    repos,
    local: io,
    now: () => NOW,
    ...extra,
  });
}

describe('runProSync — gating', () => {
  it.each([
    [{ userId: null }, 'auth'],
    [{ isPro: false }, 'not-pro'],
    [{ syncEnabled: false }, 'consent'],
  ] as const)('refuses %o with %s and touches nothing', async (override, error) => {
    const { repos, pullCalls, pushCalls } = fakeRepos({});
    const { io, map } = memoryIO({ [STORAGE_KEYS.tasks]: [{ id: 't1' }] });
    const res = await run(repos, io, override);
    expect(res).toMatchObject({ ok: false, error });
    expect(pullCalls).toEqual([]);
    expect(pushCalls).toEqual([]);
    expect(map.get(STORAGE_KEYS.tasks)).toEqual([{ id: 't1' }]);
    expect(localStorage.getItem(STORAGE_KEYS.proSync)).toBeNull();
  });

  it('does not sync another account’s device data unless the user adopts it', async () => {
    saveProSyncMeta({ ...emptyProSyncMeta(), userId: 'someone-else' });
    const { repos, pullCalls } = fakeRepos({});
    const { io } = memoryIO({ [STORAGE_KEYS.tasks]: [{ id: 't1' }] });
    expect(await run(repos, io)).toMatchObject({ ok: false, error: 'account-mismatch' });
    expect(pullCalls).toEqual([]);

    const adopted = await run(repos, io, { adoptAccount: true });
    expect(adopted.ok).toBe(true);
    expect(loadProSyncMeta().userId).toBe(USER);
  });
});

describe('runProSync — first sync', () => {
  it('merges both sides, reloads changed stores, then uploads what the account lacks', async () => {
    const { repos, pushCalls } = fakeRepos({
      rows: [row('projects', 'p1', { id: 'p1', name: 'Cloud' }, NOW - 10_000)],
    });
    const { io, map } = memoryIO({ [STORAGE_KEYS.tasks]: [{ id: 't1', title: 'Local' }] });
    const applied: string[][] = [];
    const res = await run(repos, io, { onApplied: (keys) => applied.push(keys) });

    expect(res).toMatchObject({ ok: true, pulled: 1, applied: 1, pushed: 1, at: NOW });
    expect(map.get(STORAGE_KEYS.projects)).toEqual([{ id: 'p1', name: 'Cloud' }]);
    expect(applied).toEqual([[STORAGE_KEYS.projects]]);
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0]).toEqual([
      {
        collection: 'tasks',
        record_id: 't1',
        data: { id: 't1', title: 'Local' },
        deleted: false,
        updated_at: NOW,
      },
    ]);

    const meta = loadProSyncMeta();
    expect(meta.userId).toBe(USER);
    expect(meta.lastSuccessAt).toBe(NOW);
    expect(meta.cursor).toBe(new Date(NOW - 10_000).toISOString());
    expect(meta.collections.tasks.t1.p).toBeUndefined();
    for (const c of PRO_SYNC_COLLECTIONS) expect(meta.collections[c.name]).toBeDefined();
  });

  it('pulls everything on first run, then incrementally with an overlap window', async () => {
    const { repos, pullCalls } = fakeRepos({
      rows: [row('tasks', 't1', { id: 't1' }, NOW - 1000)],
    });
    const { io } = memoryIO();
    await run(repos, io);
    await run(repos, io);
    expect(pullCalls[0]).toBeNull();
    expect(pullCalls[1]).toBe(new Date(NOW - 1000 - PULL_OVERLAP_MS).toISOString());
  });
});

describe('runProSync — failures never lose data', () => {
  it('a failed pull changes nothing locally and uploads nothing', async () => {
    const { repos, pushCalls } = fakeRepos({ pull: () => ({ ok: false }) });
    const { io, map } = memoryIO({ [STORAGE_KEYS.tasks]: [{ id: 't1' }] });
    expect(await run(repos, io)).toMatchObject({ ok: false, error: 'pull' });
    expect(pushCalls).toEqual([]);
    expect(map.get(STORAGE_KEYS.tasks)).toEqual([{ id: 't1' }]);
    expect(localStorage.getItem(STORAGE_KEYS.proSync)).toBeNull();
  });

  it('reports a missing migration distinctly', async () => {
    const { repos } = fakeRepos({ pull: () => ({ ok: false, notMigrated: true }) });
    expect(await run(repos, memoryIO().io)).toMatchObject({ error: 'not-migrated' });
  });

  it('a failed push keeps the change pending and resends it next time', async () => {
    let fail = true;
    const { repos, pushCalls } = fakeRepos({
      push: () => (fail ? { ok: false, code: 'failed' } : { ok: true }),
    });
    const { io } = memoryIO({ [STORAGE_KEYS.tasks]: [{ id: 't1' }] });
    expect(await run(repos, io)).toMatchObject({ ok: false, error: 'push', pushed: 0 });
    expect(loadProSyncMeta().collections.tasks.t1.p).toBe(true);
    expect(loadProSyncMeta().lastSuccessAt).toBeNull();

    fail = false;
    expect(await run(repos, io)).toMatchObject({ ok: true, pushed: 1 });
    expect(pushCalls[1][0]).toMatchObject({
      record_id: 't1',
      updated_at: pushCalls[0][0].updated_at,
    });
    expect(loadProSyncMeta().collections.tasks.t1.p).toBeUndefined();
  });

  it('maps a server-side Pro refusal to not-pro (lapsed subscription)', async () => {
    const { repos } = fakeRepos({ push: () => ({ ok: false, code: 'not-pro' }) });
    const { io, map } = memoryIO({ [STORAGE_KEYS.tasks]: [{ id: 't1' }] });
    expect(await run(repos, io)).toMatchObject({ ok: false, error: 'not-pro' });
    expect(map.get(STORAGE_KEYS.tasks)).toEqual([{ id: 't1' }]);
  });
});

describe('runProSync — ongoing changes', () => {
  it('sends a local deletion as a tombstone stamped with the edit time', async () => {
    const { repos, pushCalls } = fakeRepos({});
    const { io, map } = memoryIO({ [STORAGE_KEYS.tasks]: [{ id: 't1' }, { id: 't2' }] });
    await run(repos, io);
    map.set(STORAGE_KEYS.tasks, [{ id: 't2' }]);
    markEdited(STORAGE_KEYS.tasks, NOW - 5);
    await run(repos, io, { now: () => NOW + 1000 });
    expect(pushCalls[1]).toEqual([
      { collection: 'tasks', record_id: 't1', data: null, deleted: true, updated_at: NOW + 1 },
    ]);
  });

  it('applies a remote tombstone locally', async () => {
    const first = fakeRepos({ rows: [row('tasks', 't1', { id: 't1' }, NOW - 100)] });
    const { io, map } = memoryIO();
    await run(first.repos, io);
    expect(map.get(STORAGE_KEYS.tasks)).toEqual([{ id: 't1' }]);

    const second = fakeRepos({ rows: [row('tasks', 't1', null, NOW + 100)] });
    const res = await run(second.repos, io, { now: () => NOW + 200 });
    expect(res).toMatchObject({ ok: true, applied: 1, changedKeys: [STORAGE_KEYS.tasks] });
    expect(map.get(STORAGE_KEYS.tasks)).toEqual([]);
  });

  it('uploads in batches', async () => {
    const tasks = Array.from({ length: PUSH_BATCH_SIZE * 2 + 50 }, (_, i) => ({ id: `t${i}` }));
    const { repos, pushCalls } = fakeRepos({});
    const res = await run(repos, memoryIO({ [STORAGE_KEYS.tasks]: tasks }).io);
    expect(res.pushed).toBe(tasks.length);
    expect(pushCalls.map((b) => b.length)).toEqual([PUSH_BATCH_SIZE, PUSH_BATCH_SIZE, 50]);
  });
});

describe('pullSince', () => {
  it('asks for a full pull until every collection has synced once', () => {
    const meta = { ...emptyProSyncMeta(), cursor: new Date(NOW).toISOString() };
    expect(pullSince(meta)).toBeNull();
    for (const c of PRO_SYNC_COLLECTIONS) meta.collections[c.name] = {};
    expect(pullSince(meta)).toBe(new Date(NOW - PULL_OVERLAP_MS).toISOString());
    expect(pullSince({ ...meta, cursor: null })).toBeNull();
  });
});
