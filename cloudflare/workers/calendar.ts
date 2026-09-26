/**
 * Read-only Google Calendar integration (Roadmap Faza 10).
 *
 * Scope is deliberately narrow: fetch the user's real calendar events so
 * the client can flag conflicts with their own time blocks. Never writes
 * to Google Calendar, never auto-schedules anything.
 *
 * The refresh token this stores grants ongoing third-party account
 * access — a stricter class of secret than anything else Moneo persists.
 * It is written once by the client immediately after the OAuth redirect
 * and never read back by the client; `google_calendar_connections` has
 * zero RLS policies (see migration 0009), so only this Worker (via the
 * service role) can ever touch it. Identity is always derived from the
 * caller's JWT (`verifyUserToken`), exactly like account deletion — a
 * client-supplied user id is never trusted.
 */

import { bearerToken, verifyUser, type FetchImpl } from './account';
import { hasComplimentaryPro, resolveComplimentaryAllowlist } from './complimentaryPro';
import { buildSecurityHeaders, declaredBodyTooLarge, mergeHeaders } from './security';

export interface CalendarEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Comma-separated emails — Free branding + Pro entitlements (not Lemon). */
  PRO_COMPLIMENTARY_EMAILS?: string;
}

const MAX_CONNECT_BODY_BYTES = 4_096;
const MAX_RANGE_DAYS = 31;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

interface ConnectionRow {
  user_id: string;
  refresh_token: string;
  google_email: string | null;
  connected_at: string;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), { 'Content-Type': 'application/json' }),
  });
}

/** Fails closed (missing env) or 401 (bad/absent token) before doing anything. */
async function requireUser(
  request: Request,
  env: CalendarEnv,
  fetchImpl: FetchImpl,
): Promise<{ userId: string; email: string | null } | { error: Response }> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: json({ error: 'Calendar integration is not configured' }, 503) };
  }
  const token = bearerToken(request);
  if (!token) return { error: json({ error: 'Missing or invalid authorization' }, 401) };
  const user = await verifyUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, token, fetchImpl);
  if (!user) return { error: json({ error: 'Invalid or expired session' }, 401) };
  return user;
}

/** Defense-in-depth: UI hides the feature from Free users, but a hidden
 *  button is not enough gating for a credential this sensitive.
 *  Also honors complimentary Pro emails (Free branding, full unlock). */
async function isProUser(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  email: string | null,
  complimentaryEnv: string | undefined,
  fetchImpl: FetchImpl,
): Promise<boolean> {
  const allowlist = resolveComplimentaryAllowlist(complimentaryEnv);
  if (hasComplimentaryPro(email, allowlist)) return true;
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=status`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ status?: string }>;
    return rows[0]?.status === 'active';
  } catch {
    return false;
  }
}

async function getConnection(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<ConnectionRow | null> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/google_calendar_connections?user_id=eq.${encodeURIComponent(userId)}&select=user_id,refresh_token,google_email,connected_at`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as ConnectionRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function deleteConnection(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/google_calendar_connections?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: 'return=minimal',
        },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Best-effort: revoking at Google is a courtesy, never blocks the caller. */
export async function revokeGoogleToken(token: string, fetchImpl: FetchImpl): Promise<void> {
  try {
    await fetchImpl(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `token=${encodeURIComponent(token)}`,
    });
  } catch {
    /* best-effort, non-fatal */
  }
}

interface AccessTokenResult {
  ok: true;
  accessToken: string;
}
interface AccessTokenFailure {
  ok: false;
  invalidGrant: boolean;
}

/** Exchanges the stored refresh token for a fresh access token. No caching
 *  across requests — Workers are stateless per-isolate. */
async function exchangeRefreshToken(
  env: CalendarEnv,
  refreshToken: string,
  fetchImpl: FetchImpl,
): Promise<AccessTokenResult | AccessTokenFailure> {
  try {
    const res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID ?? '',
        client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) {
      let invalidGrant = false;
      try {
        const body = (await res.json()) as { error?: string };
        invalidGrant = body.error === 'invalid_grant';
      } catch {
        /* non-JSON error body */
      }
      return { ok: false, invalidGrant };
    }
    const data = (await res.json()) as { access_token?: string };
    if (typeof data.access_token !== 'string' || !data.access_token) {
      return { ok: false, invalidGrant: false };
    }
    return { ok: true, accessToken: data.access_token };
  } catch {
    return { ok: false, invalidGrant: false };
  }
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export interface ExternalCalendarEvent {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number;
  allDay: boolean;
}

