import { pullAllSessions, pushSessionBatch } from '../cloud/sessionRepository';
import { pullAreasAll, pushAreaBatch } from '../cloud/areaRepository';
import { pullSettingsRow, upsertSettings } from '../cloud/settingsRepository';
import type { SyncLocalIO, SyncRepos } from './syncEngine';
import { loadHistory, loadSettings, saveHistory, saveSettings } from '../store';
import { loadFocusAreas, saveFocusAreas } from '../focusAreas';

/**
 * Supabase-backed repo adapter. Statically safe to import — the SDK itself
 * is only pulled lazily inside getSupabaseClient when actually configured.
 */
export function createSupabaseSyncRepos(): SyncRepos {
  return {
    pullSessions: (userId) => pullAllSessions(userId),
    pushSessions: (userId, sessions) => pushSessionBatch(userId, sessions),
    pullAreas: (userId) => pullAreasAll(userId),
    pushAreas: (userId, areas) => pushAreaBatch(userId, areas),
    pullSettings: (userId) => pullSettingsRow(userId),
    pushSettings: (userId, settings) => upsertSettings(userId, settings),
  };
}

/** Local storage adapter — every write goes through the safe adapter. */
export function createLocalSyncIO(): SyncLocalIO {
  return {
    readHistory: loadHistory,
    writeHistory: saveHistory,
    readAreas: loadFocusAreas,
    writeAreas: saveFocusAreas,
    readSettings: loadSettings,
    writeSettings: saveSettings,
  };
}
