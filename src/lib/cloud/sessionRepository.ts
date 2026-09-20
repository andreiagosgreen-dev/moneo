import { withClient } from './withClient';
import type { Session } from '../store';
import type { RemoteSessionRow } from '../sync/merge';

/**
 * Focus session repository: authenticated CRUD primitives only.
 * NOT wired to any automatic upload — signing in transfers nothing.
 * The user-visible sync flow requires explicit first-sync consent.
 */

export interface CloudSessionRow {
  id: string;
  user_id: string;
  /** ISO-8601 of the absolute completed-at timestamp. */
  completed_at: string;
  duration_min: number;
  intention: string | null;
  area_id: string | null;
}

/**
 * Boundary projection → cloud row mapping. runSync has already translated
 * local session.areaId to the area's cloud UUID on a copy. The scoped FK
 * (user_id, area_id) references focus_areas(user_id, id). Invalid/unresolved
 * references are sent as null; local history is never rewritten here.
 */
export function toCloudSessionRow(
  userId: string,
  session: Session & { id: string },
): CloudSessionRow {
  const isUuid =
    typeof session.areaId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.areaId);
  return {
    id: session.id,
    user_id: userId,
    completed_at: new Date(session.at).toISOString(),
    duration_min: session.min,
    intention: session.intention ?? null,
    area_id: session.areaId && isUuid ? session.areaId : null,
  };
}

export function insertSession(row: CloudSessionRow): Promise<boolean> {
  return withClient(async (client) => {
    const { error } = await client.from('focus_sessions').insert(row);
    return !error;
  }).then((r) => r ?? false);
}

export function listSessions(userId: string, limit = 500): Promise<CloudSessionRow[] | null> {
  return withClient(async (client) => {
    const { data, error } = await client
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit);
    return error ? null : ((data as CloudSessionRow[]) ?? null);
  });
}

/* ---------- sync primitives (Gate 9) ---------- */

/**
 * Bounded page size for session pulls (R3). Keeps each network response
 * small while keeping request counts predictable:
 * 1,000 sessions → 2 requests; 20,001 → 21 requests.
 */
export const SESSION_PULL_PAGE_SIZE = 1000;

/** Safety guard against a pathological server that never returns a short
 *  page (1,000 pages × 1,000 rows = 1M sessions max per pull). */
const MAX_PAGES = 1000;

/**
 * Cloud row → transport-neutral domain row. Single mapping point so every
 * page is normalized identically (timestamp ISO → epoch-ms, optional
 * fields passed through as-is).
 */
export function mapCloudSessionRow(r: CloudSessionRow): RemoteSessionRow {
  return {
    id: r.id,
    at: Date.parse(r.completed_at),
    min: r.duration_min,
    intention: r.intention,
    areaId: r.area_id,
  };
}

/**
 * Deterministic bounded-range pagination orchestrator (R3).
 *
 * Contract:
 * - Pages are requested as inclusive ranges [from, to] of a dataset ordered
 *   deterministically by the caller (completed_at ASC, id ASC — a UNIQUE
 *   total order, so offsets are stable on a static dataset).
 * - Stops when a page contains fewer than `pageSize` rows (an exactly-full
 *   page always triggers one more request to prove completion).
 * - ANY failed page → the whole pull fails with null. A partial history is
 *   NEVER returned as if it were complete.
 * - `maxPages` guards against a server that never terminates.
 *
 * Concurrency note: range pagination is not snapshot-consistent. Because
 * ordering is ascending on completed_at, realistically concurrent inserts
 * (new sessions, later timestamps) append at the TAIL and never shift
 * earlier pages. A back-dated insert from another device mid-pull could in
 * theory shift offsets; the id tie-breaker, engine-level id de-duplication
 * and next-sync self-healing make the residual risk negligible (P2).
 */
export async function pullPaged<T>(
  fetchPage: (from: number, to: number) => Promise<T[] | null>,
  pageSize: number,
  maxPages: number = MAX_PAGES,
): Promise<T[] | null> {
  const out: T[] = [];
  let from = 0;
  for (let page = 0; page < maxPages; page++) {
    const rows = await fetchPage(from, from + pageSize - 1);
    if (rows === null) return null; // failure mid-pull — never partial
    out.push(...rows);
    if (rows.length < pageSize) return out; // short page → complete
    from += pageSize;
  }
  return null; // pathological non-terminating source — treat as failure
}

/**
 * Pull ALL of the user's sessions as transport-neutral rows, in bounded
 * pages, regardless of history size. No silent truncation.
 *
 * Deterministic order: completed_at ASC, then id ASC (unique). The result
 * is oldest → newest; the merge engine is order-insensitive (id-keyed maps
 * + explicit time sort), so this changes no product ordering semantics.
 */
export async function pullAllSessions(
  userId: string,
  pageSize: number = SESSION_PULL_PAGE_SIZE,
): Promise<RemoteSessionRow[] | null> {
  return withClient(async (client) => {
    const rows = await pullPaged<CloudSessionRow>(async (from, to) => {
      const { data, error } = await client
        .from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (error || !data) return null;
      return data as CloudSessionRow[];
    }, pageSize);
    if (rows === null) return null;
    // Defensive de-duplication by id (offset-shift safety net). Keeps the
    // FIRST occurrence; any differing duplicate payload still flows through
    // the merge engine's same-id conflict machinery, never dropped silently.
    const seen = new Set<string>();
    const out: RemoteSessionRow[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(mapCloudSessionRow(r));
    }
    return out;
  });
}

/**
 * Idempotent batched push: upsert by id, ignoring duplicates.
 * ≤100 rows per request; merge policy already decided what to send.
 */
export function pushSessionBatch(
  userId: string,
  sessions: Array<{
    id: string;
    at: number;
    min: number;
    intention?: string;
    areaId?: string;
  }>,
  chunkSize = 100,
): Promise<boolean> {
  if (sessions.length === 0) return Promise.resolve(true);
  return withClient(async (client) => {
    for (let i = 0; i < sessions.length; i += chunkSize) {
      const rows = sessions
        .slice(i, i + chunkSize)
        .map((s) => toCloudSessionRow(userId, s as Session & { id: string }));
      const { error } = await client
        .from('focus_sessions')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) return false;
    }
    return true;
  }).then((r) => r ?? false);
}
