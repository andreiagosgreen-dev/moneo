import { STORAGE_KEYS } from '../storage/storageKeys';
import { safeRead, safeRemove, safeWrite } from '../storage/storageAdapter';
import { runProSync, type ProSyncError, type ProSyncOutcome } from './proSyncEngine';
import { loadProSyncMeta } from './proSyncState';
import { loadSyncState } from './syncState';
import { runSync } from './syncEngine';
import { createLocalSyncIO, createSupabaseSyncRepos } from './syncRepos';

/**
 * Runs a Pro sync round (sessions/areas/settings via the Gate 9 engine, then
 * every planning store via the Pro engine), one at a time, and exposes a
 * tiny status store for the UI. Configured by `useProSync` while the user is
 * signed in, Pro and has sync turned on; otherwise every request is a no-op.
 */

export interface ProSyncStatus {
  phase: 'idle' | 'syncing';
  error: ProSyncError | null;
  lastSuccessAt: number | null;
}

export interface ProSyncConfig {
  userId: string;
  isPro: boolean;
  onApplied: (changedKeys: string[]) => void;
}

let status: ProSyncStatus = { phase: 'idle', error: null, lastSuccessAt: null };
let statusLoaded = false;
const listeners = new Set<() => void>();
let config: ProSyncConfig | null = null;
let inFlight: Promise<ProSyncOutcome | null> | null = null;
let again = false;

function setStatus(next: Partial<ProSyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((cb) => cb());
}

export function getProSyncStatus(): ProSyncStatus {
  if (!statusLoaded) {
    statusLoaded = true;
    status = { ...status, lastSuccessAt: loadProSyncMeta().lastSuccessAt };
  }
  return status;
}

export function subscribeProSyncStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function configureProSync(next: ProSyncConfig | null): void {
  config = next;
}

export function isProSyncConfigured(): boolean {
  return config !== null;
}

const localIO = {
  read: (key: string) => safeRead<unknown>(key),
  write: (key: string, value: unknown) => safeWrite(key, value),
  remove: (key: string) => safeRemove(key),
};

async function defaultRepos() {
  const { pullUserRecords, pushUserRecords } = await import('../cloud/recordRepository');
  return {
    pullRecords: pullUserRecords,
    pushRecords: (records: Parameters<typeof pushUserRecords>[0]) => pushUserRecords(records),
  };
}

async function runOnce(cfg: ProSyncConfig, adoptAccount: boolean): Promise<ProSyncOutcome> {
  const legacyKeys: string[] = [];
  if (loadSyncState().initialized) {
    const legacy = await runSync({
      userId: cfg.userId,
      consented: false,
      repos: createSupabaseSyncRepos(),
      local: createLocalSyncIO(),
    });
    if (legacy.adoptedSessions > 0 || legacy.conflicts > 0) legacyKeys.push(STORAGE_KEYS.history);
    if (legacy.settingsOp === 'applyRemote') legacyKeys.push(STORAGE_KEYS.settings);
    if (legacyKeys.length > 0) cfg.onApplied(legacyKeys);
  }
  return runProSync({
    userId: cfg.userId,
    isPro: cfg.isPro,
    syncEnabled: loadSyncState().initialized,
    adoptAccount,
    repos: await defaultRepos(),
    local: localIO,
    onApplied: cfg.onApplied,
  });
}

/**
 * Start a round now (or right after the one in flight). Resolves with the
 * outcome, or null when Pro sync is not active on this device.
 */
export function requestProSync(opts: { adoptAccount?: boolean } = {}): Promise<ProSyncOutcome | null> {
  const cfg = config;
  if (!cfg || !cfg.isPro) return Promise.resolve(null);
  if (inFlight) {
    again = true;
    return inFlight;
  }
  setStatus({ phase: 'syncing' });
  inFlight = (async () => {
    let result: ProSyncOutcome | null = null;
    try {
      do {
        again = false;
        const current = config;
        if (!current || !current.isPro) break;
        result = await runOnce(current, opts.adoptAccount === true);
      } while (again);
    } finally {
      inFlight = null;
      setStatus({
        phase: 'idle',
        error: result && !result.ok ? (result.error ?? 'push') : null,
        lastSuccessAt: result?.ok && result.at ? result.at : status.lastSuccessAt,
      });
    }
    return result;
  })();
  return inFlight;
}

/** Test hook: reset module state. */
export function __resetProSyncController(): void {
  status = { phase: 'idle', error: null, lastSuccessAt: null };
  statusLoaded = false;
  config = null;
  inFlight = null;
  again = false;
  listeners.clear();
}
