/**
 * Ask the browser to keep Moneo's local data (Storage API `persist()`).
 *
 * Without it, Safari may clear a site's storage after 7 days without a visit
 * and any browser may evict it under disk pressure — on the Free plan that is
 * the only copy. Asked once, after the person has something worth keeping
 * (Firefox shows a prompt, so never on the very first visit). Never throws.
 */

import { safeRead, safeWrite } from './storageAdapter';
import { STORAGE_KEYS } from './storageKeys';

type StorageManagerLike = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined = typeof navigator !== 'undefined'
    ? (navigator.storage as StorageManagerLike | undefined)
    : undefined,
): Promise<'persisted' | 'denied' | 'unsupported' | 'skipped'> {
  if (!storage?.persist) return 'unsupported';
  try {
    if (storage.persisted && (await storage.persisted())) return 'persisted';
    if (safeRead<boolean>(STORAGE_KEYS.persistAsked)) return 'skipped';
    safeWrite(STORAGE_KEYS.persistAsked, true);
    return (await storage.persist()) ? 'persisted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
