import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase";
import type { Settings } from "../store";
import type { RemoteSettingsRow } from "../sync/merge";

/**
 * User settings repository: authenticated CRUD primitives only.
 * Only synchronized preferences are stored — timer runtime state
 * (remaining, endsAt, snapshot) is deliberately device-local and never
 * leaves this browser.
 */

export interface CloudSettingsRow {
  user_id: string;
  focus_min: number;
  short_min: number;
  long_min: number;
  long_every: number;
  daily_goal: number;
  auto_start: boolean;
  sound: boolean;
  updated_at?: string;
}

export function toCloudSettingsRow(
  userId: string,
  s: Settings,
): CloudSettingsRow {
  return {
    user_id: userId,
    focus_min: s.focusMin,
    short_min: s.shortMin,
    long_min: s.longMin,
    long_every: s.longEvery,
    daily_goal: s.dailyGoal,
    auto_start: s.autoStart,
    sound: s.sound,
    updated_at: new Date(s.updatedAt ?? Date.now()).toISOString(),
  };
}

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

export function upsertSettings(
  userId: string,
  settings: Settings,
): Promise<boolean> {
  return withClient(async (client) => {
    const { error } = await client
      .from("user_settings")
      .upsert(toCloudSettingsRow(userId, settings), {
        onConflict: "user_id",
      });
    return !error;
  }).then((r) => r ?? false);
}

export function getSettings(userId: string): Promise<CloudSettingsRow | null> {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return error || !data ? null : ((data as CloudSettingsRow) ?? null);
  });
}

/** Transport-neutral pull; null covers both "no row yet" and failure —
 *  the engine distinguishes via the guaranteed session/area pulls. */
export async function pullSettingsRow(
  userId: string,
): Promise<RemoteSettingsRow | null> {
  const row = await getSettings(userId);
  if (!row) return null;
  return {
    focusMin: row.focus_min,
    shortMin: row.short_min,
    longMin: row.long_min,
    longEvery: row.long_every,
    dailyGoal: row.daily_goal,
    autoStart: row.auto_start,
    sound: row.sound,
    updatedAt: Date.parse(row.updated_at ?? "1970-01-01T00:00:00Z"),
  };
}
