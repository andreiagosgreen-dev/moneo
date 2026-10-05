/**
 * Pro full-data sync — write path (`POST /api/sync/records`).
 *
 * `user_records` has no client write policy: every write comes through here.
 * Identity comes only from the caller's JWT (verified against Supabase Auth);
 * Pro is checked server-side (paid Lemon row or complimentary allowlist), so
 * a Free or lapsed account can never write, whatever the client does. Reads
 * stay on the RLS-scoped client (owner-only SELECT).
 *
 * Stored rows are replaced only by a strictly newer `updated_at`
 * (`upsert_user_records`, migration 0011), so replays and stale devices are
 * harmless.
 */

import { bearerToken, verifyUser, type FetchImpl } from './account';
import { hasServerProAccess } from './proAccess';
import { buildSecurityHeaders, declaredBodyTooLarge, mergeHeaders } from './security';

export interface ProSyncEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PRO_COMPLIMENTARY_EMAILS?: string;
}

/** Mirrors `PRO_SYNC_COLLECTIONS` names in `src/lib/sync/proCollections.ts` (test-pinned). */
export const PRO_SYNC_COLLECTION_NAMES: ReadonlySet<string> = new Set([
  'projects',
  'tasks',
  'goals',
  'objectives',
  'habits',
  'habit_log',
  'journal',
  'time_off',
  'energy_log',
  'life_areas',
  'life_map',
  'skills',
  'time_blocks',
  'ivy_plans',
  'frog_log',
  'sprints',
  'board_config',
  'waterfall',
  'links',
  'saved_filters',
  'roadmaps',
  'workouts',
]);

export const MAX_SYNC_BODY_BYTES = 2_000_000;
export const MAX_RECORDS_PER_REQUEST = 500;
export const MAX_RECORD_DATA_BYTES = 200_000;
/** A device clock running ahead may not stamp edits further than this into the future. */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;

export interface SyncRecordInput {
  collection: string;
  record_id: string;
  data: unknown;
  deleted: boolean;
  updated_at: number;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), { 'Content-Type': 'application/json' }),
  });
}

function restHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Validate and normalize a push batch. Returns null when anything is
 * malformed (the whole batch is rejected — never a silent partial write).
 * Duplicate (collection, record_id) pairs keep the newest version, since
 * one INSERT ... ON CONFLICT cannot touch the same row twice.
 */
export function validateRecords(input: unknown, now: number): SyncRecordInput[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_RECORDS_PER_REQUEST) {
    return null;
  }
  const byKey = new Map<string, SyncRecordInput>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const { collection, record_id: recordId, updated_at: updatedAt } = r;
    if (typeof collection !== 'string' || !PRO_SYNC_COLLECTION_NAMES.has(collection)) return null;
    if (typeof recordId !== 'string' || recordId.length === 0 || recordId.length > 200) return null;
    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt < 0) return null;
    const deleted = r.deleted === true;
    let data: unknown = null;
    if (!deleted) {
      if (r.data === undefined || r.data === null) return null;
      const size = JSON.stringify(r.data).length;
      if (size > MAX_RECORD_DATA_BYTES) return null;
      data = r.data;
    }
    const record: SyncRecordInput = {
      collection,
      record_id: recordId,
      data,
      deleted,
      updated_at: Math.min(Math.floor(updatedAt), now + MAX_CLOCK_SKEW_MS),
    };
    const key = `${collection}\u0000${recordId}`;
    const prev = byKey.get(key);
    if (!prev || record.updated_at >= prev.updated_at) byKey.set(key, record);
  }
  return [...byKey.values()];
}

/** PostgREST codes for "function / relation does not exist" (migration 0011 not applied). */
const NOT_MIGRATED_CODES: ReadonlySet<string> = new Set(['PGRST202', '42883', '42P01', 'PGRST205']);

/** POST /api/sync/records — body `{ records: SyncRecordInput[] }`. */
export async function handleSyncRecords(
  request: Request,
  env: ProSyncEnv,
  fetchImpl: FetchImpl = fetch,
  now: () => number = Date.now,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Sync is not configured', code: 'not_configured' }, 503);
  }
  if (declaredBodyTooLarge(request, MAX_SYNC_BODY_BYTES)) {
    return json({ error: 'Payload too large', code: 'too_large' }, 413);
  }
  const token = bearerToken(request);
  if (!token) return json({ error: 'Missing or invalid authorization' }, 401);
  const user = await verifyUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, token, fetchImpl);
  if (!user) return json({ error: 'Invalid or expired session' }, 401);

  if (!(await hasServerProAccess(env, user.userId, user.email, fetchImpl, user.createdAt))) {
    return json({ error: 'Full sync is a Pro feature', code: 'not_pro' }, 403);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_SYNC_BODY_BYTES) {
      return json({ error: 'Payload too large', code: 'too_large' }, 413);
    }
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON', code: 'invalid' }, 400);
  }
  const records = validateRecords((body as { records?: unknown } | null)?.records, now());
  if (!records) return json({ error: 'Invalid records', code: 'invalid' }, 400);

  try {
    const res = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/upsert_user_records`, {
      method: 'POST',
      headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
      body: JSON.stringify({ p_user_id: user.userId, p_records: records }),
    });
    if (!res.ok) {
      let code = '';
      try {
        code = String(((await res.json()) as { code?: unknown }).code ?? '');
      } catch {
        /* non-JSON error body */
      }
      if (NOT_MIGRATED_CODES.has(code)) {
        return json({ error: 'Sync storage is not set up yet', code: 'not_migrated' }, 503);
      }
      return json({ error: 'Could not save records', code: 'storage' }, 502);
    }
    const written = await res.json().catch(() => 0);
    return json({ ok: true, received: records.length, written: Number(written) || 0 }, 200);
  } catch {
    return json({ error: 'Could not save records', code: 'storage' }, 502);
  }
}
