/**
 * "How last week went" (Stage 3). XP and badges are derived, so what was
 * gained last week is the difference between two snapshots of the same data.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead, safeWrite } from './storage/storageAdapter';
import { computeXp, type XpInput } from './xp';
import { computeBadges, type BadgeId } from './badges';
import { dayKeyInTz } from './timezone';
import { addDays, compareDayKeys, mondayOf } from './dayKeys';

export interface LastWeekRecap {
  start: string;
  end: string;
  focusMin: number;
  sessions: number;
  tasksDone: number;
  habitCheckins: number;
  xpGained: number;
  newBadges: BadgeId[];
  bestDay: { key: string; min: number } | null;
}

/** Previous Monday..Sunday relative to `todayKey`. */
export function lastWeekRange(todayKey: string): { start: string; end: string } {
  const start = addDays(mondayOf(todayKey), -7);
  return { start, end: addDays(start, 6) };
}

function inRange(key: string, start: string, end: string): boolean {
  return compareDayKeys(key, start) >= 0 && compareDayKeys(key, end) <= 0;
}

/** The same data as it stood at the end of `endKey`. */
export function snapshotAt(input: XpInput, endKey: string, timezone: string): XpInput {
  const upTo = (key: string) => compareDayKeys(key, endKey) <= 0;
  const habitLog: XpInput['habitLog'] = {};
  for (const [id, days] of Object.entries(input.habitLog ?? {})) {
    if (Array.isArray(days)) habitLog[id] = days.filter(upTo);
  }
  return {
    history: (input.history ?? []).filter((s) => upTo(dayKeyInTz(s.at, timezone))),
    tasks: (input.tasks ?? []).map((t) =>
      t.status === 'completed' &&
      (typeof t.completedAt !== 'number' || !upTo(dayKeyInTz(t.completedAt, timezone)))
        ? { ...t, status: 'pending' as const }
        : t,
    ),
    habitLog,
    phases: input.phases ?? [],
    projects: input.projects ?? [],
  };
}

export function buildLastWeekRecap(
  input: XpInput & { timezone: string; todayKey: string },
): LastWeekRecap {
  const { timezone } = input;
  const { start, end } = lastWeekRange(input.todayKey);

  const perDay = new Map<string, number>();
  let sessions = 0;
  for (const s of input.history ?? []) {
    if (!s || !Number.isFinite(s.at) || !Number.isFinite(s.min)) continue;
    const key = dayKeyInTz(s.at, timezone);
    if (!inRange(key, start, end)) continue;
    sessions += 1;
    perDay.set(key, (perDay.get(key) ?? 0) + s.min);
  }
  let focusMin = 0;
  let bestDay: LastWeekRecap['bestDay'] = null;
  for (const [key, min] of perDay) {
    focusMin += min;
    if (min > 0 && (!bestDay || min > bestDay.min)) bestDay = { key, min: Math.round(min) };
  }

  const tasksDone = (input.tasks ?? []).filter(
    (t) =>
      t.status === 'completed' &&
      typeof t.completedAt === 'number' &&
      inRange(dayKeyInTz(t.completedAt, timezone), start, end),
  ).length;

  let habitCheckins = 0;
  for (const days of Object.values(input.habitLog ?? {})) {
    if (Array.isArray(days)) habitCheckins += days.filter((k) => inRange(k, start, end)).length;
  }

  const before = snapshotAt(input, addDays(start, -1), timezone);
  const after = snapshotAt(input, end, timezone);
  const xpBefore = computeXp(before).total;
  const xpAfter = computeXp(after).total;
  const earnedBefore = new Set(
    computeBadges({ ...before, totalXp: xpBefore })
      .filter((b) => b.earned)
      .map((b) => b.id),
  );
  const newBadges = computeBadges({ ...after, totalXp: xpAfter })
    .filter((b) => b.earned && !earnedBefore.has(b.id))
    .map((b) => b.id);

  return {
    start,
    end,
    focusMin: Math.round(focusMin),
    sessions,
    tasksDone,
    habitCheckins,
    xpGained: Math.max(0, Math.round(xpAfter - xpBefore)),
    newBadges,
    bestDay,
  };
}

export function recapHasActivity(r: LastWeekRecap): boolean {
  return r.focusMin > 0 || r.tasksDone > 0 || r.habitCheckins > 0;
}

export function shouldShowRecap(args: {
  todayKey: string;
  seenMonday: string | null;
  recap: LastWeekRecap;
  firstRun: boolean;
}): boolean {
  return (
    !args.firstRun && recapHasActivity(args.recap) && args.seenMonday !== mondayOf(args.todayKey)
  );
}

export function loadRecapSeen(): string | null {
  const v = safeRead<string>(STORAGE_KEYS.weekRecapSeen);
  return typeof v === 'string' ? v : null;
}

export function saveRecapSeen(mondayKey: string): boolean {
  return safeWrite(STORAGE_KEYS.weekRecapSeen, mondayKey);
}
