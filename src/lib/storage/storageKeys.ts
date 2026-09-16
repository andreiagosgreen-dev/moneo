/**
 * The authoritative registry of Moneo product storage keys.
 *
 * Contract:
 * - Legacy `solanum:*` keys are intentionally NOT renamed — existing users'
 *   data must keep loading (backward compatibility gate requirement).
 * - New product keys use the `moneo:*` namespace.
 * - Tests pin these exact values; changing one is a deliberate migration
 *   decision, never an accident.
 */

export const STORAGE_KEYS = {
  /** User timer settings (legacy namespace, preserved). */
  settings: 'solanum:settings',
  /** Completed focus sessions (legacy namespace, preserved). */
  history: 'solanum:history',
  /** Paused timer position for reload restoration (legacy, preserved). */
  snapshot: 'solanum:snapshot',
  /** Unsaved intention draft text (small UX persistence). */
  intentionDraft: 'moneo:intention-draft',
  /** User's Focus Areas. */
  focusAreas: 'moneo:focus-areas',
  /** Currently selected Focus Area id. */
  selectedFocusArea: 'moneo:selected-focus-area',
  /** User's Projects. */
  projects: 'moneo:projects',
  /** Currently selected Project id. */
  selectedProject: 'moneo:selected-project',
  /** Installation-level storage schema marker (Gate 7). */
  schemaVersion: 'moneo:schema-version',
  /** Sync meta version, initialized, lastSuccessfulSyncAt, deviceId (Gate 9). */
  syncState: 'moneo:sync-state',
  /** Email notification preferences (daily summary, focus reminder). */
  notificationPrefs: 'moneo:notification-prefs',
  /** Tasks belonging to projects (Phase 2 project cabinet). */
  tasks: 'moneo:tasks',
  /** Ivy Lee daily plans (Phase 3 weekly ritual). */
  ivyPlans: 'moneo:ivy-plans',
  /** Time blocking recurring blocks (Phase 3 weekly calendar). */
  timeBlocks: 'moneo:time-blocks',
  /** Appearance preferences (Premium Polish, Week 10). */
  theme: 'moneo:ui-theme',
  /** First-run onboarding dismissed flag (Premium Polish, Week 10). */
  onboardingSeen: 'moneo:onboarding-seen',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
