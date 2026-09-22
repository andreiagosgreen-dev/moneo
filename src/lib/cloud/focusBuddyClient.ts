/**
 * Focus buddy (Faza 25) client wrappers — plain `fetch()` against the
 * Worker's `/api/buddy/*` endpoints (RLS on `focus_buddy_pairs` is
 * service_role-only, so this never goes through the Supabase client
 * directly). Fails open to a safe "unpaired" default on any error,
 * matching subscriptionRepository.ts's idiom.
 */
import { getSupabaseClient } from '../supabase';

export interface BuddyStatus {
  paired: boolean;
  /** Only set when a pending invite belongs to the caller (they created it). */
  pendingCode?: string | null;
  /** Only set once accepted — the buddy's today-focused minutes, nothing else. */
  todayMinutes?: number;
}

export const DEFAULT_BUDDY_STATUS: BuddyStatus = { paired: false };

/** Current session's access token, or null when signed out/unconfigured. Never throws. */
export async function currentAccessToken(): Promise<string | null> {
  try {
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    const token = data?.session?.access_token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

async function post(path: string, accessToken: string, body?: unknown): Promise<Response | null> {
  try {
    return await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return null;
  }
}

/** Creates a pending invite; returns its code, or null on failure (incl. non-Pro/already paired). */
export async function inviteBuddy(accessToken: string): Promise<string | null> {
  const res = await post('/api/buddy/invite', accessToken);
  if (!res || !res.ok) return null;
  try {
    const body = (await res.json()) as { code?: string };
    return typeof body.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

/** Claims a pending invite by code. Returns true on success. */
export async function joinBuddy(accessToken: string, code: string): Promise<boolean> {
  const res = await post('/api/buddy/join', accessToken, { code });
  return res?.ok === true;
}

/** Ends the current pairing (either side may call it). Returns true on success. */
export async function unpairBuddy(accessToken: string): Promise<boolean> {
  const res = await post('/api/buddy/unpair', accessToken);
  return res?.ok === true;
}

/** Current pairing state + (once accepted) the buddy's today-focused minutes only. */
export async function fetchBuddyStatus(accessToken: string): Promise<BuddyStatus> {
  try {
    const res = await fetch('/api/buddy/status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return DEFAULT_BUDDY_STATUS;
    const body = (await res.json()) as Partial<BuddyStatus>;
    return {
      paired: body.paired === true,
      ...(typeof body.pendingCode === 'string' ? { pendingCode: body.pendingCode } : {}),
      ...(typeof body.todayMinutes === 'number' ? { todayMinutes: body.todayMinutes } : {}),
    };
  } catch {
    return DEFAULT_BUDDY_STATUS;
  }
}
