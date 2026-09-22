import type { SupabaseClient } from '@supabase/supabase-js';
import { readEnv } from './env';

/**
 * INERT Supabase foundation (Gate 7).
 *
 * Guarantees:
 * - Reads only publishable client env vars (VITE_SUPABASE_URL /
 *   VITE_SUPABASE_ANON_KEY). A service-role key must never appear in
 *   frontend env.
 * - Accepts both legacy JWT anon keys (`eyJ…`) and new publishable keys
 *   (`sb_publishable_…`) — no length/prefix gate beyond non-empty.
 * - Missing env never throws — Supabase is simply "not configured" and
 *   the local product works 100% unchanged (local-first principle).
 * - No network request happens at module load or app startup. The SDK is
 *   only pulled (lazily, via dynamic import) if a caller ever asks for a
 *   client AND env is configured.
 */

export type SupabaseConfig =
  { configured: true; url: string; anonKey: string } | { configured: false };

/** Strip dashboard paste leftovers like `/rest/v1` and trailing slashes. */
export function normalizeSupabaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1$/i, '');
  return url.replace(/\/+$/, '');
}

/** Never throws. Pure environment inspection. */
export function getSupabaseConfig(): SupabaseConfig {
  try {
    const urlRaw = readEnv().VITE_SUPABASE_URL;
    const anonKey = readEnv().VITE_SUPABASE_ANON_KEY;
    if (typeof urlRaw !== 'string' || typeof anonKey !== 'string') {
      return { configured: false };
    }
    const url = normalizeSupabaseUrl(urlRaw);
    const key = anonKey.trim();
    if (
      /^https?:\/\/.+/i.test(url) &&
      key.length > 0 &&
      !isPlaceholderSupabaseEnv(url, key)
    ) {
      return { configured: true, url, anonKey: key };
    }
  } catch {
    /* fall through */
  }
  return { configured: false };
}

/** .env.example paste leftovers must not look "configured" or hang auth boot. */
function isPlaceholderSupabaseEnv(url: string, anonKey: string): boolean {
  const u = url.toLowerCase();
  const k = anonKey.toLowerCase();
  if (u.includes('your-project') || u.includes('your_project')) return true;
  if (k.includes('your-anon') || k.includes('anon-key-here') || k === 'changeme') return true;
  // Do NOT treat `sb_publishable_…` or short opaque keys as placeholders.
  return false;
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Lazy, opt-in accessor. Returns null when unconfigured.
 * The dynamic import keeps the SDK out of the initial production bundle
 * until cloud functionality is actually used.
 * SDK/import failures are rethrown (not cached as null) so auth can show
 * a network/generic error instead of the misleading "not configured" copy.
 */
export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const cfg = getSupabaseConfig();
      if (!cfg.configured) return null;
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(cfg.url, cfg.anonKey);
    })().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}
