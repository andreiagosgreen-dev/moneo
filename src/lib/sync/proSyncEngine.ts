import { PRO_SYNC_COLLECTIONS, joinRecords, splitRecords } from './proCollections';
import { planCollection, type PushRecord, type RemoteRecord } from './recordMerge';
import {
  emptyProSyncMeta,
  loadEditTimes,
  loadProSyncMeta,
  saveProSyncMeta,
  type ProSyncMeta,
} from './proSyncState';

/**
 * Pro full-data sync engine: projects, tasks, goals, habits, journal, life
 * map and the rest of the planning stores (see proCollections.ts).
 *
 * Same principles as the Gate 9 engine: local first, explicit consent (it
 * only runs once the user turned sync on), failures never touch local data,
 * never throws. Order: pull → plan → apply locally → push. Remote changes are
 * written locally before anything is uploaded, so a failed push leaves the
 * device with merged data and the next run resends what is still pending.
 *
 * When Pro lapses the engine simply stops being called (and the Worker
 * refuses writes): local data stays, the account keeps its last copy.
 */

export type ProSyncError =
  | 'auth'
  | 'not-pro'
  | 'consent'
  | 'account-mismatch'
  | 'not-migrated'
  | 'pull'
  | 'apply'
  | 'push';

export type PullResult = { ok: true; rows: RemoteRecord[] } | { ok: false; notMigrated?: boolean };
export type PushResult = { ok: true } | { ok: false; code: 'not-pro' | 'not-migrated' | 'failed' };

export interface ProSyncRepos {
  /** All rows with server_updated_at > since (null = everything). */
  pullRecords(userId: string, since: string | null): Promise<PullResult>;
  pushRecords(records: PushRecord[]): Promise<PushResult>;
}

export interface ProSyncLocalIO {
  read(key: string): unknown;
  write(key: string, value: unknown): boolean;
  remove(key: string): void;
}

export interface ProSyncOutcome {
  ok: boolean;
  error?: ProSyncError;
  /** Records pulled from the account this run. */
  pulled: number;
  /** Local records created/updated/removed from account versions. */
  applied: number;
  /** Local records uploaded. */
  pushed: number;
  conflicts: number;
  /** Storage keys rewritten locally — in-memory state must reload them. */
  changedKeys: string[];
  at?: number;
}

export const PUSH_BATCH_SIZE = 200;
/**
 * Pull overlap: re-read a window before the cursor so a write that committed
 * late with an earlier server timestamp is never skipped. Re-reading is a
 * no-op (same version).
 */
export const PULL_OVERLAP_MS = 10 * 60_000;

let applyingRemote = false;
/** True while the engine writes account versions locally (not user edits). */
export function isApplyingRemote(): boolean {
  return applyingRemote;
}

function outcome(partial: Partial<ProSyncOutcome>): ProSyncOutcome {
  return { ok: false, pulled: 0, applied: 0, pushed: 0, conflicts: 0, changedKeys: [], ...partial };
}

export function pullSince(meta: ProSyncMeta): string | null {
  if (!meta.cursor) return null;
  if (PRO_SYNC_COLLECTIONS.some((c) => meta.collections[c.name] === undefined)) return null;
  const t = Date.parse(meta.cursor);
  return Number.isFinite(t) ? new Date(t - PULL_OVERLAP_MS).toISOString() : null;
}

