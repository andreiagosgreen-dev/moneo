import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase";
import type { Session } from "../store";
import type { RemoteSessionRow } from "../sync/merge";

/**
 * Focus session repository: authenticated CRUD primitives only.
 * NOT wired to any automatic upload — signing in transfers nothing.
 * The user-visible sync flow requires explicit first-sync consent.
 */

export interface CloudSessionRow {
  id: string;
  user_id: string;
  /** ISO-8601 of the absolute completed-at timestamp. */
  completed_at: string;
  duration_min: number;
  intention: string | null;
  area_id: string | null;
}

/**
 * Local → cloud row mapping.
 * NOTE: locally seeded areas use non-uuid ids ("area:work"); the sync
 * mapping nulls non-uuid area ids (cloud FK expects uuid). A dedicated
 * area-id migration remains deferred work.
 */
export function toCloudSessionRow(
  userId: string,
  session: Session & { id: string },
): CloudSessionRow {
  const isUuid =
    typeof session.areaId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      session.areaId,
    );
  return {
    id: session.id,
    user_id: userId,
    completed_at: new Date(session.at).toISOString(),
    duration_min: session.min,
    intention: session.intention ?? null,
    area_id: session.areaId && isUuid ? session.areaId : null,
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

export function insertSession(row: CloudSessionRow): Promise<boolean> {
  return withClient(async (client) => {
    const { error } = await client.from("focus_sessions").insert(row);
    return !error;
  }).then((r) => r ?? false);
}

export function listSessions(
  userId: string,
  limit = 500,
): Promise<CloudSessionRow[] | null> {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("focus_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(limit);
    return error ? null : ((data as CloudSessionRow[]) ?? null);
  });
}

/* ---------- sync primitives (Gate 9) ---------- */

/** Cap until paginated pulls are added (deferred work; documented). */
const PULL_CAP = 20_000;

/** Pull all of the user's sessions as transport-neutral rows. */
export async function pullAllSessions(
  userId: string,
): Promise<RemoteSessionRow[] | null> {
  const rows = await listSessions(userId, PULL_CAP);
  if (!rows) return null;
  return rows.map((r) => ({
    id: r.id,
    at: Date.parse(r.completed_at),
    min: r.duration_min,
    intention: r.intention,
    areaId: r.area_id,
  }));
}

/**
 * Idempotent batched push: upsert by id, ignoring duplicates.
 * ≤100 rows per request; merge policy already decided what to send.
 */
export function pushSessionBatch(
  userId: string,
  sessions: Array<{
    id: string;
    at: number;
    min: number;
    intention?: string;
    areaId?: string;
  }>,
  chunkSize = 100,
): Promise<boolean> {
  if (sessions.length === 0) return Promise.resolve(true);
  return withClient(async (client) => {
    for (let i = 0; i < sessions.length; i += chunkSize) {
      const rows = sessions
        .slice(i, i + chunkSize)
        .map((s) => toCloudSessionRow(userId, s as Session & { id: string }));
      const { error } = await client
        .from("focus_sessions")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) return false;
    }
    return true;
  }).then((r) => r ?? false);
}
