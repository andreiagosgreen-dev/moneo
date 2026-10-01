/**
 * Authenticated account deletion (Roadmap Faza 0.1).
 *
 * The client NEVER decides whose data to delete: identity comes only from
 * the user's own JWT, verified against Supabase Auth (`/auth/v1/user`).
 * Any `user_id` sent in the request body is ignored.
 *
 * Order: verify token → cancel a live Lemon subscription (only when the
 * Worker holds LEMON_SQUEEZY_API_KEY) → wipe every data table explicitly
 * (a failing table does not stop the others; optional tables that are not
 * migrated yet are skipped) → delete the Auth user LAST (FK cascades remove
 * anything a failed wipe left) → `{ ok: true }` only once the Auth user is
 * really gone. Any failure answers 4xx/5xx with the failing step, so the
 * client keeps its local data and can safely retry.
 */

import { buildSecurityHeaders, mergeHeaders } from './security';

export interface AccountEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Optional: enables cancelling a live Lemon subscription on deletion. */
  LEMON_SQUEEZY_API_KEY?: string;
  /** Scopes the email lookup of further subscriptions to this store. */
  LEMON_STORE_ID?: string;
}

export type FetchImpl = typeof fetch;

/** User-data tables wiped explicitly, children before parents. */
export const ACCOUNT_DATA_TABLES = [
  'focus_sessions',
  'focus_areas',
  'user_settings',
  'user_records',
  'subscriptions',
  'google_calendar_connections',
  'profiles',
] as const;

/**
 * Tables whose migration may not be applied in a given deployment
 * (0010 google_calendar_connections, 0011 user_records). A missing one
 * holds no rows, so it is skipped instead of failing the deletion.
 */
export const OPTIONAL_ACCOUNT_TABLES: ReadonlySet<string> = new Set([
  'user_records',
  'google_calendar_connections',
  'focus_buddy_pairs',
]);

/** PostgREST codes for "relation does not exist" (Postgres / schema cache). */
const MISSING_TABLE_CODES: ReadonlySet<string> = new Set(['42P01', 'PGRST205']);

export async function isMissingTableResponse(res: Response): Promise<boolean> {
  if (res.ok) return false;
  try {
    const body = (await res.clone().json()) as { code?: unknown };
    return typeof body?.code === 'string' && MISSING_TABLE_CODES.has(body.code);
  } catch {
    return false;
  }
}

export interface DeleteRowsResult {
  /** Tables whose wipe failed (network or non-2xx, other than a skipped optional table). */
  failed: string[];
  /** Optional tables that do not exist in this database. */
  skipped: string[];
}

