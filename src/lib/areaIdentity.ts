/**
 * Area identity compatibility (Remediation R1).
 *
 * Local Focus Areas keep their stable local `id`. The cloud schema requires a
 * UUID primary/foreign key, so each area also carries a stable `cloudId`.
 *
 * Seeded default areas ("area:work" / "area:study" / "area:personal") are NOT
 * UUIDs, and — critically — every device seeds them independently. If their
 * cloudId were a fresh random UUID per device, two devices would push two
 * different "Work" rows and duplicate the defaults in the cloud. So seeded
 * ids map to WELL-KNOWN, deterministic cloud UUIDs that are identical on every
 * device. Custom areas whose local id is already a UUID simply use it.
 *
 * Cloud relational identity is (user_id, cloudId), not cloudId alone (R4A).
 * Thus different users can own the same seeded UUID without colliding, while
 * devices of one account converge without rewriting any stored identities.
 * All helpers here are synchronous (safe for the storage migration).
 */

/** Well-known cloud identities for the seeded default areas. Identical on
 *  every device, so sync upserts converge on a single row per default. */
export const SEEDED_AREA_CLOUD_IDS = {
  'area:work': 'a1100000-0000-4000-8000-000000000001',
  'area:study': 'a1100000-0000-4000-8000-000000000002',
  'area:personal': 'a1100000-0000-4000-8000-000000000003',
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** crypto.randomUUID with a UUID-v4-shaped dependency-free fallback. */
export function newCloudUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the shaped fallback */
  }
  const hex = (n: number) =>
    Math.floor(Math.random() * 16 ** n)
      .toString(16)
      .padStart(n, '0');
  const variant = '89ab'[Math.floor(Math.random() * 4)];
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

/**
 * Deterministic cloud identity for a local area id:
 *   seeded id  → the shared well-known UUID
 *   UUID id    → itself (custom areas already cloud-compatible)
 *   otherwise  → a fresh UUID (persisted by the caller; stable thereafter)
 */
export function ensureAreaCloudId(localId: string): string {
  const seeded = SEEDED_AREA_CLOUD_IDS[localId as keyof typeof SEEDED_AREA_CLOUD_IDS];
  if (seeded) return seeded;
  if (isUuid(localId)) return localId;
  return newCloudUuid();
}
