import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead, safeWrite } from '../storage/storageAdapter';
import type { CollectionMeta } from './recordMerge';

/**
 * Pro full-data sync bookkeeping for THIS device — never user content,
 * never exported, never tokens.
 *
 * - `userId`: the account these records were agreed with. A different
 *   account signing in on this device does not silently receive them.
 * - `cursor`: newest server timestamp already pulled (incremental pulls).
 * - `collections`: per-record agreed hash/time (see recordMerge.ts).
 * - `lastSuccessAt`: last complete run — also marks "this device used Pro
 *   sync before", which the UI uses to explain a lapsed subscription.
 */
export interface ProSyncMeta {
  version: 1;
  userId: string | null;
  cursor: string | null;
  lastSuccessAt: number | null;
  collections: Record<string, CollectionMeta>;
}

const KEY = STORAGE_KEYS.proSync;
const EDITS_KEY = STORAGE_KEYS.proSyncEdits;

export function emptyProSyncMeta(): ProSyncMeta {
  return { version: 1, userId: null, cursor: null, lastSuccessAt: null, collections: {} };
}

function isRecordMeta(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return typeof m.h === 'string' && typeof m.t === 'number' && Number.isFinite(m.t);
}

/** Defensive load: anything malformed is dropped (worst case = a first-sync union). */
export function loadProSyncMeta(): ProSyncMeta {
  const raw = safeRead<Partial<ProSyncMeta>>(KEY);
  if (!raw || typeof raw !== 'object') return emptyProSyncMeta();
  const collections: Record<string, CollectionMeta> = {};
  if (raw.collections && typeof raw.collections === 'object') {
    for (const [name, records] of Object.entries(raw.collections)) {
      if (!records || typeof records !== 'object') continue;
      const clean: CollectionMeta = {};
      for (const [id, m] of Object.entries(records)) if (isRecordMeta(m)) clean[id] = m;
      collections[name] = clean;
    }
  }
  return {
    version: 1,
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    cursor: typeof raw.cursor === 'string' ? raw.cursor : null,
    lastSuccessAt:
      typeof raw.lastSuccessAt === 'number' && Number.isFinite(raw.lastSuccessAt)
        ? raw.lastSuccessAt
        : null,
    collections,
  };
}

export function saveProSyncMeta(meta: ProSyncMeta): boolean {
  return safeWrite(KEY, meta);
}

export function loadEditTimes(): Record<string, number> {
  const raw = safeRead<Record<string, unknown>>(EDITS_KEY);
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export function markEdited(storageKey: string, at: number): void {
  const edits = loadEditTimes();
  edits[storageKey] = at;
  safeWrite(EDITS_KEY, edits);
}
