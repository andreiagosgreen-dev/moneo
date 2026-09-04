import type { Settings } from "../store";
import type { FocusArea } from "../focusAreas";

/**
 * Deterministic merge planners — PURE functions, no I/O, heavily tested.
 *
 * Documented conflict policies:
 *
 * SESSIONS — immutable after completion. Identity: session.id.
 *   · id missing remotely            → insertRemote (pushLocal)
 *   · remote-only id                 → adoptRemote
 *   · id present, payload identical  → noop
 *   · id present, payload differs    → resolveRemote: REMOTE is canonical
 *     (it has passed authenticated repo scoping + server RLS ownership).
 *     The engine REPLACES the local copy with the canonical payload —
 *     one id is exactly one logical session, so conflicts reach a
 *     TERMINAL state and the next sync is a zero-op. No new UUID is ever
 *     generated for a conflicting session (that would corrupt counts,
 *     Growth, streaks and analytics).
 *
 * AREAS — mutable name/deletion. Rule: newer updatedAt wins.
 *   · exact timestamp tie            → remote canonical (deterministic):
 *     identical payload → noop, differing payload → adopt remote
 *   · remote soft-delete is newer    → applyLocal marks the area deleted
 *
 * SETTINGS — last-write-wins on updatedAt.
 *   · equal (or both absent)         → noop (local canonical)
 *   · no remote row yet              → pushLocal
 */

/* Transport-agnostic cloud row shapes (repositories do the SQL mapping). */

export interface RemoteSessionRow {
  id: string;
  at: number;
  min: number;
  intention: string | null;
  areaId: string | null;
}

export interface RemoteAreaRow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface RemoteSettingsRow {
  focusMin: number;
  shortMin: number;
  longMin: number;
  longEvery: number;
  dailyGoal: number;
  autoStart: boolean;
  sound: boolean;
  updatedAt: number;
}

export interface LocalSession {
  id?: string;
  at: number;
  min: number;
  intention?: string;
  areaId?: string;
}

/* ---------------- sessions ---------------- */

export function sessionPayloadEqual(
  a: LocalSession,
  b: RemoteSessionRow,
): boolean {
  return (
    a.at === b.at &&
    a.min === b.min &&
    (a.intention ?? null) === b.intention &&
    (a.areaId ?? null) === b.areaId
  );
}

export interface SessionMergePlan {
  /** Local sessions to push (remote lacks the id). */
  insertRemote: Array<LocalSession & { id: string }>;
  /** Remote sessions to adopt locally (local lacks the id). */
  adoptLocal: RemoteSessionRow[];
  noopCount: number;
  /** Same id, different immutable payload — remote canonical. */
  conflicts: Array<{ local: LocalSession & { id: string }; remote: RemoteSessionRow }>;
}

export function planSessionMerge(
  local: LocalSession[],
  remote: RemoteSessionRow[],
): SessionMergePlan {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const plan: SessionMergePlan = {
    insertRemote: [],
    adoptLocal: [],
    noopCount: 0,
    conflicts: [],
  };
  const seenRemote = new Set<string>();
  for (const s of local) {
    if (typeof s.id !== "string" || s.id.length === 0) continue; // pre-backfill guard
    const r = remoteById.get(s.id);
    if (!r) {
      plan.insertRemote.push(s as LocalSession & { id: string });
    } else if (sessionPayloadEqual(s, r)) {
      plan.noopCount++;
    } else {
      plan.conflicts.push({ local: s as LocalSession & { id: string }, remote: r });
    }
    seenRemote.add(s.id);
  }
  for (const r of remote) {
    if (!seenRemote.has(r.id)) plan.adoptLocal.push(r);
  }
  return plan;
}

/* ---------------- areas ---------------- */

export type AreaOp =
  | { kind: "pushInsert"; area: FocusArea }
  | { kind: "pushUpdate"; area: FocusArea }
  | { kind: "applyLocal"; remote: RemoteAreaRow }
  | { kind: "noop" };

export interface AreaMergePlan {
  ops: Array<{ areaId: string; op: AreaOp }>;
  pushInsertCount: number;
  pushUpdateCount: number;
  applyLocalCount: number;
  noopCount: number;
}

const areaStamp = (a: FocusArea): number => a.updatedAt ?? a.createdAt ?? 0;

const areaDiffers = (a: FocusArea, r: RemoteAreaRow): boolean =>
  a.name !== r.name ||
  typeof a.deletedAt === "number" !== (r.deletedAt !== null);

export function planAreaMerge(
  local: FocusArea[],
  remote: RemoteAreaRow[],
): AreaMergePlan {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const plan: AreaMergePlan = {
    ops: [],
    pushInsertCount: 0,
    pushUpdateCount: 0,
    applyLocalCount: 0,
    noopCount: 0,
  };
  for (const a of local) {
    const r = remoteById.get(a.id);
    if (!r) {
      plan.ops.push({ areaId: a.id, op: { kind: "pushInsert", area: a } });
      plan.pushInsertCount++;
      continue;
    }
    const lt = areaStamp(a);
    const rt = r.updatedAt;
    if (lt > rt) {
      if (areaDiffers(a, r)) {
        plan.ops.push({ areaId: a.id, op: { kind: "pushUpdate", area: a } });
        plan.pushUpdateCount++;
      } else {
        plan.ops.push({ areaId: a.id, op: { kind: "noop" } });
        plan.noopCount++;
      }
    } else if (rt > lt) {
      if (areaDiffers(a, r)) {
        plan.ops.push({ areaId: a.id, op: { kind: "applyLocal", remote: r } });
        plan.applyLocalCount++;
      } else {
        plan.ops.push({ areaId: a.id, op: { kind: "noop" } });
        plan.noopCount++;
      }
    } else {
      // Exact tie → remote canonical (deterministic).
      if (areaDiffers(a, r)) {
        plan.ops.push({ areaId: a.id, op: { kind: "applyLocal", remote: r } });
        plan.applyLocalCount++;
      } else {
        plan.ops.push({ areaId: a.id, op: { kind: "noop" } });
        plan.noopCount++;
      }
    }
  }
  // Remote-only areas are adopted by the engine (not part of per-id ops).
  return plan;
}

export function remoteOnlyAreas(
  local: FocusArea[],
  remote: RemoteAreaRow[],
): RemoteAreaRow[] {
  const localIds = new Set(local.map((a) => a.id));
  return remote.filter((r) => !localIds.has(r.id));
}

/* ---------------- settings ---------------- */

export type SettingsMergeOp = "pushLocal" | "applyRemote" | "noop";

export function planSettingsMerge(
  local: Settings & { updatedAt?: number },
  remote: RemoteSettingsRow | null,
): SettingsMergeOp {
  if (!remote) return "pushLocal";
  const lt = typeof local.updatedAt === "number" ? local.updatedAt : 0;
  const rt = remote.updatedAt;
  if (lt > rt) return "pushLocal";
  if (rt > lt) return "applyRemote";
  return "noop"; // equal — local canonical, nothing to do
}
