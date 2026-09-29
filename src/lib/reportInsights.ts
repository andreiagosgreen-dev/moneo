/**
 * Reports insights (Stage 4): strongest/weakest habit, best/hardest week,
 * best focus hour and energy ↔ focus. Pure; sessions and check-ins use the
 * account timezone, habit keys are device-local like the habit log.
 */
import { activeHabits, type Habit, type HabitLog } from './habits';
import type { Session } from './store';
import { dailyCheckinDay, dailyCheckinFor, type EnergyEntry } from './energy';
import { habitStartKey } from './habitMonth';
import { dayKeyInTz } from './timezone';
import { minuteOfDayInTz } from './timeBlocks';
import { addDays, compareDayKeys, mondayOf } from './dayKeys';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ELIGIBLE_DAYS = 7;
const MIN_HOUR_SESSIONS = 5;
const MIN_PAIRED_DAYS = 7;

export interface HabitStrength {
  habitId: string;
  name: string;
  /** 0..1 */
  rate: number;
  hits: number;
  eligibleDays: number;
}

/** Active habits with ≥ 7 eligible days in the window, strongest first. */
export function habitStrengths(
  habits: Habit[],
  log: HabitLog,
  todayKey: string,
  days = 30,
): HabitStrength[] {
  const window = Array.from({ length: Math.max(1, days) }, (_, i) => addDays(todayKey, -i));
  return activeHabits(habits)
    .map((habit, order) => {
      const logged = log[habit.id] ?? [];
      const done = new Set(logged);
      const start = habitStartKey(habit, logged);
      const eligible = window.filter((k) => compareDayKeys(k, start) >= 0);
      const hits = eligible.filter((k) => done.has(k)).length;
      const n = eligible.length;
      const rate =
        n === 0
          ? 0
          : habit.frequency === 'daily'
            ? Math.min(1, hits / n)
            : Math.min(1, hits / Math.max(1, (habit.targetPerWeek * n) / 7));
      return { habitId: habit.id, name: habit.name, rate, hits, eligibleDays: n, order };
    })
    .filter((h) => h.eligibleDays >= MIN_ELIGIBLE_DAYS)
    .sort((a, b) => b.rate - a.rate || b.hits - a.hits || a.order - b.order)
    .map((h) => ({
      habitId: h.habitId,
      name: h.name,
      rate: h.rate,
      hits: h.hits,
      eligibleDays: h.eligibleDays,
    }));
}

export interface WeekTotal {
  mondayKey: string;
  min: number;
  sessions: number;
}

/** The last `weeks` complete Monday–Sunday weeks, oldest first. */
export function weekTotals(
  history: Session[],
  timezone: string,
  todayKey: string,
  weeks = 8,
): WeekTotal[] {
  const current = mondayOf(todayKey);
  const totals = Array.from({ length: Math.max(1, weeks) }, (_, i) => ({
    mondayKey: addDays(current, -7 * (weeks - i)),
    min: 0,
    sessions: 0,
  }));
  const byMonday = new Map(totals.map((w) => [w.mondayKey, w]));
  for (const s of history) {
    if (!s || !Number.isFinite(s.at) || !Number.isFinite(s.min) || s.min <= 0) continue;
    const week = byMonday.get(mondayOf(dayKeyInTz(s.at, timezone)));
    if (!week) continue;
    week.min += s.min;
    week.sessions += 1;
  }
  return totals.map((w) => ({ ...w, min: Math.round(w.min) }));
}

/** Best and hardest weeks among weeks with focus (needs at least two). */
export function bestWorstWeek(totals: WeekTotal[]): { best: WeekTotal; worst: WeekTotal } | null {
  const active = totals.filter((w) => w.min > 0);
  if (active.length < 2) return null;
  let best = active[0];
  let worst = active[0];
  for (const w of active) {
    if (w.min >= best.min) best = w;
    if (w.min <= worst.min) worst = w;
  }
  if (best === worst) return null;
  return { best, worst };
}

/** Minutes per start hour (0–23) over the trailing window. */
export function focusByHour(
  history: Session[],
  timezone: string,
  now: number,
  days = 60,
): number[] {
  const buckets = new Array<number>(24).fill(0);
  const from = now - Math.max(1, days) * DAY_MS;
  for (const s of sessionsIn(history, from, now)) {
    // A session that crosses midnight counts toward the hour it started.
    const start = s.at - s.min * 60_000;
    const hour = Math.floor(minuteOfDayInTz(start, timezone) / 60) % 24;
    buckets[hour] += s.min;
  }
  return buckets.map((m) => Math.round(m));
}

