import { STORAGE_KEYS } from './storage/storageKeys';
import { deleteCustomSound } from './soundEngine';

/**
 * "Delete all data on this device": wipes every Moneo key from this
 * browser so the next load is a clean first run. Server/account data is
 * never touched here — account deletion has its own confirmed flow.
 */

const MONEO_PREFIXES = ['moneo:', 'moneo.', 'solanum:'];

/** Interface language is a device preference, not user data. */
const KEEP_KEYS: ReadonlySet<string> = new Set([STORAGE_KEYS.locale]);

export function isMoneoLocalKey(key: string): boolean {
  if (KEEP_KEYS.has(key)) return false;
  return MONEO_PREFIXES.some((p) => key.startsWith(p));
}

/** Removes every Moneo key from `storage`. Returns how many were removed. Never throws. */
export function clearMoneoLocalStorage(storage?: Storage): number {
  let removed = 0;
  try {
    const target = storage ?? localStorage;
    const keys: string[] = [];
    for (let i = 0; i < target.length; i++) {
      const key = target.key(i);
      if (key !== null && isMoneoLocalKey(key)) keys.push(key);
    }
    for (const key of keys) {
      target.removeItem(key);
      removed++;
    }
  } catch {
    /* storage unavailable — nothing to clear */
  }
  return removed;
}

/** Full local wipe: localStorage keys + the uploaded custom sound (IndexedDB). */
export async function clearAllLocalData(): Promise<number> {
  const removed = clearMoneoLocalStorage();
  try {
    await deleteCustomSound();
  } catch {
    /* best-effort */
  }
  return removed;
}
