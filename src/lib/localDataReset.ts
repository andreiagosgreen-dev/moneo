import { markLandingSeen } from './landing';
import { isMoneoLocalKey } from './storage/moneoKeys';
import { deleteCustomSound } from './soundEngine';

/**
 * "Delete all data on this device": wipes every Moneo key from this
 * browser so the next load is a clean first run. Server/account data is
 * never touched here — account deletion has its own confirmed flow.
 */

export { isMoneoLocalKey };

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

/** Full local wipe: localStorage keys + the uploaded custom sound (IndexedDB).
 * The reload lands in an empty app, not on the first-visit landing page. */
export async function clearAllLocalData(): Promise<number> {
  const removed = clearMoneoLocalStorage();
  markLandingSeen();
  try {
    await deleteCustomSound();
  } catch {
    /* best-effort */
  }
  return removed;
}
