/* Advanced planning visibility (progress companion simplification).
 *
 * Kanban, Sprints, Gantt and Waterfall stay fully functional but sit behind
 * one explicit toggle, off by default for new users. Users who already have
 * agile data (any sprint or waterfall phase) keep the tabs visible — the
 * simplification must never hide someone's existing workflow.
 * Local only, never synced. Never throws.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { loadSprints } from './sprints';
import { loadPhases } from './waterfall';

/** True when the workspace already holds agile data worth keeping visible. */
export function hasAgileData(): boolean {
  try {
    if (loadSprints().length > 0) return true;
    if (loadPhases().length > 0) return true;
    return false;
  } catch {
    return false;
  }
}

/** Explicit choice wins; otherwise engaged users keep tabs, new users start clean. */
export function loadAdvancedPlanning(): boolean {
  const stored = read<unknown>(STORAGE_KEYS.advancedPlanning);
  if (typeof stored === 'boolean') return stored;
  return hasAgileData();
}

export function saveAdvancedPlanning(visible: boolean): boolean {
  return write(STORAGE_KEYS.advancedPlanning, visible);
}
