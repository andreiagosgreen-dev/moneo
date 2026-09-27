import { withClient } from './withClient';
import { pullPaged } from './sessionRepository';
import { currentAccessToken } from './focusBuddyClient';
import type { PushRecord, RemoteRecord } from '../sync/recordMerge';
import type { PullResult, PushResult } from '../sync/proSyncEngine';

/**
 * `user_records` (migration 0011): Pro full-data sync storage.
 * Reads use the RLS-scoped client (owner-only SELECT). Writes go through the
 * Worker, which checks Pro server-side — the table has no client write policy.
 */

export interface CloudRecordRow {
  collection: string;
  record_id: string;
  data: unknown;
  deleted: boolean;
  updated_at: number | string;
  server_updated_at: string;
}

export const RECORD_PULL_PAGE_SIZE = 1000;

/** Postgres / PostgREST "relation does not exist" — migration 0011 not applied. */
const MISSING_TABLE_CODES: ReadonlySet<string> = new Set(['42P01', 'PGRST205']);

export function mapCloudRecordRow(r: CloudRecordRow): RemoteRecord {
  return {
    collection: r.collection,
    recordId: r.record_id,
    data: r.deleted ? null : r.data,
    deleted: r.deleted === true,
    updatedAt: Number(r.updated_at),
    serverUpdatedAt: r.server_updated_at,
  };
}

/** Every row changed after `since` (null = all), in bounded pages. Never partial. */
export async function pullUserRecords(
  userId: string,
  since: string | null,
  pageSize: number = RECORD_PULL_PAGE_SIZE,
): Promise<PullResult> {
  let notMigrated = false;
  const rows = await withClient(async (client) =>
    pullPaged<CloudRecordRow>(async (from, to) => {
      let q = client
        .from('user_records')
        .select('collection,record_id,data,deleted,updated_at,server_updated_at')
        .eq('user_id', userId);
      if (since) q = q.gt('server_updated_at', since);
      const { data, error } = await q
        .order('server_updated_at', { ascending: true })
        .order('collection', { ascending: true })
        .order('record_id', { ascending: true })
        .range(from, to);
      if (error) {
        if (MISSING_TABLE_CODES.has(String(error.code ?? ''))) notMigrated = true;
        return null;
      }
      return (data as CloudRecordRow[] | null) ?? [];
    }, pageSize),
  );
  if (!rows) return { ok: false, notMigrated };
  return { ok: true, rows: rows.map(mapCloudRecordRow) };
}

/** Upload one batch through the Worker (`POST /api/sync/records`). */
export async function pushUserRecords(
  records: PushRecord[],
  getToken: () => Promise<string | null> = currentAccessToken,
): Promise<PushResult> {
  if (records.length === 0) return { ok: true };
  const token = await getToken();
  if (!token) return { ok: false, code: 'failed' };
  try {
    const res = await fetch('/api/sync/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ records }),
    });
    if (res.ok) return { ok: true };
    let code = '';
    try {
      code = String(((await res.json()) as { code?: unknown }).code ?? '');
    } catch {
      /* non-JSON (e.g. dev server without the Worker) */
    }
    if (res.status === 403 && code === 'not_pro') return { ok: false, code: 'not-pro' };
    if (code === 'not_migrated') return { ok: false, code: 'not-migrated' };
    return { ok: false, code: 'failed' };
  } catch {
    return { ok: false, code: 'failed' };
  }
}

/** Owner read of every stored record (JSON export). null when unavailable. */
export async function pullAllUserRecords(userId: string): Promise<RemoteRecord[] | null> {
  const res = await pullUserRecords(userId, null);
  return res.ok ? res.rows : null;
}