export function sessionsIn(history: Session[], from: number, to: number): Session[] {
  return history.filter(
    (s) =>
      s &&
      Number.isFinite(s.at) &&
      Number.isFinite(s.min) &&
      s.min > 0 &&
      s.at > from &&
      s.at <= to,
  );
}

export function bestFocusHour(
  buckets: number[],
  sessionCount: number,
): { hour: number; share: number } | null {
  if (sessionCount < MIN_HOUR_SESSIONS) return null;
  const total = buckets.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let hour = 0;
  buckets.forEach((m, h) => {
    if (m > buckets[hour]) hour = h;
  });
  return { hour, share: buckets[hour] / total };
}

export interface EnergyFocus {
  pairedDays: number;
  highAvgMin: number | null;
  lowAvgMin: number | null;
  r: number | null;
  moodHighAvgMin: number | null;
  moodLowAvgMin: number | null;
}

function avg(values: number[]): number | null {
  return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/**
 * Daily check-ins paired with that day's focus minutes (today excluded — it
 * is not over yet). High energy = 4–5, low = 1–2. Null under 7 paired days.
 */
export function energyFocusCorrelation(
  entries: EnergyEntry[],
  history: Session[],
  timezone: string,
  todayKey: string,
  days = 60,
): EnergyFocus | null {
  const first = addDays(todayKey, -Math.max(1, days));
  const focus = new Map<string, number>();
  for (const s of history) {
    if (!s || !Number.isFinite(s.at) || !Number.isFinite(s.min) || s.min <= 0) continue;
    const key = dayKeyInTz(s.at, timezone);
    focus.set(key, (focus.get(key) ?? 0) + s.min);
  }
  const pairs: Array<{ energy: number; mood: number | null; min: number }> = [];
  for (const e of entries) {
    const key = dailyCheckinDay(e);
    if (!key) continue;
    if (compareDayKeys(key, first) < 0 || compareDayKeys(key, todayKey) >= 0) continue;
    const c = dailyCheckinFor([e], key);
    if (c.energy === null) continue;
    pairs.push({ energy: c.energy, mood: c.mood, min: focus.get(key) ?? 0 });
  }
  if (pairs.length < MIN_PAIRED_DAYS) return null;
  return {
    pairedDays: pairs.length,
    highAvgMin: avg(pairs.filter((p) => p.energy >= 4).map((p) => p.min)),
    lowAvgMin: avg(pairs.filter((p) => p.energy <= 2).map((p) => p.min)),
    r: pearson(
      pairs.map((p) => p.energy),
      pairs.map((p) => p.min),
    ),
    moodHighAvgMin: avg(pairs.filter((p) => (p.mood ?? 0) >= 4).map((p) => p.min)),
    moodLowAvgMin: avg(pairs.filter((p) => p.mood !== null && p.mood <= 2).map((p) => p.min)),
  };
}

export interface ReportInsights {
  strengths: HabitStrength[];
  strongest: HabitStrength | null;
  weakest: HabitStrength | null;
  weeks: WeekTotal[];
  bestWorst: { best: WeekTotal; worst: WeekTotal } | null;
  hours: number[];
  bestHour: { hour: number; share: number } | null;
  energy: EnergyFocus | null;
  /** Cards 2–5 that have data (the Free teaser count). */
  lockedWithData: number;
}

export function buildReportInsights(input: {
  habits: Habit[];
  habitLog: HabitLog;
  history: Session[];
  energyLog: EnergyEntry[];
  timezone: string;
  now: number;
  habitTodayKey: string;
}): ReportInsights {
  const { timezone, now } = input;
  const todayKey = dayKeyInTz(now, timezone);
  const strengths = habitStrengths(input.habits, input.habitLog, input.habitTodayKey);
  const strongest = strengths[0] ?? null;
  const weakest = strengths.length >= 2 ? strengths[strengths.length - 1] : null;
  const weeks = weekTotals(input.history, timezone, todayKey);
  const bestWorst = bestWorstWeek(weeks);
  const hourDays = 60;
  const hours = focusByHour(input.history, timezone, now, hourDays);
  const hourSessions = sessionsIn(input.history, now - hourDays * DAY_MS, now).length;
  const bestHour = bestFocusHour(hours, hourSessions);
  const energy = energyFocusCorrelation(input.energyLog, input.history, timezone, todayKey);
  const lockedWithData = [weakest, bestWorst, bestHour, energy].filter((x) => x !== null).length;
  return {
    strengths,
    strongest,
    weakest,
    weeks,
    bestWorst,
    hours,
    bestHour,
    energy,
    lockedWithData,
  };
}
