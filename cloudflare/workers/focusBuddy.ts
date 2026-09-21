/**
 * Focus buddy (Faza 25) — one connected person, sees only the other's
 * today-focused minutes. No feed, no leaderboard, no session detail ever
 * crosses the wire. Mirrors account.ts's exact pattern: identity comes
 * only from the caller's own JWT, verified against Supabase Auth; the
 * client never supplies a user id.
 */

import { bearerToken, verifyUserToken, type FetchImpl } from './account';
import { buildSecurityHeaders, mergeHeaders } from './security';

export interface FocusBuddyEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface PairRow {
  id: string;
  user_a: string;
  user_b: string | null;
  invite_code: string;
  status: 'pending' | 'accepted';
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), { 'Content-Type': 'application/json' }),
  });
}

function restHeaders(serviceKey: string, extra: Record<string, string> = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function randomInviteCode(): string {
  // 8 uppercase base32-ish chars — easy to read aloud/copy, not a secret
  // (it only grants "pair with me", never data access on its own).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function findPairForUser(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<PairRow | null> {
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/focus_buddy_pairs?or=(user_a.eq.${userId},user_b.eq.${userId})&limit=1`,
    { headers: restHeaders(serviceKey) },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as PairRow[];
  return rows[0] ?? null;
}

/** Defense-in-depth Pro-gate — mirrors the owner-read the webhook path already does. */
async function isUserPro(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&select=status&limit=1`,
      { headers: restHeaders(serviceKey) },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ status: string }>;
    return rows[0]?.status === 'active';
  } catch {
    return false;
  }
}

async function verify(
  request: Request,
  env: FocusBuddyEnv,
  fetchImpl: FetchImpl,
): Promise<{ userId: string } | Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Focus buddy is not configured' }, 503);
  }
  const token = bearerToken(request);
  if (!token) return json({ error: 'Missing or invalid authorization' }, 401);
  const userId = await verifyUserToken(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    token,
    fetchImpl,
  );
  if (!userId) return json({ error: 'Invalid or expired session' }, 401);
  return { userId };
}

/** POST /api/buddy/invite — creates a pending pairing, returns its code. */
export async function handleBuddyInvite(
  request: Request,
  env: FocusBuddyEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const v = await verify(request, env, fetchImpl);
  if (v instanceof Response) return v;
  const supabaseUrl = env.SUPABASE_URL as string;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!(await isUserPro(supabaseUrl, serviceKey, v.userId, fetchImpl))) {
    return json({ error: 'Focus buddy is a Pro feature' }, 403);
  }

  const existing = await findPairForUser(supabaseUrl, serviceKey, v.userId, fetchImpl);
  if (existing) return json({ error: 'Already paired or invite pending' }, 409);

  const code = randomInviteCode();
  const res = await fetchImpl(`${supabaseUrl}/rest/v1/focus_buddy_pairs`, {
    method: 'POST',
    headers: restHeaders(serviceKey, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ user_a: v.userId, invite_code: code, status: 'pending' }),
  });
  if (!res.ok) return json({ error: 'Failed to create invite' }, 500);
  return json({ ok: true, code }, 200);
}

/** POST /api/buddy/join { code } — claims a pending invite. */
export async function handleBuddyJoin(
  request: Request,
  env: FocusBuddyEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const v = await verify(request, env, fetchImpl);
  if (v instanceof Response) return v;
  const supabaseUrl = env.SUPABASE_URL as string;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!(await isUserPro(supabaseUrl, serviceKey, v.userId, fetchImpl))) {
    return json({ error: 'Focus buddy is a Pro feature' }, 403);
  }

  let code = '';
  try {
    const body = (await request.json()) as { code?: unknown };
    code = typeof body.code === 'string' ? body.code.trim().toUpperCase().slice(0, 16) : '';
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!code) return json({ error: 'Missing code' }, 400);

  const already = await findPairForUser(supabaseUrl, serviceKey, v.userId, fetchImpl);
  if (already) return json({ error: 'Already paired or invite pending' }, 409);

  const lookup = await fetchImpl(
    `${supabaseUrl}/rest/v1/focus_buddy_pairs?invite_code=eq.${encodeURIComponent(
      code,
    )}&status=eq.pending&limit=1`,
    { headers: restHeaders(serviceKey) },
  );
  if (!lookup.ok) return json({ error: 'Lookup failed' }, 500);
  const rows = (await lookup.json()) as PairRow[];
  const pending = rows[0];
  if (!pending) return json({ error: 'Invite not found or already used' }, 404);
  if (pending.user_a === v.userId) return json({ error: 'You cannot join your own invite' }, 400);

  const update = await fetchImpl(
    `${supabaseUrl}/rest/v1/focus_buddy_pairs?id=eq.${pending.id}&status=eq.pending`,
    {
      method: 'PATCH',
      headers: restHeaders(serviceKey, { Prefer: 'return=minimal' }),
      body: JSON.stringify({
        user_b: v.userId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      }),
    },
  );
  if (!update.ok) return json({ error: 'Failed to join' }, 500);
  return json({ ok: true }, 200);
}

/** POST /api/buddy/unpair — ends the current pairing (either side may call it). */
export async function handleBuddyUnpair(
  request: Request,
  env: FocusBuddyEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const v = await verify(request, env, fetchImpl);
  if (v instanceof Response) return v;
  const supabaseUrl = env.SUPABASE_URL as string;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY as string;

  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/focus_buddy_pairs?or=(user_a.eq.${v.userId},user_b.eq.${v.userId})`,
    { method: 'DELETE', headers: restHeaders(serviceKey, { Prefer: 'return=minimal' }) },
  );
  if (!res.ok) return json({ error: 'Failed to unpair' }, 500);
  return json({ ok: true }, 200);
}

/**
 * GET /api/buddy/status — pairing state plus, once accepted, the buddy's
 * today-focused minutes ONLY (never their id, email, or session detail).
 */
export async function handleBuddyStatus(
  request: Request,
  env: FocusBuddyEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const v = await verify(request, env, fetchImpl);
  if (v instanceof Response) return v;
  const supabaseUrl = env.SUPABASE_URL as string;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY as string;

  const pair = await findPairForUser(supabaseUrl, serviceKey, v.userId, fetchImpl);
  if (!pair) return json({ paired: false }, 200);
  if (pair.status === 'pending') {
    return json({ paired: false, pendingCode: pair.user_a === v.userId ? pair.invite_code : null }, 200);
  }

  const buddyId = pair.user_a === v.userId ? pair.user_b : pair.user_a;
  if (!buddyId) return json({ paired: false }, 200);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const minutesRes = await fetchImpl(
    `${supabaseUrl}/rest/v1/focus_sessions?user_id=eq.${buddyId}&completed_at=gte.${startOfDay.toISOString()}&select=duration_min`,
    { headers: restHeaders(serviceKey) },
  );
  let todayMinutes = 0;
  if (minutesRes.ok) {
    const rows = (await minutesRes.json()) as Array<{ duration_min: number }>;
    todayMinutes = rows.reduce((sum, r) => sum + (r.duration_min || 0), 0);
  }

  return json({ paired: true, todayMinutes }, 200);
}
