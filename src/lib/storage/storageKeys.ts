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
  /** Focus atmosphere: hartie, sanctuar, clar, ritual. Local only. */
  atmosphere: 'moneo:atmosphere',
  /** First-run onboarding dismissed flag (Premium Polish, Week 10). */
  onboardingSeen: 'moneo:onboarding-seen',
  /** Technical skills inventory (Roadmap Phase 1.2). */
  skills: 'moneo:skills',
  /** Deadline reminder stamps, projectId → day key (Roadmap 2.4). */
  deadlineReminders: 'moneo:deadline-reminders',
  /** Eat-the-Frog log, day key → { taskId, done } (Roadmap 3.2). */
  frogLog: 'moneo:frog-log',
  /** Goal hierarchy (Roadmap Phase 4.2). */
  goals: 'moneo:goals',
  /** Assistant conversation history, capped (Roadmap Phase 4.1). */
  chatHistory: 'moneo:chat-history',
  /** Habits inventory (Roadmap Phase 5.1). */
  habits: 'moneo:habits',
  /** Habit completions, habitId → day keys (Roadmap Phase 5.1). */
  habitLog: 'moneo:habit-log',
  /** Life areas + balance targets (Roadmap Phase 5.2). */
  lifeAreas: 'moneo:life-areas',
  /** Journal entries, day key → entry (Roadmap Phase 5.3). */
  journal: 'moneo:journal',
  /** Energy check-ins (Roadmap Phase 5.4). */
  energyLog: 'moneo:energy-log',
  /** Planned days off as day keys (Roadmap Phase 5.5). */
  timeOff: 'moneo:time-off',
  /** Assistant personality (Roadmap Phase 4.1). */
  assistantTone: 'moneo:assistant-tone',
  /** Dismissed insight ids — user feedback memory (Roadmap 3.5). */
  insightsDismissed: 'moneo:insights-dismissed',
  /** Agile sprints (Roadmap Phase 7.2). */
  sprints: 'moneo:sprints',
  /** OKR objectives with nested key results (Roadmap Phase 7.3). */
  objectives: 'moneo:objectives',
  /** Kanban board config: WIP limits per status (Roadmap Phase 7.1). */
  boardConfig: 'moneo:board-config',
  /** Waterfall phases per project (Roadmap Phase 7.5). */
  waterfall: 'moneo:waterfall',
  /** Last day the morning ritual ran (day key, rituals). */
  ritualDay: 'moneo:ritual-day',
  /** Life Map areas — local-only by design, never synced. */
  lifeMap: 'moneo:life-map',
  /** Interface language choice (Faza 5 i18n) — local only, never synced. */
  locale: 'moneo:locale',
  /** Pomodoro estimate-learner profiles (Faza 6) — local only, never synced. */
  estimateProfiles: 'moneo:estimate-profiles',
  /** AI standing consent for auto-prepare (Faza 6) — local only, never synced. */
  aiConsent: 'moneo:ai-consent',
  /** Cross-entity links: goal/project/skill/journal many-to-many edges (Faza 14). */
  links: 'moneo:links',
  /** Time capsule delivery log, goalId → delivered-at ms (Faza 26). */
  capsuleDelivered: 'moneo:capsule-delivered',
  /** Rare-celebration shown log, celebrationId → true (Faza 27). */
  celebrationsShown: 'moneo:celebrations-shown',
  /** Saved task filters / Smart Views (Faza 18). */
  savedFilters: 'moneo:saved-filters',
  /** Advanced planning visibility (Kanban/Sprints/Gantt/Waterfall) — local only. */
  advancedPlanning: 'moneo:advanced-planning',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
