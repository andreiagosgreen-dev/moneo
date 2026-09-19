import {
  CURRENT_SCHEMA_VERSION,
  getSchemaVersion,
  rawRead,
  safeRead,
  safeWrite,
  setSchemaVersion,
} from './storageAdapter';
import { STORAGE_KEYS } from './storageKeys';
import { ensureAreaCloudId } from '../areaIdentity';

/**
 * Deterministic, idempotent local migration runner.
 *
 * Contract:
 * - Safe on every app startup; repeated runs are no-ops.
 * - Never destroys or rewrites legacy payloads (except the additive v2 id
 *   backfill, which only ADDS fields).
 * - Malformed version markers are treated as legacy (v0).
 * - Versions NEWER than this app are preserved untouched — we never
 *   downgrade a marker we do not understand.
 * - The version only advances after the migration step succeeds.
 */

export type MigrationStatus = 'migrated' | 'already-current' | 'unsupported-version' | 'failed';

export interface MigrationResult {
  /** Recorded version before the run; null = legacy/unmarked. */
  from: number | null;
  /** Version after the run. */
  to: number;
  status: MigrationStatus;
}

const VALIDATED_KEYS = [
  STORAGE_KEYS.settings,
  STORAGE_KEYS.history,
  STORAGE_KEYS.snapshot,
  STORAGE_KEYS.intentionDraft,
  STORAGE_KEYS.focusAreas,
  STORAGE_KEYS.selectedFocusArea,
  STORAGE_KEYS.projects,
  STORAGE_KEYS.selectedProject,
  STORAGE_KEYS.tasks,
  STORAGE_KEYS.ivyPlans,
  STORAGE_KEYS.timeBlocks,
  STORAGE_KEYS.theme,
  STORAGE_KEYS.onboardingSeen,
] as const;

/** Stable id generator duplicated here (no domain imports) so migrations
 *  stay dependency-free. */
function migrationId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** v0 → v1: no payload transformation. Validate that every product key is
 *  still safely readable, then mark schema version 1. */
function migrateV0ToV1(): void {
  for (const key of VALIDATED_KEYS) {
    // safeRead never throws; domain loaders apply their own fallbacks
    // later — here we only confirm the substrate is readable.
    safeRead<unknown>(key);
  }
}

/**
 * v1 → v2: assign exactly one stable id to every history entry that lacks
 * one. Additive only — at/min/intention/areaId and entry order are
 * preserved; entries that already have ids are never re-stamped.
 * Corrupt history bytes are left untouched (domain loaders keep their own
 * fallbacks) and the marker still advances, so one bad key cannot wedge
 * the whole migration.
 */
function migrateV1ToV2(): void {
  const raw = rawRead(STORAGE_KEYS.history);
  if (raw === null) return; // nothing stored — nothing to backfill
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return; // corrupt bytes stay corrupt; loaders degrade safely
  }
  if (!Array.isArray(parsed)) return;
  const needsIds = parsed.some(
    (s) => s && typeof s === 'object' && typeof (s as { id?: unknown }).id !== 'string',
  );
  if (!needsIds) return; // idempotent fast path
  const stamped = parsed.map((s) => {
    if (s && typeof s === 'object') {
      const entry = s as { id?: unknown };
      if (typeof entry.id !== 'string' || entry.id.length === 0) {
        return { ...entry, id: migrationId() };
      }
    }
    return s;
  });
  if (!safeWrite(STORAGE_KEYS.history, stamped)) {
    throw new Error('history backfill write failed');
  }
}

/**
 * v2 → v3: assign exactly one stable cloud UUID (cloudId) to every Focus
 * Area that lacks one. Additive only — id/name/createdAt/etc. and entry
 * order are preserved; areas that already have a cloudId are never
 * re-stamped. Seeded ids ("area:work"…) map to a deterministic well-known
 * UUID shared across devices; UUID custom ids keep their own id. Local
 * session.areaId values are NOT rewritten — the cloud boundary maps them.
 */
function migrateV2ToV3(): void {
  const raw = rawRead(STORAGE_KEYS.focusAreas);
  if (raw === null) return; // nothing stored — nothing to backfill
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return; // corrupt bytes stay corrupt; loaders degrade safely
  }
  if (!Array.isArray(parsed)) return;
  const needsCloudIds = parsed.some(
    (a) =>
      a &&
      typeof a === 'object' &&
      typeof (a as { id?: unknown }).id === 'string' &&
      typeof (a as { cloudId?: unknown }).cloudId !== 'string',
  );
  if (!needsCloudIds) return; // idempotent fast path
  const stamped = parsed.map((a) => {
    if (a && typeof a === 'object') {
      const area = a as { id?: unknown; cloudId?: unknown };
      if (
        typeof area.id === 'string' &&
        (typeof area.cloudId !== 'string' || area.cloudId.length === 0)
      ) {
        return { ...area, cloudId: ensureAreaCloudId(area.id) };
      }
    }
    return a;
  });
  if (!safeWrite(STORAGE_KEYS.focusAreas, stamped)) {
    throw new Error('area cloudId backfill write failed');
  }
}

/**
 * v3 → v4: introduced projects and selected project.
 * No data transformation needed, only key registration.
 */
function migrateV3ToV4(): void {
  // No data migration - just key registration
  // Projects start empty when user creates them
}

export function runLocalMigrations(): MigrationResult {
  const version = getSchemaVersion();

  // Newer than this app understands: leave everything alone.
  if (version !== null && version > CURRENT_SCHEMA_VERSION) {
    return { from: version, to: version, status: 'unsupported-version' };
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    return { from: version, to: version, status: 'already-current' };
  }

  try {
    if ((version ?? 0) < 1) migrateV0ToV1();
    if ((version ?? 0) < 2) migrateV1ToV2();
    if ((version ?? 0) < 3) migrateV2ToV3();
    if ((version ?? 0) < 4) migrateV3ToV4();
  } catch {
    // Never advance the marker if a step did not complete.
    return { from: version, to: version ?? CURRENT_SCHEMA_VERSION, status: 'failed' };
  }

  const written = setSchemaVersion(CURRENT_SCHEMA_VERSION);
  if (!written) {
    return { from: version, to: version ?? CURRENT_SCHEMA_VERSION, status: 'failed' };
  }
  return { from: version, to: CURRENT_SCHEMA_VERSION, status: 'migrated' };
}
