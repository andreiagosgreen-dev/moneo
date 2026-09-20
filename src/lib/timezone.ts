/**
 * Moneo timezone policy (decided Gate 7, wired Gate 9):
 *
 * - Session timestamps are ALWAYS absolute epoch-ms. Never local strings.
 * - Day grouping ("today", streaks, daily goal, weekly analytics) derives
 *   from the EFFECTIVE IANA timezone:
 *     · anonymous / local-only users → browser-resolved timezone
 *     · authenticated users          → saved account timezone,
 *                                       with browser fallback
 */

/** Browser-resolved IANA timezone, e.g. "Europe/Chisinau". */
export function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** True when the value is a usable IANA timezone identifier. */
export function isValidIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The effective timezone for day grouping:
 * account timezone when valid, otherwise the browser timezone.
 */
export function getEffectiveTimezone(accountTimezone?: string | null): string {
  return isValidIanaTimezone(accountTimezone) ? accountTimezone : getBrowserTimezone();
}

/* ---------- timezone-aware day helpers ----------
 * Deterministic calendar-day math in an arbitrary IANA zone, built on
 * native Intl (no date library).
 */

/** "YYYY-M-D" day key of a timestamp as observed in the given zone. */
export function dayKeyInTz(ts: number, timezone: string): string {
  const tz = isValidIanaTimezone(timezone) ? timezone : 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(ts));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '1';
  return `${get('year')}-${Number(get('month'))}-${Number(get('day'))}`;
}

/** True when the timestamp falls on "today" in the given zone. */
export function isTodayInTz(ts: number, timezone: string): boolean {
  const now = Date.now();
  return dayKeyInTz(ts, timezone) === dayKeyInTz(now, timezone);
}

/** Focused minutes for one calendar-day key (zone-derived). */
export function minutesForDayKey(
  history: Array<{ at: number; min: number }>,
  key: string,
  timezone: string,
): number {
  return history
    .filter((s) => dayKeyInTz(s.at, timezone) === key)
    .reduce((sum, s) => sum + s.min, 0);
}

/** Consecutive-day streak ending today-in-zone (grace: empty today may
 *  still extend from yesterday-in-zone). */
export function currentStreakInTz(history: Array<{ at: number }>, timezone: string): number {
  const days = new Set(history.map((s) => dayKeyInTz(s.at, timezone)));
  let streak = 0;
  let cursor = Date.now();
  if (!days.has(dayKeyInTz(cursor, timezone))) cursor -= 24 * 3600_000;
  // Step in 24h blocks; dayKeyInTz normalizes DST length internally.
  while (days.has(dayKeyInTz(cursor, timezone))) {
    streak++;
    cursor -= 24 * 3600_000;
  }
  return streak;
}

/**
 * Day keys of the trailing n calendar days in the given zone,
 * oldest → newest (last element is today-in-zone).
 */
export function trailingWeekDayKeysInTz(n: number, timezone: string): string[] {
  const now = Date.now();
  const keys: string[] = [];
  const seen = new Set<string>();
  // Walk back in 12h steps so DST-length days still yield each calendar day.
  for (let back = 0; keys.length < n && back <= n * 4; back++) {
    const key = dayKeyInTz(now - back * 12 * 3600_000, timezone);
    if (!seen.has(key)) {
      seen.add(key);
      keys.unshift(key);
    }
  }
  return keys.slice(-n);
}
