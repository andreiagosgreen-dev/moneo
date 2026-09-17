import type { SupabaseClient } from '@supabase/supabase-js';
import { readEnv } from './env';

/**
 * INERT Supabase foundation (Gate 7).
 *
 * Guarantees:
 * - Reads only publishable client env vars (VITE_SUPABASE_URL /
 *   VITE_SUPABASE_ANON_KEY). A service-role key must never appear in
 *   frontend env.
 * - Missing env never throws — Supabase is simply "not configured" and
 *   the local product works 100% unchanged (local-first principle).
 * - No network request happens at module load or app startup. The SDK is
 *   only pulled (lazily, via dynamic import) if a caller ever asks for a
 *   client AND env is configured.
 */

export type SupabaseConfig =
  { configured: true; url: string; anonKey: string } | { configured: false };

/** Never throws. Pure environment inspection. */
export function getSupabaseConfig(): SupabaseConfig {
  try {
    const url = readEnv().VITE_SUPABASE_URL;
    const anonKey = readEnv().VITE_SUPABASE_ANON_KEY;
    if (
      typeof url === 'string' &&
      /^https?:\/\/.+/i.test(url.trim()) &&
      typeof anonKey === 'string' &&
      anonKey.trim().length > 0
    ) {
      return { configured: true, url: url.trim(), anonKey: anonKey.trim() };
    }
  } catch {
    /* fall through */
  }
  return { configured: false };
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Lazy, opt-in accessor. Returns null when unconfigured.
 * The dynamic import keeps the SDK out of the initial production bundle
 * until cloud functionality is actually used.
 */
export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const cfg = getSupabaseConfig();
      if (!cfg.configured) return null;
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(cfg.url, cfg.anonKey);
    })().catch(() => null);
  }
  return clientPromise;
}
