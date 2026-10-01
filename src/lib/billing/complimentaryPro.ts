/**
 * Complimentary (gifted) Pro — client side.
 *
 * The allowlist of email addresses lives only on the Worker
 * (`cloudflare/workers/complimentaryPro.ts` + `PRO_COMPLIMENTARY_EMAILS`), so
 * no address ever ships in the public bundle. The client asks
 * `GET /api/account/entitlement` for one boolean about the signed-in account
 * and remembers the last answer per user so gifted Pro also works offline.
 */

import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead, safeWrite } from '../storage/storageAdapter';

interface Cached {
  userId: string;
  complimentary: boolean;
}

/** Last known answer for this user (false for anyone else or when unknown). */
export function loadComplimentaryCache(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const c = safeRead<Cached>(STORAGE_KEYS.complimentaryPro);
  return !!c && c.userId === userId && c.complimentary === true;
}

export function saveComplimentaryCache(userId: string, complimentary: boolean): void {
  safeWrite(STORAGE_KEYS.complimentaryPro, { userId, complimentary });
}

/**
 * Ask the Worker. `null` = unknown (signed out, offline, not configured) —
 * callers keep the cached value instead of revoking Pro on a network blip.
 */
export async function fetchComplimentaryPro(
  getAccessToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<boolean | null> {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetchFn('/api/account/entitlement', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { complimentary?: unknown };
    return typeof body.complimentary === 'boolean' ? body.complimentary : null;
  } catch {
    return null;
  }
}

/** Paid Lemon access OR gifted Pro → Pro entitlements. */
export function resolveIsPro(paidIsPro: boolean, complimentary: boolean): boolean {
  return paidIsPro || complimentary;
}

/** Every `useAuth()` consumer refreshes on focus; share one request per user per minute. */
let shared: { userId: string; at: number; result: Promise<boolean | null> } | null = null;

export function fetchComplimentaryProShared(
  userId: string,
  getAccessToken: () => Promise<string | null>,
  now: number = Date.now(),
): Promise<boolean | null> {
  if (shared && shared.userId === userId && now - shared.at < 60_000) return shared.result;
  const result = fetchComplimentaryPro(getAccessToken);
  shared = { userId, at: now, result };
  return result;
}
