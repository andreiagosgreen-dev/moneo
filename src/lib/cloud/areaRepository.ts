import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase";
import { sanitizeAreaName, type FocusArea } from "../focusAreas";
import type { RemoteAreaRow } from "../sync/merge";

/**
 * Focus area repository: authenticated CRUD primitives only.
 * Deletion is soft (deleted_at) so historical session references stay
 * resolvable; the database also enforces this via ON DELETE SET NULL.
 */

export interface CloudAreaRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at?: string;
  deleted_at: string | null;
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

export function insertArea(
  userId: string,
  name: string,
  id?: string,
): Promise<boolean> {
  const clean = sanitizeAreaName(name);
  if (!clean) return Promise.resolve(false);
  return withClient(async (client) => {
    const row: Record<string, unknown> = { user_id: userId, name: clean };
    if (id) row.id = id;
    const { error } = await client.from("focus_areas").insert(row);
    return !error;
  }).then((r) => r ?? false);
}

export function listAreas(userId: string): Promise<CloudAreaRow[] | null> {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("focus_areas")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    return error ? null : ((data as CloudAreaRow[]) ?? null);
  });
}

export function softDeleteArea(areaId: string): Promise<boolean> {
  return withClient(async (client) => {
    const { error } = await client
      .from("focus_areas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", areaId);
    return !error;
  }).then((r) => r ?? false);
}

/* ---------- sync primitives (Gate 9) ---------- */

/** Pull INCLUDING soft-deleted rows — deletion must merge, not vanish. */
export function pullAreasAll(userId: string): Promise<RemoteAreaRow[] | null> {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("focus_areas")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error || !data) return null;
    return (data as CloudAreaRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: Date.parse(r.created_at),
      updatedAt: Date.parse(r.updated_at ?? r.created_at),
      deletedAt: r.deleted_at ? Date.parse(r.deleted_at) : null,
    }));
  });
}

/** Chunked upsert by id; merge policy already guaranteed local-newer. */
export function pushAreaBatch(
  userId: string,
  areas: FocusArea[],
  chunkSize = 50,
): Promise<boolean> {
  if (areas.length === 0) return Promise.resolve(true);
  return withClient(async (client) => {
    for (let i = 0; i < areas.length; i += chunkSize) {
      const rows = areas.slice(i, i + chunkSize).map((a) => ({
        // Cloud identity is the stable cloudId (R1). Every area has one after
        // seeding/creation/migration, so upserts on this id never duplicate.
        id: a.cloudId ?? a.id,
        user_id: userId,
        name: a.name,
        created_at: new Date(a.createdAt).toISOString(),
        updated_at: new Date(a.updatedAt ?? a.createdAt).toISOString(),
        deleted_at:
          typeof a.deletedAt === "number"
            ? new Date(a.deletedAt).toISOString()
            : null,
      }));
      const { error } = await client
        .from("focus_areas")
        .upsert(rows, { onConflict: "id" });
      if (error) return false;
    }
    return true;
  }).then((r) => r ?? false);
}
