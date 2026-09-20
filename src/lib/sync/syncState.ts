import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead, safeWrite } from '../storage/storageAdapter';

/**
 * Sync metadata (Gate 9) — deliberately separate from user content.
 * NEVER stores auth secrets or tokens.
 *
 * { version, initialized, lastSuccessfulSyncAt, deviceId }
 *
 * - `initialized` flips only after a COMPLETE, successful first sync.
 * - `deviceId` is a stable UUID identifying this device for sync —
 *   no fingerprinting, no hardware/browser feature collection.
 */

export const SYNC_STATE_VERSION = 1;

export interface SyncState {
  version: number;
  initialized: boolean;
  lastSuccessfulSyncAt: number | null;
  deviceId: string;
}

const KEY = STORAGE_KEYS.syncState;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newDeviceId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to local fallback */
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function isValidDeviceId(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

const listeners = new Set<() => void>();

export function onSyncStateChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  listeners.forEach((cb) => cb());
}

function defaultState(): SyncState {
  return {
    version: SYNC_STATE_VERSION,
    initialized: false,
    lastSuccessfulSyncAt: null,
    deviceId: newDeviceId(),
  };
}

/** Defensive load: corrupt JSON falls back calmly; a recoverable deviceId
 *  is regenerated, other fields survive field-by-field validation. */
export function loadSyncState(): SyncState {
  const parsed = safeRead<Partial<SyncState>>(KEY);
  if (!parsed || typeof parsed !== 'object') {
    const fresh = defaultState();
    saveSyncState(fresh);
    return fresh;
  }
  const state: SyncState = {
    version:
      typeof parsed.version === 'number' && Number.isFinite(parsed.version)
        ? parsed.version
        : SYNC_STATE_VERSION,
    initialized: parsed.initialized === true,
    lastSuccessfulSyncAt:
      typeof parsed.lastSuccessfulSyncAt === 'number' &&
      Number.isFinite(parsed.lastSuccessfulSyncAt)
        ? parsed.lastSuccessfulSyncAt
        : null,
    deviceId: isValidDeviceId(parsed.deviceId) ? parsed.deviceId : newDeviceId(),
  };
  return state;
}

export function saveSyncState(state: SyncState): boolean {
  const ok = safeWrite(KEY, state);
  if (ok) notify();
  return ok;
}

/** Stable device identity — generated once, never per boot. */
export function getOrCreateDeviceId(): string {
  const state = loadSyncState();
  return state.deviceId;
}

/** Advance ONLY after a fully successful sync run. */
export function markSyncSuccess(at: number): SyncState | null {
  const state = loadSyncState();
  const next: SyncState = {
    ...state,
    initialized: true,
    lastSuccessfulSyncAt: at,
  };
  return saveSyncState(next) ? next : null;
}
