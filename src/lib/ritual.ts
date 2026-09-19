/* Morning + shutdown rituals — calm daily bookends, local-first.
 *
 * Morning: confirm today's top tasks with time estimates, see the load
 * against real capacity, optionally pin tasks as time blocks.
 * Evening: review what shipped, carry the rest to tomorrow.
 * Pure functions; one storage key remembers the last ritual day.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { dayKeyInTz } from './timezone';
import type { Session } from './store';
import type { TimeBlock, Weekday } from './timeBlocks';
import type { IvyPlan } from './ivyLee';

/** Fallback daily focus budget when no time blocks exist (6h). */
export const DEFAULT_DAY_CAPACITY_MIN = 360;

/** Morning ritual only makes sense before noon local time. */
export const RITUAL_CUTOFF_HOUR = 12;

function hourInTz(ts: number, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date(ts));
    return Number(parts.find((p) => p.type === 'hour')?.value ?? 12) % 24;
  } catch {
    return new Date(ts).getHours();
  }
}

export function loadRitualDay(): string | null {
  const v = read<string>(STORAGE_KEYS.ritualDay);
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function saveRitualDay(dayKey: string): boolean {
  return write(STORAGE_KEYS.ritualDay, dayKey);
}

/** Show once per day, on first open before noon. Never throws. */
export function shouldShowMorningRitual(
  nowTs: number,
  timezone: string,
  shownDayKey: string | null,
): boolean {
  const today = dayKeyInTz(nowTs, timezone);
  if (shownDayKey === today) return false;
  return hourInTz(nowTs, timezone) < RITUAL_CUTOFF_HOUR;
}

export interface Overcommit {
  plannedMin: number;
  availableMin: number;
  over: boolean;
  excessMin: number;
}

/** Compare estimated load against real capacity. Never throws. */
export function overcommitment(plannedMin: number, availableMin: number): Overcommit {
  const planned = Number.isFinite(plannedMin) && plannedMin > 0 ? Math.round(plannedMin) : 0;
  const available =
    Number.isFinite(availableMin) && availableMin > 0
      ? Math.round(availableMin)
      : DEFAULT_DAY_CAPACITY_MIN;
  return {
    plannedMin: planned,
    availableMin: available,
    over: planned > available,
    excessMin: Math.max(0, planned - available),
  };
}

/** Planned block minutes for a weekday, or the fallback budget. */
export function dayCapacity(
  blocks: TimeBlock[],
  weekday: Weekday,
  fallbackMin: number = DEFAULT_DAY_CAPACITY_MIN,
): number {
  const planned = blocks
    .filter((b) => b.weekday === weekday && b.endMin > b.startMin)
    .reduce((sum, b) => sum + (b.endMin - b.startMin), 0);
  return planned > 0 ? planned : fallbackMin;
}

export interface ShutdownSummary {
  sessions: number;
  minutes: number;
  done: number;
  total: number;
  unfinished: string[];
}

/** Evening review numbers for one day key. Never throws. */
export function shutdownSummary(
  history: Session[],
  plans: IvyPlan[],
  todayKey: string,
  timezone: string,
): ShutdownSummary {
  const todays = history.filter(
    (s) =>
      typeof s.at === 'number' &&
      typeof s.min === 'number' &&
      dayKeyInTz(s.at, timezone) === todayKey,
  );
  const plan = plans.find((p) => p.dateKey === todayKey) ?? null;
  const open = (plan?.tasks ?? []).filter((t) => !t.done);
  return {
    sessions: todays.length,
    minutes: todays.reduce((sum, s) => sum + s.min, 0),
    done: (plan?.tasks ?? []).filter((t) => t.done).length,
    total: (plan?.tasks ?? []).length,
    unfinished: open.map((t) => t.text),
  };
}

/** "YYYY-M-D" key of the day after the given key (calendar-safe). */
export function nextDayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
