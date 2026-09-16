import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase';
import { isValidIanaTimezone } from '../timezone';

/**
 * Profile repository: authenticated CRUD primitives only.
 * Every call is opt-in, lazily resolves the Supabase client, and returns
 * a calm null/false when unconfigured or unreachable — never throws.
 */

async function withClient<T>(fn: (client: SupabaseClient) => Promise<T>): Promise<T | null> {
  const client = await getSupabaseClient();
  if (!client) return null;
  try {
    return await fn(client);
  } catch {
    return null;
  }
}

/**
 * Idempotent profile bootstrap: insert-if-absent.
 * An existing saved timezone is NEVER overwritten (onConflict ignores
 * duplicates), so logins do not clobber user choices.
 */
export function ensureProfile(userId: string, timezone: string): Promise<boolean> {
  const tz = isValidIanaTimezone(timezone) ? timezone : 'UTC';
  return withClient(async (client) => {
    const { error } = await client
      .from('profiles')
      .upsert({ user_id: userId, timezone: tz }, { onConflict: 'user_id', ignoreDuplicates: true });
    return !error;
  }).then((r) => r ?? false);
}

/** Stored profile timezone, or null when absent/unreadable. */
export function getProfileTimezone(userId: string): Promise<string | null> {
  return withClient(async (client) => {
    const { data, error } = await client
      .from('profiles')
      .select('timezone')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    const tz = (data as { timezone?: unknown }).timezone;
    return typeof tz === 'string' && tz.length > 0 ? tz : null;
  }).then((r) => r ?? null);
}

/**
 * Deletes all user data from the database: focus_sessions, focus_areas, and profile.
 * Returns true if deletion succeeded, false otherwise.
 */
export function deleteUserData(userId: string): Promise<boolean> {
  return withClient(async (client) => {
    // Delete sessions first (they reference areas)
    const { error: sessionsError } = await client
      .from('focus_sessions')
      .delete()
      .eq('user_id', userId);

    if (sessionsError) return false;

    // Delete focus areas
    const { error: areasError } = await client.from('focus_areas').delete().eq('user_id', userId);

    if (areasError) return false;

    // Delete profile
    const { error: profileError } = await client.from('profiles').delete().eq('user_id', userId);

    return !profileError;
  }).then((r) => r ?? false);
}
