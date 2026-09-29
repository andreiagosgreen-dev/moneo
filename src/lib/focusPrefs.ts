/* Focus session preferences: ambient sound and wake lock. Local only, never synced. */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { sanitizeLayers, type AmbientLayer } from './ambient';

export interface FocusPrefs {
  /** null = follow the atmosphere's default sound. */
  ambient: AmbientLayer[] | null;
  ambientOn: boolean;
  wakeLock: boolean;
}

export const DEFAULT_FOCUS_PREFS: FocusPrefs = { ambient: null, ambientOn: false, wakeLock: true };

export function loadFocusPrefs(): FocusPrefs {
  const raw = read<Partial<FocusPrefs>>(STORAGE_KEYS.focusPrefs);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FOCUS_PREFS };
  const layers = Array.isArray(raw.ambient) ? sanitizeLayers(raw.ambient, true) : [];
  return {
    ambient: layers.length > 0 ? layers : null,
    ambientOn: raw.ambientOn === true,
    wakeLock: raw.wakeLock !== false,
  };
}

export function saveFocusPrefs(p: FocusPrefs): boolean {
  return write(STORAGE_KEYS.focusPrefs, p);
}
