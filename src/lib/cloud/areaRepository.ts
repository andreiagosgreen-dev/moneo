import { withClient } from './withClient';
import type { FocusArea } from '../focusAreas';
import type { RemoteAreaRow } from '../sync/merge';

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

export function softDeleteArea(userId: string, areaId: string): Promise<boolean> {
  return withClient(async (client) => {
    const now = new Date().toISOString();
    const { error } = await client
      .from('focus_areas')
      .update({ deleted_at: now, updated_at: now })
      .eq('user_id', userId)
      .eq('id', areaId);
    return !error;
  }).then((r) => r ?? false);
}

/* ---------- sync primitives (Gate 9) ---------- */

/** Pull INCLUDING soft-deleted rows — deletion must merge, not vanish. */
export function pullAreasAll(userId: string): Promise<RemoteAreaRow[] | null> {
  return withClient(async (client) => {
    const { data, error } = await client
      .from('focus_areas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
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

/** Chunked upsert by (user_id, id); UUIDs are account-relative (R4A). */
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
        deleted_at: typeof a.deletedAt === 'number' ? new Date(a.deletedAt).toISOString() : null,
      }));
      const { error } = await client.from('focus_areas').upsert(rows, { onConflict: 'user_id,id' });
      if (error) return false;
    }
    return true;
  }).then((r) => r ?? false);
}
