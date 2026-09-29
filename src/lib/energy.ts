/* Energy management (Roadmap Phase 5.4) — 1-10 check-ins, peak hours.
 *
 * Log energy when you notice it; the engine finds your peak focus hours
 * from trailing data and turns them into scheduling advice. Pure functions.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { createI18n, type I18n } from './i18n';

/** Default English translator — keeps helpers usable without a provider. */
const EN_I18N = createI18n('en');

export interface EnergyEntry {
  id: string;
  at: number;
  level: number; // 1-10
  /** 1-5, only on daily check-ins. */
  mood?: number;
  /** Written by the Today check-in, one record per day (`daily-<dayKey>`). */
  daily?: true;
}

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
export const MAX_ENTRIES = 500;
/** The Today check-in asks 1-5; energy is stored as `level = energy * 2`. */
export const DAILY_SCALE = 5;
const MIN_SAMPLES_PER_HOUR = 2;
const MIN_SAMPLES_FOR_ADVICE = 5;
const DAILY_PREFIX = 'daily-';

function clampDaily(n: number): number {
  return Math.min(DAILY_SCALE, Math.max(1, Math.round(n)));
}

export function loadEnergyLog(): EnergyEntry[] {
  const stored = read<EnergyEntry[]>(STORAGE_KEYS.energyLog);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (e) =>
        e &&
        typeof e.at === 'number' &&
        Number.isFinite(e.at) &&
        typeof e.level === 'number' &&
        Number.isFinite(e.level),
    )
    .map((e) => {
      const entry: EnergyEntry = {
        id: typeof e.id === 'string' ? e.id : `${e.at}-${Math.random()}`,
        at: e.at,
        level: Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(e.level))),
      };
      if (typeof e.mood === 'number' && Number.isFinite(e.mood)) entry.mood = clampDaily(e.mood);
      if (e.daily === true) entry.daily = true;
      return entry;
    })
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_ENTRIES);
}

export function dailyCheckinId(dayKey: string): string {
  return `${DAILY_PREFIX}${dayKey}`;
}

/** Day key of a daily check-in record, or null for hourly entries. */
export function dailyCheckinDay(entry: EnergyEntry): string | null {
  if (!entry.daily || !entry.id.startsWith(DAILY_PREFIX)) return null;
  return entry.id.slice(DAILY_PREFIX.length);
}

/**
 * Create or update the day's check-in. Energy is required to create the
 * record; a mood-only patch on a missing day leaves the log unchanged.
 * The id is deterministic, so re-tapping and Pro sync converge on one record.
 */
export function logDailyCheckin(
  entries: EnergyEntry[],
  dayKey: string,
  patch: { energy?: number; mood?: number },
  at: number = Date.now(),
): EnergyEntry[] {
  const id = dailyCheckinId(dayKey);
  const valid = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
  const hasEnergy = valid(patch.energy);
  const hasMood = valid(patch.mood);
  if (!hasEnergy && !hasMood) return entries;
  const current = entries.find((e) => e.id === id);
  if (!current && !hasEnergy) return entries;
  const next: EnergyEntry = current
    ? { ...current, daily: true }
    : { id, at, level: MIN_LEVEL, daily: true };
  if (hasEnergy) next.level = clampDaily(patch.energy as number) * 2;
  if (hasMood) next.mood = clampDaily(patch.mood as number);
  const rest = entries.filter((e) => e.id !== id);
  return [...rest, next].sort((a, b) => a.at - b.at).slice(-MAX_ENTRIES);
}

export function dailyCheckinFor(
  entries: EnergyEntry[],
  dayKey: string,
): { energy: number | null; mood: number | null } {
  const entry = entries.find((e) => e.id === dailyCheckinId(dayKey) && e.daily);
  if (!entry) return { energy: null, mood: null };
  return {
    energy: clampDaily(entry.level / 2),
    mood: typeof entry.mood === 'number' ? entry.mood : null,
  };
}

export function saveEnergyLog(entries: EnergyEntry[]): boolean {
  return write(STORAGE_KEYS.energyLog, entries.slice(-MAX_ENTRIES));
}

/** Append a check-in (level clamped 1-10). Never throws. */
export function logEnergy(
  entries: EnergyEntry[],
  level: number,
  at: number = Date.now(),
): EnergyEntry[] {
  if (typeof level !== 'number' || !Number.isFinite(level)) return entries;
  if (typeof at !== 'number' || !Number.isFinite(at)) return entries;
  const entry: EnergyEntry = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `energy-${at}-${Math.random().toString(36).slice(2)}`,
    at,
    level: Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level))),
  };
  return [...entries, entry].sort((a, b) => a.at - b.at).slice(-MAX_ENTRIES);
}

export interface HourBucket {
  hour: number; // 0-23 local
  avg: number;
  samples: number;
}

/** Minimal shape for analysis (EnergyEntry carries an id too). */
export interface EnergySample {
  at: number;
  level: number;
  daily?: boolean;
}

/**
 * Average level per hour of day over the trailing window. Daily check-ins
 * are skipped: the time of the tap says nothing about hourly energy.
 */
