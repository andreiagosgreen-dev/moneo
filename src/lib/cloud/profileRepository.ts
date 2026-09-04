import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase";
import { isValidIanaTimezone } from "../timezone";

/**
 * Profile repository: authenticated CRUD primitives only.
 * Every call is opt-in, lazily resolves the Supabase client, and returns
 * a calm null/false when unconfigured or unreachable — never throws.
 */

async function withClient<T>(
  fn: (client: SupabaseClient) => Promise<T>,
): Promise<T | null> {
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
  const tz = isValidIanaTimezone(timezone) ? timezone : "UTC";
  return withClient(async (client) => {
    const { error } = await client.from("profiles").upsert(
      { user_id: userId, timezone: tz },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    return !error;
  }).then((r) => r ?? false);
}

/** Stored profile timezone, or null when absent/unreadable. */
export function getProfileTimezone(userId: string): Promise<string | null> {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("profiles")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const tz = (data as { timezone?: unknown }).timezone;
    return typeof tz === "string" && tz.length > 0 ? tz : null;
  }).then((r) => r ?? null);
}
