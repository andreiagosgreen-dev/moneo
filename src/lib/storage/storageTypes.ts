/**
 * Future cloud data contracts.
 *
 * These describe how Moneo entities will map onto a Supabase schema in a
 * later gate. They are NOT the current local persisted shapes — local
 * storage keeps its existing backward-compatible payloads (`Session`,
 * `Settings`, `FocusArea` in their modules) until an explicit migration
 * gate says otherwise.
 *
 * Privacy principle: anonymous local data (intentions, area names, focus
 * timestamps) stays device-local. Nothing is transmitted without explicit
 * first-sync consent.
 */

/** Future `user_settings` row. */
export interface UserSettings {
  userId?: string;
  focusMin: number;
  shortMin: number;
  longMin: number;
  longEvery: number;
  dailyGoal: number;
  autoStart: boolean;
  sound: boolean;
  /** IANA timezone, e.g. "Europe/Chisinau". See src/lib/timezone.ts. */
  timezone?: string;
}

/**
 * Future `focus_sessions` row.
 *
 * Session identity strategy (decided Gate 7/8): stable ids are assigned to
 * new completions at creation and backfilled once for legacy entries —
 * never incrementally on history load — so identity is stable and legacy
 * entries are never rewritten piecemeal.
 */
export interface FocusSession {
  id?: string;
  userId?: string;
  /** Absolute epoch ms — never local-time strings. */
  completedAt: number;
  durationMin: number;
  intention?: string;
  areaId?: string;
}

/** Future `focus_areas` row. */
export interface FocusAreaEntity {
  id: string;
  userId?: string;
  name: string;
  createdAt: number;
}
