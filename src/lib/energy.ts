/* Energy management (Roadmap Phase 5.4) — 1-10 check-ins, peak hours.
 *
 * Log energy when you notice it; the engine finds your peak focus hours
 * from trailing data and turns them into scheduling advice. Pure functions.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';

export interface EnergyEntry {
  id: string;
  at: number;
  level: number; // 1-10
}

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
export const MAX_ENTRIES = 500;
const MIN_SAMPLES_PER_HOUR = 2;
const MIN_SAMPLES_FOR_ADVICE = 5;

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
    .map((e) => ({
      id: typeof e.id === 'string' ? e.id : `${e.at}-${Math.random()}`,
      at: e.at,
      level: Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(e.level))),
    }))
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_ENTRIES);
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
}

/** Average level per hour of day over the trailing window. */
export function hourlyAverage(
  entries: EnergySample[],
  now: number = Date.now(),
  days = 14,
): HourBucket[] {
  const start = now - Math.max(1, days) * 24 * 60 * 60 * 1000;
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const e of entries) {
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
export function energyAdvice(entries: EnergyEntry[], now: number = Date.now()): string | null {
  if (entries.length < MIN_SAMPLES_FOR_ADVICE) {
    return 'Log energy a few times a day — peaks appear after ~5 check-ins.';
  }
  const peaks = peakHours(entries, now, 1);
  if (peaks.length === 0) return 'Log energy at different hours to reveal your peak.';
  const h = peaks[0].hour;
  const label = `${h}:00`;
  if (peaks[0].avg >= 7) return `Peak focus around ${label} — protect it for deep work.`;
  if (peaks[0].avg <= 4)
    return `Energy runs low (best ~${label}) — plan lighter tasks and more breaks.`;
  return `Steadiest around ${label} — schedule demanding work there.`;
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
  return `You've focused ${total}m in 2h with no real break — take 10 minutes off.`;
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
    return `${active} active days in a row — schedule a real day off before the streak schedules you.`;
  }
  if (active === 0) {
    let idle = 0;
    while (!dayHas(idle + 1) && idle < 30) idle += 1;
    if (idle >= 3 && history.length > 0) {
      return 'Three quiet days — a single 25-minute round restarts the engine.';
    }
  }
  return null;
}
