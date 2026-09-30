/* Move module: manual cardio and outdoor sessions (run, walk, ride, hike).
 *
 * Stored as ordinary workout entries (`routineId: "cardio-<kind>"`, no sets,
 * optional `km`) so they count toward the week, Today, the calendar and sync.
 */
import type { Muscle } from './library';
import type { WorkoutEntry } from './workouts';

export type CardioKind = 'run' | 'walk' | 'cycle' | 'hike';
export const CARDIO_KINDS: readonly CardioKind[] = ['run', 'walk', 'cycle', 'hike'];

const PREFIX = 'cardio-';
export const MAX_CARDIO_MIN = 24 * 60;
export const MAX_CARDIO_KM = 500;

export const cardioId = (kind: CardioKind) => `${PREFIX}${kind}`;

export function cardioKindOf(routineId: string): CardioKind | undefined {
  if (!routineId.startsWith(PREFIX)) return undefined;
  const kind = routineId.slice(PREFIX.length) as CardioKind;
  return CARDIO_KINDS.includes(kind) ? kind : undefined;
}

/** Legs do the work; the first muscle counts fully, the rest half. */
export const CARDIO_MUSCLES: Record<CardioKind, readonly Muscle[]> = {
  run: ['quads', 'hamstrings', 'calves', 'glutes'],
  walk: ['calves', 'quads', 'glutes'],
  cycle: ['quads', 'glutes', 'calves', 'hamstrings'],
  hike: ['glutes', 'quads', 'calves', 'hamstrings'],
};

/** Body-map load of a session: one set's worth per 15 minutes, at most 3. */
export function cardioLoad(durationSec: number): number {
  return Math.min(3, Math.max(0, durationSec) / 60 / 15);
}

export type Pace = { unit: 'perKm'; sec: number } | { unit: 'kmh'; kmh: number };

/** Minutes per km on foot, km/h on a bike. Undefined without a distance. */
export function cardioPace(kind: CardioKind, durationSec: number, km?: number): Pace | undefined {
  if (!km || km <= 0 || durationSec <= 0) return undefined;
  if (kind === 'cycle')
    return { unit: 'kmh', kmh: Math.round((km / (durationSec / 3600)) * 10) / 10 };
  return { unit: 'perKm', sec: Math.round(durationSec / km) };
}

/** "5:30" for a per-km pace. */
export function paceClock(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function localDayStart(dayKey: string): number | undefined {
  const [y, m, d] = dayKey.split('-').map(Number);
  const t = new Date(y, m - 1, d).getTime();
  return Number.isFinite(t) ? t : undefined;
}

/**
 * A logged session. Today's ends now; a past day's is placed at noon so it
 * sorts inside that day. Returns null for an unusable time or date.
 */
export function newCardioEntry(opts: {
  kind: CardioKind;
  minutes: number;
  km?: number;
  dayKey: string;
  todayKey: string;
  now?: number;
}): WorkoutEntry | null {
  const now = opts.now ?? Date.now();
  const minutes = Math.round(opts.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_CARDIO_MIN) return null;
  const start = localDayStart(opts.dayKey);
  if (start === undefined) return null;
  const durationSec = minutes * 60;
  const startedAt =
    opts.dayKey === opts.todayKey
      ? Math.max(start, now - durationSec * 1000)
      : start + 12 * 3_600_000;
  if (startedAt > now) return null;
  const entry: WorkoutEntry = {
    id: crypto.randomUUID(),
    routineId: cardioId(opts.kind),
    day: opts.dayKey,
    startedAt,
    durationSec,
    sets: [],
  };
  if (opts.km !== undefined && Number.isFinite(opts.km) && opts.km > 0) {
    entry.km = Math.min(MAX_CARDIO_KM, Math.round(opts.km * 100) / 100);
  }
  return entry;
}
