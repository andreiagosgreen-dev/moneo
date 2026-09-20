import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase';
import { captureError } from '../sentry';

/**
 * Shared cloud guard (Roadmap Faza 1.1).
 *
 * Single copy of the pattern previously quadruplicated across the cloud
 * repositories: resolve the lazily-loaded Supabase client, run the query,
 * and calmly resolve null when unconfigured or unreachable — never throws.
 * The client factory is injectable so the helper itself is unit-testable;
 * production call sites keep the default and stay unchanged.
 */
export async function withClient<T>(
  fn: (client: SupabaseClient) => Promise<T>,
  getClient: () => Promise<SupabaseClient | null> = getSupabaseClient,
): Promise<T | null> {
  const client = await getClient();
  if (!client) return null;
  try {
    return await fn(client);
  } catch (e) {
    captureError(e, { area: 'cloud-sync' });
    return null;
  }
}
