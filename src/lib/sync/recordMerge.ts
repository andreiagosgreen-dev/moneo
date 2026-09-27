/**
 * Pro full-data sync — pure per-record merge planning.
 *
 * Each device remembers, per record, the hash and timestamp of the version it
 * last agreed on with the account (`RecordMeta`). Comparing the current local
 * value with that memory tells us what changed locally (new, edited or
 * removed) without the product stores having to carry timestamps.
 *
 * Rules:
 * - Last write wins per record on `t` (epoch ms of the edit). A strictly
 *   newer remote version replaces the local one; a tie with different
 *   content resolves to the remote copy (the same convention as focus areas).
 * - Removals become tombstones so other devices remove the record too.
 * - First sync of a collection on a device: union of both sides; where the
 *   same record exists on both, the account copy wins (a device that never
 *   synced cannot know its copy is newer — typically untouched defaults).
 * - Local changes are stamped with the collection's last local edit time
 *   (never in the future, always after the previously agreed version).
 */

export interface RecordMeta {
  /** Hash of the agreed content ('' for a tombstone). */
  h: string;
  /** Edit timestamp (epoch ms) of the agreed version. */
  t: number;
  /** Tombstone. */
  d?: true;
  /** Local version not yet accepted by the account. */
  p?: true;
}

export type CollectionMeta = Record<string, RecordMeta>;

export interface RemoteRecord {
  collection: string;
  recordId: string;
  data: unknown;
  deleted: boolean;
  updatedAt: number;
  /** Server clock (ISO); used only as the incremental pull cursor. */
  serverUpdatedAt: string;
}

export interface PushRecord {
  collection: string;
  record_id: string;
  data: unknown;
  deleted: boolean;
  updated_at: number;
}

export interface CollectionPlan {
  /** Remote versions to write locally. */
  upserts: Map<string, unknown>;
  /** Records to remove locally (remote tombstones). */
  deletes: Set<string>;
  /** Local versions the account does not have yet. */
  push: PushRecord[];
  /** Next device memory for this collection (pushed entries keep `p`). */
  meta: CollectionMeta;
  /** Records edited on both sides since the last agreement. */
  conflicts: number;
}

/** Deterministic JSON: object keys sorted, so equal content hashes equally. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** 53-bit content hash (cyrb53) — change detection, not security. Never ''. */
export function hashValue(value: unknown): string {
  const str = stableStringify(value);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function planCollection(opts: {
  collection: string;
  local: Map<string, unknown>;
  /** undefined = this collection never synced on this device. */
  meta: CollectionMeta | undefined;
  remote: RemoteRecord[];
  /** Last local edit time of the store (falls back to now). */
  editedAt: number | undefined;
  now: number;
}): CollectionPlan {
  const { collection, local, remote, now } = opts;
  const first = opts.meta === undefined;
  const meta: CollectionMeta = { ...(opts.meta ?? {}) };
  const editedAt = Math.min(opts.editedAt ?? now, now);
  const stamp = (prev: RecordMeta | undefined) => Math.max((prev?.t ?? 0) + 1, editedAt);

  const remoteById = new Map<string, RemoteRecord>();
  for (const r of remote) {
    const prev = remoteById.get(r.recordId);
    if (!prev || r.updatedAt >= prev.updatedAt) remoteById.set(r.recordId, r);
  }

  const localHash = new Map<string, string>();
  const hashOf = (id: string) => {
    let h = localHash.get(id);
    if (h === undefined) localHash.set(id, (h = hashValue(local.get(id))));
    return h;
  };

  // 1. What changed locally since the last agreement.
  const changedLocally = new Set<string>();
  for (const id of local.keys()) {
    const prev = meta[id];
    if (first) {
      if (remoteById.has(id)) continue; // overlap on first sync: the account copy decides
      meta[id] = { h: hashOf(id), t: stamp(undefined), p: true };
      changedLocally.add(id);
    } else if (!prev || prev.d || prev.h !== hashOf(id)) {
      meta[id] = { h: hashOf(id), t: stamp(prev), p: true };
      changedLocally.add(id);
    }
  }
  if (!first) {
    for (const [id, prev] of Object.entries(meta)) {
      if (!local.has(id) && !prev.d) {
        meta[id] = { h: '', t: stamp(prev), d: true, p: true };
        changedLocally.add(id);
      }
    }
  }

  // 2. Fold in the account's versions.
  const upserts = new Map<string, unknown>();
  const deletes = new Set<string>();
  let conflicts = 0;
  for (const r of remoteById.values()) {
    const id = r.recordId;
    const cur = meta[id];
    const rh = r.deleted ? '' : hashValue(r.data);
    const sameContent = !!cur && cur.h === rh && !!cur.d === r.deleted;
    let remoteWins: boolean;
    if (!cur) remoteWins = true;
    else if (r.updatedAt > cur.t) remoteWins = true;
    else if (r.updatedAt < cur.t) remoteWins = false;
    else remoteWins = !sameContent;

    if (remoteWins) {
      if (changedLocally.has(id) && !sameContent) conflicts++;
      if (r.deleted) {
        if (local.has(id)) deletes.add(id);
      } else if (!local.has(id) || hashOf(id) !== rh) {
        upserts.set(id, r.data);
      }
      meta[id] = r.deleted ? { h: '', t: r.updatedAt, d: true } : { h: rh, t: r.updatedAt };
    } else if (!cur.p && !sameContent) {
      // The account holds an older version than we agreed on — resend ours.
      meta[id] = { ...cur, p: true };
    }
  }

  // 3. Everything still pending goes up.
  const push: PushRecord[] = [];
  for (const [id, m] of Object.entries(meta)) {
    if (!m.p) continue;
    if (m.d) {
      push.push({ collection, record_id: id, data: null, deleted: true, updated_at: m.t });
    } else if (local.has(id)) {
      push.push({
        collection,
        record_id: id,
        data: local.get(id),
        deleted: false,
        updated_at: m.t,
      });
    }
  }

  return { upserts, deletes, push, meta, conflicts };
}
