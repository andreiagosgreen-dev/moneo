import type { Session } from "./store";

/**
 * Stable session identity (Gate 8).
 *
 * Cloud sync requires stable ids. New natural completions receive one id at
 * creation time; legacy entries are backfilled exactly once by the schema-v2
 * migration / sync engine — never regenerated on load.
 */

/** crypto.randomUUID with a spec-shaped local fallback. */
export function newSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to local fallback */
  }
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SessionMeta {
  intention?: string | null;
  areaId?: string | null;
}

/**
 * Assemble the completed-session entry: stable id + round-captured metadata.
 * Returns null when there is nothing to credit (breaks, skips, resets).
 */
export function assembleSession(
  base: { at: number; min: number } | null,
  meta: SessionMeta = {},
): Session | null {
  if (!base) return null;
  const entry: Session = { id: newSessionId(), at: base.at, min: base.min };
  if (meta.intention) entry.intention = meta.intention;
  if (meta.areaId) entry.areaId = meta.areaId;
  return entry;
}

/**
 * Build a canonical Session from a transport row (shared by adoption and
 * remote-canonical conflict resolution). Absent intention/areaId (null) are
 * omitted so downstream equality treats them as "absent".
 */
export function sessionFromRemoteRow(r: {
  id: string;
  at: number;
  min: number;
  intention: string | null;
  areaId: string | null;
}): Session {
  return {
    id: r.id,
    at: r.at,
    min: r.min,
    ...(r.intention ? { intention: r.intention } : {}),
    ...(r.areaId ? { areaId: r.areaId } : {}),
  };
}

/**
 * Replace exactly one session by id with the canonical payload.
 * Same history length; exactly one matching id; unrelated entries unchanged.
 * Pure: always returns a new array, never mutates the input.
 */
export function replaceSessionById(
  history: Session[],
  canonical: Session,
): Session[] {
  return history.map((s) => (s.id === canonical.id ? canonical : s));
}