export function hourlyAverage(
  entries: EnergySample[],
  now: number = Date.now(),
  days = 14,
): HourBucket[] {
  const start = now - Math.max(1, days) * 24 * 60 * 60 * 1000;
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const e of entries) {
    if (e.daily) continue;
    if (e.at < start || e.at > now) continue;
    const hour = new Date(e.at).getHours();
    const b = buckets.get(hour) ?? { sum: 0, n: 0 };
    b.sum += e.level;
    b.n += 1;
    buckets.set(hour, b);
  }
  return [...buckets.entries()]
    .map(([hour, b]) => ({ hour, avg: b.sum / b.n, samples: b.n }))
    .sort((a, b) => a.hour - b.hour);
}

/** Top hours by average level (needs repeat samples to count). */
export function peakHours(
  entries: EnergySample[],
  now: number = Date.now(),
  top = 3,
): HourBucket[] {
  return hourlyAverage(entries, now)
    .filter((b) => b.samples >= MIN_SAMPLES_PER_HOUR)
    .sort((a, b) => b.avg - a.avg || a.hour - b.hour)
    .slice(0, Math.max(1, top));
}

/** Scheduling advice from measured peaks (null until enough data). */
export function energyAdvice(
  entries: EnergyEntry[],
  now: number = Date.now(),
  i18n: I18n = EN_I18N,
): string | null {
  if (entries.filter((e) => !e.daily).length < MIN_SAMPLES_FOR_ADVICE) {
    return i18n.t('life.e.needMore');
  }
  const peaks = peakHours(entries, now, 1);
  if (peaks.length === 0) return i18n.t('life.e.spread');
  const h = peaks[0].hour;
  const label = `${h}:00`;
  if (peaks[0].avg >= 7) return i18n.t('life.e.high', { label });
  if (peaks[0].avg <= 4) return i18n.t('life.e.low', { label });
  return i18n.t('life.e.steady', { label });
}

export function formatHour(hour: number): string {
  return `${hour}:00`;
}

/**
 * Predicted peak hour today from trailing averages (Roadmap 5.4 prediction).
 * Null until an hour has repeat samples. Never throws.
 */
export function predictPeak(
  entries: EnergyEntry[],
  now: number = Date.now(),
): { hour: number; avg: number } | null {
  const peaks = peakHours(entries, now, 1);
  if (peaks.length === 0) return null;
  return { hour: peaks[0].hour, avg: peaks[0].avg };
}

/**
 * Break nudge from recent load (Roadmap 5.4): 100+ focused minutes in the
 * trailing 2h with no 10-minute gap suggests a real break. Null otherwise.
 */
export function breakAdvice(
  history: Array<{ at: number; min: number }>,
  now: number = Date.now(),
  i18n: I18n = EN_I18N,
): string | null {
  if (!Number.isFinite(now)) return null;
  const windowStart = now - 2 * 60 * 60 * 1000;
  const recent = history
    .filter(
      (s) =>
        typeof s.at === 'number' && typeof s.min === 'number' && s.at >= windowStart && s.at <= now,
    )
    .sort((a, b) => a.at - b.at);
  const total = recent.reduce((sum, s) => sum + s.min, 0);
  if (total < 100 || recent.length < 2) return null;
  let rested = false;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].at - (recent[i - 1].at + recent[i - 1].min * 60_000) >= 10 * 60_000) {
      rested = true;
      break;
    }
  }
  if (rested) return null;
  return i18n.t('life.e.pushed', { total: i18n.fmtNum(total) });
}

/** Mean level over the trailing window (null when no check-ins). */
export function energyMean(
  entries: EnergyEntry[],
  now: number = Date.now(),
  days = 14,
): number | null {
  const start = now - Math.max(1, days) * 24 * 60 * 60 * 1000;
  const levels = entries
    .filter((e) => typeof e.at === 'number' && e.at >= start && e.at <= now)
    .map((e) => e.level);
  if (levels.length === 0) return null;
  return levels.reduce((a, b) => a + b, 0) / levels.length;
}

/**
 * Rest-day advice (Roadmap 5.4): 6+ consecutive active days suggests a full
 * day off; 3+ idle days after activity suggests re-entry. Null otherwise.
 */
export function restAdvice(
  history: Array<{ at: number; min: number }>,
  now: number = Date.now(),
  i18n: I18n = EN_I18N,
): string | null {
  const dayHas = (offset: number): boolean => {
    const d = new Date(now - offset * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return history.some((s) => {
      const sd = new Date(s.at);
      return (
        `${sd.getFullYear()}-${sd.getMonth() + 1}-${sd.getDate()}` === key &&
        typeof s.min === 'number' &&
        s.min > 0
      );
    });
  };
  let active = 0;
  while (dayHas(active) && active < 30) active += 1;
  if (active >= 6) {
    return i18n.t('life.e.streak', { n: i18n.fmtNum(active) });
  }
  if (active === 0) {
    let idle = 0;
    while (!dayHas(idle + 1) && idle < 30) idle += 1;
    if (idle >= 3 && history.length > 0) {
      return i18n.t('life.e.quiet');
    }
  }
  return null;
}
