import { dayKey, lastNDays, type Session } from './store';
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead, safeWrite } from './storage/storageAdapter';
import { dayKeyInTz, trailingWeekDayKeysInTz } from './timezone';

/**
 * Focus Intentions — "what am I focusing on right now?"
 * Pure domain helpers. Storage reuses solanum:history (additive
 * `intention` field on session entries); only the *draft* text gets a
 * small dedicated key so it survives reloads.
 */

export const INTENTION_MAX = 80;

const DRAFT_KEY = STORAGE_KEYS.intentionDraft;

/** Display-level sanitizer: coerce, trim, enforce max. Empty → null. */
export function sanitizeIntention(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, INTENTION_MAX);
  return t.length > 0 ? t : null;
}

/**
 * Grouping key: case-insensitive, whitespace-collapsed.
 * "Thesis", " thesis " and "THESIS" normalize to the same key.
 * No fuzzy matching — ever.
 */
export function normalizeIntention(raw: unknown): string | null {
  const s = sanitizeIntention(raw);
  return s === null ? null : s.toLowerCase().replace(/\s+/g, ' ');
}

export interface IntentionGroup {
  key: string;
  /** First-seen display casing for this group. */
  label: string;
  min: number;
}

/** Group intentional sessions, sum minutes, rank descending. */
export function groupFocusByIntention(history: Session[]): IntentionGroup[] {
  const map = new Map<string, IntentionGroup>();
  for (const s of history) {
    const key = normalizeIntention(s.intention);
    if (key === null) continue;
    const existing = map.get(key);
    if (existing) existing.min += s.min;
    else map.set(key, { key, label: s.intention!.trim(), min: s.min });
  }
  return [...map.values()].sort((a, b) => b.min - a.min || a.label.localeCompare(b.label));
}

/**
 * Top intentional focus over the trailing 7 days.
 * Day grouping uses the given IANA timezone when provided (account-timezone
 * policy), otherwise the device-local day (anonymous default — unchanged).
 */
export function getWeeklyTopIntentions(
  history: Session[],
  limit = 3,
  timezone?: string,
): IntentionGroup[] {
  const week = timezone
    ? new Set(trailingWeekDayKeysInTz(7, timezone))
    : new Set(lastNDays(7).map((d) => dayKey(d)));
  const keyOf = (ts: number) => (timezone ? dayKeyInTz(ts, timezone) : dayKey(new Date(ts)));
  return groupFocusByIntention(history.filter((s) => week.has(keyOf(s.at)))).slice(0, limit);
}

/* ---------- draft persistence (small UX key) ---------- */

export function loadIntentionDraft(): string {
  const parsed = safeRead<unknown>(DRAFT_KEY);
  return typeof parsed === 'string' ? parsed.slice(0, INTENTION_MAX) : '';
}

export function saveIntentionDraft(draft: string) {
  safeWrite(DRAFT_KEY, draft.slice(0, INTENTION_MAX));
}
