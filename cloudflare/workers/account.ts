/**
 * Authenticated account deletion (Roadmap Faza 0.1).
 *
 * The client NEVER decides whose data to delete: identity comes only from
 * the user's own JWT, verified against Supabase Auth (`/auth/v1/user`).
 * Any `user_id` sent in the request body is ignored.
 *
 * Order: verify token → wipe data tables explicitly → delete the Auth user
 * (cascades anything left) → `{ ok: true }`. Every failure fails closed
 * with 4xx/5xx and touches nothing after the failed step, so the client
 * can safely retry and never wipes local data on error.
 */

import { buildSecurityHeaders, mergeHeaders } from './security';

export interface AccountEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export type FetchImpl = typeof fetch;

/** User-data tables wiped explicitly, children before parents. */
export const ACCOUNT_DATA_TABLES = [
  'focus_sessions',
  'focus_areas',
  'user_settings',
  'subscriptions',
  'google_calendar_connections',
  'profiles',
] as const;

interface SupabaseUser {
  id?: unknown;
  email?: unknown;
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
    return {
      userId: user.id,
      email: typeof user.email === 'string' && user.email.length > 0 ? user.email : null,
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

/** Delete every user-data row; false on the first failure (abort, retryable). */
export async function deleteUserRows(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<boolean> {
  try {
    for (const table of ACCOUNT_DATA_TABLES) {
      const res = await fetchImpl(
        `${supabaseUrl}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'return=minimal',
          },
        },
      );
      if (!res.ok) return false;
    }
    // focus_buddy_pairs (Faza 25) has no single user_id column — a user can
    // be on either side of the pairing — so it needs its own OR filter.
    const buddyRes = await fetchImpl(
      `${supabaseUrl}/rest/v1/focus_buddy_pairs?or=(user_a.eq.${encodeURIComponent(
        userId,
      )},user_b.eq.${encodeURIComponent(userId)})`,
      {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'return=minimal',
        },
      },
    );
    if (!buddyRes.ok) return false;
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

  const userId = await verifyUserToken(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    token,
    fetchImpl,
  );
  if (!userId) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  const rowsGone = await deleteUserRows(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    userId,
    fetchImpl,
  );
  if (!rowsGone) {
    return json({ error: 'Failed to delete user data' }, 500);
  }

  const authGone = await deleteAuthUser(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    userId,
    fetchImpl,
  );
  if (!authGone) {
    return json({ error: 'Failed to delete user' }, 500);
  }

  return json({ ok: true }, 200);
}