export async function runProSync(opts: {
  userId: string | null;
  isPro: boolean;
  /** The user turned account sync on (Gate 9 consent). */
  syncEnabled: boolean;
  /** Explicitly accept syncing this device's data into a different account. */
  adoptAccount?: boolean;
  repos: ProSyncRepos;
  local: ProSyncLocalIO;
  /** Called synchronously right after local writes, before uploading. */
  onApplied?: (changedKeys: string[]) => void;
  now?: () => number;
}): Promise<ProSyncOutcome> {
  const clock = opts.now ?? Date.now;
  if (!opts.userId) return outcome({ error: 'auth' });
  if (!opts.isPro) return outcome({ error: 'not-pro' });
  if (!opts.syncEnabled) return outcome({ error: 'consent' });

  let meta = loadProSyncMeta();
  if (meta.userId && meta.userId !== opts.userId) {
    if (!opts.adoptAccount) return outcome({ error: 'account-mismatch' });
    meta = emptyProSyncMeta();
  }

  // 1. Pull — failure aborts before anything changes.
  let pulled: PullResult;
  try {
    pulled = await opts.repos.pullRecords(opts.userId, pullSince(meta));
  } catch {
    pulled = { ok: false };
  }
  if (!pulled.ok) return outcome({ error: pulled.notMigrated ? 'not-migrated' : 'pull' });
  const rows = pulled.rows;

  const byCollection = new Map<string, RemoteRecord[]>();
  let cursor = meta.cursor;
  for (const r of rows) {
    const bucket = byCollection.get(r.collection);
    if (bucket) bucket.push(r);
    else byCollection.set(r.collection, [r]);
    if (!cursor || Date.parse(r.serverUpdatedAt) > Date.parse(cursor)) cursor = r.serverUpdatedAt;
  }

  // 2. Plan + apply locally (synchronous: no user edit can interleave).
  const now = clock();
  const edits = loadEditTimes();
  const toPush: PushRecord[] = [];
  const changedKeys: string[] = [];
  let applied = 0;
  let conflicts = 0;
  const nextCollections = { ...meta.collections };
  applyingRemote = true;
  try {
    for (const c of PRO_SYNC_COLLECTIONS) {
      const current = opts.local.read(c.key);
      const plan = planCollection({
        collection: c.name,
        local: splitRecords(c.shape, current),
        meta: meta.collections[c.name],
        remote: byCollection.get(c.name) ?? [],
        editedAt: edits[c.key],
        now,
      });
      if (plan.upserts.size > 0 || plan.deletes.size > 0) {
        const next = joinRecords(c.shape, current, plan);
        if (next === undefined) opts.local.remove(c.key);
        else if (!opts.local.write(c.key, next)) return outcome({ error: 'apply' });
        changedKeys.push(c.key);
        applied += plan.upserts.size + plan.deletes.size;
      }
      conflicts += plan.conflicts;
      toPush.push(...plan.push);
      nextCollections[c.name] = plan.meta;
    }
  } catch {
    return outcome({ error: 'apply' });
  } finally {
    applyingRemote = false;
  }

  meta = { ...meta, userId: opts.userId, cursor, collections: nextCollections };
  if (!saveProSyncMeta(meta)) return outcome({ error: 'apply', changedKeys });
  if (changedKeys.length > 0) opts.onApplied?.(changedKeys);

  // 3. Push what the account does not have yet.
  const base = { pulled: rows.length, applied, conflicts, changedKeys };
  for (let i = 0; i < toPush.length; i += PUSH_BATCH_SIZE) {
    const batch = toPush.slice(i, i + PUSH_BATCH_SIZE);
    let res: PushResult;
    try {
      res = await opts.repos.pushRecords(batch);
    } catch {
      res = { ok: false, code: 'failed' };
    }
    if (!res.ok) {
      saveProSyncMeta(meta);
      const error: ProSyncError =
        res.code === 'not-pro' ? 'not-pro' : res.code === 'not-migrated' ? 'not-migrated' : 'push';
      return outcome({ ...base, error, pushed: i });
    }
    for (const r of batch) {
      const m = meta.collections[r.collection]?.[r.record_id];
      if (m && m.p && m.t === r.updated_at) {
        const { p: _pending, ...agreed } = m;
        meta.collections[r.collection][r.record_id] = agreed;
      }
    }
  }

  const at = clock();
  meta = { ...meta, lastSuccessAt: at };
  if (!saveProSyncMeta(meta)) return outcome({ ...base, error: 'apply', pushed: toPush.length });
  return outcome({ ...base, ok: true, pushed: toPush.length, at });
}
