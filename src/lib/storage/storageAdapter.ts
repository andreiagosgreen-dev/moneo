import { STORAGE_KEYS } from "./storageKeys";

/**
 * Storage adapter — the single safe boundary between product code and
 * localStorage. Never throws; every failure degrades calmly so the timer
 * stays usable even when storage is unavailable (private mode, quota,
 * sandboxed iframes).
 *
 * Local-first principle: Moneo must keep functioning when storage or
 * network is unavailable. Cloud sync enhances, never gates, local use.
 */

/**
 * Current product-level storage schema version.
 * v1 (Gate 7): schema marker introduced; payloads unchanged.
 * v2 (Gate 8): stable ids backfilled onto existing history entries
 *              (one id per legacy session; new completions get ids too).
 */
export const CURRENT_SCHEMA_VERSION = 2;

/** Raw string read for migration work that must preserve unknown bytes. */
export function rawRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

/** Returns true when the write succeeded. */
export function safeWrite(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

export function hasKey(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/* ---------- schema version marker ----------
 * Stored as a plain JSON number under its own key. Absent or malformed
 * marker means "legacy installation" (pre-versioning, treated as v0).
 * A marker NEWER than this app is preserved untouched — we never
 * downgrade a version we do not understand.
 */

export function getSchemaVersion(): number | null {
  const v = safeRead<unknown>(STORAGE_KEYS.schemaVersion);
  return typeof v === "number" && Number.isFinite(v) && v >= 0
    ? Math.floor(v)
    : null;
}

export function setSchemaVersion(version: number): boolean {
  return safeWrite(STORAGE_KEYS.schemaVersion, version);
}
