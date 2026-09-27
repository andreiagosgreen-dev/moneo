import { STORAGE_KEYS } from './storageKeys';

const MONEO_PREFIXES = ['moneo:', 'moneo.', 'solanum:'];

/** Device preferences, not user data: they survive "Delete all data on this
 * device" and never make a browser count as an existing Moneo user. */
const DEVICE_PREFERENCE_KEYS: ReadonlySet<string> = new Set([
  STORAGE_KEYS.locale,
  STORAGE_KEYS.landingSeen,
]);

/** True for every key Moneo stores as user data in this browser. */
export function isMoneoLocalKey(key: string): boolean {
  if (DEVICE_PREFERENCE_KEYS.has(key)) return false;
  return MONEO_PREFIXES.some((p) => key.startsWith(p));
}