interface SupabaseUser {
  id?: unknown;
  email?: unknown;
  created_at?: unknown;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), { 'Content-Type': 'application/json' }),
  });
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header) return null;
  const [scheme, ...rest] = header.split(' ');
  if (scheme.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

export interface VerifiedUser {
  userId: string;
  email: string | null;
  /** Epoch ms the Auth user was created; absent when Supabase did not say. */
  createdAt?: number;
}

/**
 * Resolve identity from a JWT via Supabase Auth (`/auth/v1/user`).
 * Returns null when the token is invalid, expired or unverifiable.
 */
export async function verifyUser(
  supabaseUrl: string,
  serviceKey: string,
  token: string,
  fetchImpl: FetchImpl,
): Promise<VerifiedUser | null> {
  try {
    const res = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as SupabaseUser;
    if (typeof user.id !== 'string' || user.id.length === 0) return null;
    const createdAt = typeof user.created_at === 'string' ? Date.parse(user.created_at) : NaN;
    return {
      userId: user.id,
      email: typeof user.email === 'string' && user.email.length > 0 ? user.email : null,
      ...(Number.isFinite(createdAt) ? { createdAt } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the true user id from a JWT via Supabase Auth.
 * Returns null when the token is invalid, expired or unverifiable.
 */
export async function verifyUserToken(
  supabaseUrl: string,
  serviceKey: string,
  token: string,
  fetchImpl: FetchImpl,
): Promise<string | null> {
  const user = await verifyUser(supabaseUrl, serviceKey, token, fetchImpl);
  return user?.userId ?? null;
}

/**
 * Delete every user-data row. Keeps going past a failing table so one bad
 * table never leaves the rest behind; the caller decides what to do with
 * `failed`. Missing optional tables are reported in `skipped`.
 */
export async function deleteUserRows(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<DeleteRowsResult> {
  const id = encodeURIComponent(userId);
  const targets: Array<{ table: string; filter: string }> = [
    ...ACCOUNT_DATA_TABLES.map((table) => ({ table, filter: `user_id=eq.${id}` })),
    // focus_buddy_pairs (Faza 25) has no single user_id column — a user can
    // be on either side of the pairing — so it needs its own OR filter.
    { table: 'focus_buddy_pairs', filter: `or=(user_a.eq.${id},user_b.eq.${id})` },
  ];
  const result: DeleteRowsResult = { failed: [], skipped: [] };
  for (const { table, filter } of targets) {
    try {
      const res = await fetchImpl(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'return=minimal',
        },
      });
      if (res.ok) continue;
      if (OPTIONAL_ACCOUNT_TABLES.has(table) && (await isMissingTableResponse(res))) {
        result.skipped.push(table);
      } else {
        result.failed.push(table);
      }
    } catch {
      result.failed.push(table);
    }
  }
  return result;
}

/** Subscription states Lemon will not charge again. */
const NON_BILLING_STATUSES: ReadonlySet<string> = new Set(['free', 'cancelled', 'expired']);

/** Lemon statuses that will (or may) charge again. */
const BILLING_STATUSES: ReadonlySet<string> = new Set([
  'on_trial',
  'active',
  'past_due',
  'unpaid',
  'paused',
]);

function lemonHeaders(lemonApiKey: string): Record<string, string> {
  return {
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    Authorization: `Bearer ${lemonApiKey}`,
  };
}

/** Cancel one Lemon subscription; 404 means it is already gone. */
async function cancelLemonSubscription(
  subscriptionId: string,
  lemonApiKey: string,
  fetchImpl: FetchImpl,
): Promise<boolean> {
  const res = await fetchImpl(
    `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: 'DELETE', headers: lemonHeaders(lemonApiKey) },
  );
  return res.ok || res.status === 404;
}

/**
 * Further live subscriptions bought with the account's email in this store
 * (e.g. a monthly plan left running next to a yearly one). The account row
 * keeps only one subscription, so these are found through Lemon itself.
 */
async function liveSubscriptionIdsByEmail(
  email: string,
  storeId: string | undefined,
  lemonApiKey: string,
  fetchImpl: FetchImpl,
): Promise<string[] | null> {
  const params = new URLSearchParams({ 'filter[user_email]': email, 'page[size]': '100' });
  if (storeId) params.set('filter[store_id]', storeId);
  const res = await fetchImpl(`https://api.lemonsqueezy.com/v1/subscriptions?${params}`, {
    headers: lemonHeaders(lemonApiKey),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    data?: Array<{ id?: unknown; attributes?: { status?: unknown } }>;
  };
  return (body.data ?? [])
    .filter((d) => BILLING_STATUSES.has(String(d.attributes?.status)))
    .map((d) => String(d.id ?? ''))
    .filter(Boolean);
}

/**
 * Cancel every live Lemon Squeezy subscription of the caller before their
 * rows are wiped — afterwards nothing in Moneo links the buyer to them. Lemon
 * keeps access until the paid period ends and stops renewals. Covers the
 * subscription on file plus any other live one under the account's email.
 * True when there is nothing to cancel or every cancel succeeded (404 counts:
 * Lemon no longer knows it); false aborts the deletion (retryable).
 */
export async function cancelLiveSubscription(
  supabaseUrl: string,
  serviceKey: string,
  lemonApiKey: string,
  userId: string,
  fetchImpl: FetchImpl,
  email: string | null = null,
  storeId?: string,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=lemon_subscription_id,status`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ lemon_subscription_id?: unknown; status?: unknown }>;
    const row = Array.isArray(rows) ? rows[0] : null;
    const ids = new Set<string>();
    const storedId =
      row && typeof row.lemon_subscription_id === 'string' ? row.lemon_subscription_id : '';
    if (storedId && !NON_BILLING_STATUSES.has(String(row?.status))) ids.add(storedId);
    // Without a subscription on file the account never bought through the app.
    if (email && storedId) {
      const more = await liveSubscriptionIdsByEmail(email, storeId, lemonApiKey, fetchImpl);
      if (more === null) return false;
      for (const id of more) ids.add(id);
    }
    for (const id of ids) {
      if (!(await cancelLemonSubscription(id, lemonApiKey, fetchImpl))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete the Auth user itself (FK cascades remove anything left).
 * A 404 means "already gone" — still success, so retries are idempotent.
 */
export async function deleteAuthUser(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function handleAccountDelete(
  request: Request,
  env: AccountEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Account deletion is not configured' }, 503);
  }
  const token = bearerToken(request);
  if (!token) {
    return json({ error: 'Missing or invalid authorization' }, 401);
  }

  const verified = await verifyUser(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    token,
    fetchImpl,
  );
  const userId = verified?.userId ?? null;
  if (!userId) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  if (env.LEMON_SQUEEZY_API_KEY) {
    const cancelled = await cancelLiveSubscription(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.LEMON_SQUEEZY_API_KEY,
      userId,
      fetchImpl,
      verified?.email ?? null,
      env.LEMON_STORE_ID,
    );
    if (!cancelled) {
      return json({ error: 'Failed to cancel subscription' }, 502);
    }
  }

  const rows = await deleteUserRows(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    userId,
    fetchImpl,
  );

  // Every data table references auth.users ON DELETE CASCADE, so deleting
  // the Auth user also removes whatever a failed explicit wipe left.
  const authGone = await deleteAuthUser(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    userId,
    fetchImpl,
  );
  if (!authGone) {
    return json(
      {
        error: 'Failed to delete user',
        step: 'auth',
        ...(rows.failed.length > 0 ? { failedTables: rows.failed } : {}),
      },
      500,
    );
  }

  return json({ ok: true }, 200);
}