function mapGoogleEvents(raw: unknown): ExternalCalendarEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: ExternalCalendarEvent[] = [];
  for (const item of items as GoogleEvent[]) {
    if (!item || typeof item.id !== 'string') continue;
    const allDay = typeof item.start?.date === 'string';
    const startRaw = item.start?.dateTime ?? item.start?.date;
    const endRaw = item.end?.dateTime ?? item.end?.date;
    if (!startRaw || !endRaw) continue;
    const startsAt = Date.parse(startRaw);
    const endsAt = Date.parse(endRaw);
    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) continue;
    out.push({
      id: item.id,
      title: typeof item.summary === 'string' ? item.summary : '',
      startsAt,
      endsAt,
      allDay,
    });
  }
  return out;
}

export async function handleCalendarConnect(
  request: Request,
  env: CalendarEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(request, env, fetchImpl);
  if ('error' in auth) return auth.error;

  const isPro = await isProUser(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    auth.userId,
    auth.email,
    env.PRO_COMPLIMENTARY_EMAILS,
    fetchImpl,
  );
  if (!isPro) return json({ error: 'Calendar sync is a Pro feature' }, 403);

  if (declaredBodyTooLarge(request, MAX_CONNECT_BODY_BYTES)) {
    return json({ error: 'Payload too large' }, 413);
  }
  const raw = await request.text();
  if (raw.length > MAX_CONNECT_BODY_BYTES) return json({ error: 'Payload too large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const rec = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const refreshToken = typeof rec.refreshToken === 'string' ? rec.refreshToken.trim() : '';
  if (!refreshToken || refreshToken.length > 2048) {
    return json({ error: 'Missing or invalid refresh token' }, 400);
  }
  const googleEmail = typeof rec.googleEmail === 'string' ? rec.googleEmail.slice(0, 320) : null;

  try {
    const res = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/google_calendar_connections`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: auth.userId,
        refresh_token: refreshToken,
        google_email: googleEmail,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) return json({ error: 'Failed to store connection' }, 500);
  } catch {
    return json({ error: 'Database error' }, 500);
  }

  return json({ ok: true }, 200);
}

export async function handleCalendarStatus(
  request: Request,
  env: CalendarEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(request, env, fetchImpl);
  if ('error' in auth) return auth.error;

  const row = await getConnection(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    auth.userId,
    fetchImpl,
  );
  if (!row) return json({ connected: false }, 200);
  return json(
    { connected: true, googleEmail: row.google_email ?? undefined, connectedAt: row.connected_at },
    200,
  );
}

export async function handleCalendarEvents(
  request: Request,
  env: CalendarEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(request, env, fetchImpl);
  if ('error' in auth) return auth.error;

  const isPro = await isProUser(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    auth.userId,
    auth.email,
    env.PRO_COMPLIMENTARY_EMAILS,
    fetchImpl,
  );
  if (!isPro) return json({ error: 'Calendar sync is a Pro feature' }, 403);

  const url = new URL(request.url);
  const startParam = url.searchParams.get('start') ?? '';
  const endParam = url.searchParams.get('end') ?? '';
  const start = Date.parse(startParam);
  const end = Date.parse(endParam);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return json({ error: 'Invalid start/end range' }, 400);
  }
  if (end - start > MAX_RANGE_DAYS * 86_400_000) {
    return json({ error: 'Range too large' }, 400);
  }

  const row = await getConnection(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    auth.userId,
    fetchImpl,
  );
  if (!row) return json({ error: 'not_connected' }, 404);

  const tokenResult = await exchangeRefreshToken(env, row.refresh_token, fetchImpl);
  if (!tokenResult.ok) {
    if (tokenResult.invalidGrant) {
      await deleteConnection(
        env.SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
        auth.userId,
        fetchImpl,
      );
      return json({ error: 'reconnect_required' }, 409);
    }
    return json({ error: 'Failed to refresh Google access' }, 502);
  }

  try {
    const params = new URLSearchParams({
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(end).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    const res = await fetchImpl(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } },
    );
    if (!res.ok) return json({ error: 'Failed to fetch calendar events' }, 502);
    const data = await res.json();
    return json({ events: mapGoogleEvents(data) }, 200);
  } catch {
    return json({ error: 'Failed to fetch calendar events' }, 502);
  }
}

export async function handleCalendarDisconnect(
  request: Request,
  env: CalendarEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = await requireUser(request, env, fetchImpl);
  if ('error' in auth) return auth.error;

  const row = await getConnection(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    auth.userId,
    fetchImpl,
  );
  if (row) await revokeGoogleToken(row.refresh_token, fetchImpl);

  const deleted = await deleteConnection(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    auth.userId,
    fetchImpl,
  );
  if (!deleted) return json({ error: 'Failed to disconnect' }, 500);
  return json({ ok: true }, 200);
}
