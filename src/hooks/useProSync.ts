import { useEffect, useRef, useSyncExternalStore } from 'react';
import { onStorageWrite } from '../lib/storage/storageAdapter';
import { PRO_SYNC_KEYS } from '../lib/sync/proCollections';
import { isApplyingRemote } from '../lib/sync/proSyncEngine';
import { markEdited } from '../lib/sync/proSyncState';
import {
  configureProSync,
  getProSyncStatus,
  requestProSync,
  subscribeProSyncStatus,
  type ProSyncStatus,
} from '../lib/sync/proSyncController';

/** Upload shortly after the user stops editing. */
export const PRO_SYNC_DEBOUNCE_MS = 4_000;
/** Pick up other devices' changes while the app stays open. */
export const PRO_SYNC_INTERVAL_MS = 5 * 60_000;
/** Returning to the tab re-syncs, but not more often than this. */
const FOCUS_MIN_GAP_MS = 30_000;

/**
 * Keeps a Pro user's planning data in step with their account while the app
 * is open: on start, a few seconds after local edits, when the network comes
 * back, when the tab becomes visible again and every few minutes.
 * Inactive (no listeners, no network) for guests, Free accounts and until
 * the user has turned sync on.
 */
export function useProSync(opts: {
  userId: string | null;
  isPro: boolean;
  syncEnabled: boolean;
  onApplied: (changedKeys: string[]) => void;
}): void {
  const { userId, isPro, syncEnabled } = opts;
  const onAppliedRef = useRef(opts.onApplied);
  onAppliedRef.current = opts.onApplied;

  useEffect(() => {
    if (!userId || !isPro || !syncEnabled) {
      configureProSync(null);
      return;
    }
    configureProSync({ userId, isPro, onApplied: (keys) => onAppliedRef.current(keys) });

    let lastRun = 0;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      lastRun = Date.now();
      void requestProSync();
    };
    const offWrite = onStorageWrite(PRO_SYNC_KEYS, (key) => {
      if (isApplyingRemote()) return;
      markEdited(key, Date.now());
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(run, PRO_SYNC_DEBOUNCE_MS);
    });
    const onOnline = () => run();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRun > FOCUS_MIN_GAP_MS) run();
    };
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, PRO_SYNC_INTERVAL_MS);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    run();

    return () => {
      offWrite();
      if (debounce) clearTimeout(debounce);
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      configureProSync(null);
    };
  }, [userId, isPro, syncEnabled]);
}

export function useProSyncStatus(): ProSyncStatus {
  return useSyncExternalStore(subscribeProSyncStatus, getProSyncStatus, getProSyncStatus);
}
