import { dayKeyInTz } from './timezone';

export type RangeKey = 'week' | 'month';

export interface RangeLabel {
  key: RangeKey;
  days: number;
  label: string;
}

export const RANGES: RangeLabel[] = [
  { key: 'week', days: 7, label: '7 days' },
  { key: 'month', days: 30, label: '30 days' },
];

/** Day key → minutes map entry. */
export interface DayBucket {
  key: string;
  min: number;
}

/** Project distribution entry. */
export interface ProjectSlice {
  projectId: string;
  name: string;
  color: string;
  min: number;
}

/** Area distribution entry. */
export interface AreaSlice {
  areaId: string;
  name: string;
  min: number;
}

/** Per-task breakdown within a project or globally. */
export interface TaskSlice {
  taskId: string;
  title: string;
  min: number;
}

export interface ReportSummary {
  totalMin: number;
  sessionCount: number;
  avgMinPerDay: number;
  topDay: DayBucket | null;
  topProject: ProjectSlice | null;
  /** Total minutes in the equivalent period immediately before this range. */
  previousTotalMin: number;
}

export interface ReportData {
  days: DayBucket[];
  projects: ProjectSlice[];
  areas: AreaSlice[];
  tasks: TaskSlice[];
  summary: ReportSummary;
}

interface SessionLike {
  at: number;
  min: number;
  projectId?: string;
  areaId?: string;
  taskId?: string;
}

interface ProjectLike {
  id: string;
  name: string;
  color: string;
}

interface AreaLike {
  id: string;
  name: string;
}

interface TaskLike {
  id: string;
  title: string;
}

/**
 * Returns the day keys for the given range (oldest → newest), anchored at
 * `anchor` (defaults to now). Passing an earlier anchor lets callers walk
 * back to a prior, equivalent-length period for trend comparisons.
 */
export function rangeDayKeys(
  range: RangeKey,
  timezone: string,
  anchor: number = Date.now(),
): string[] {
  const days = RANGES.find((r) => r.key === range)!.days;
  const keys: string[] = [];
  const seen = new Set<string>();
  for (let back = 0; keys.length < days && back <= days * 4; back++) {
    const key = dayKeyInTz(anchor - back * 12 * 3600_000, timezone);
    if (!seen.has(key)) {
      seen.add(key);
      keys.unshift(key);
    }
  }
  return keys.slice(-days);
}

/**
 * Day keys for the equivalent period immediately before `range`, for
 * week-over-week / month-over-month trend comparisons.
 */
function previousRangeDayKeys(range: RangeKey, timezone: string): string[] {
  const days = RANGES.find((r) => r.key === range)!.days;
  return rangeDayKeys(range, timezone, Date.now() - days * 24 * 3600_000);
}

/**
 * Trailing moving average of minutes, aligned one-to-one with `days`.
 * Early buckets average over however many days are available so far.
 */
export function movingAverage(days: DayBucket[], window: number): number[] {
  const out: number[] = [];
  const queue: number[] = [];
  let sum = 0;
  for (const d of days) {
    queue.push(d.min);
    sum += d.min;
    if (queue.length > window) sum -= queue.shift()!;
    out.push(sum / queue.length);
  }
  return out;
}

/**
 * Filter sessions that fall within the range.
 */
function sessionsInRange(
  history: SessionLike[],
  dayKeys: string[],
  timezone: string,
): SessionLike[] {
  const valid = new Set(dayKeys);
  return history.filter((s) => valid.has(dayKeyInTz(s.at, timezone)));
}

/**
 * Aggregate minutes per day within the range.
 */
function aggregateDays(history: SessionLike[], dayKeys: string[], timezone: string): DayBucket[] {
  const counts = new Map<string, number>();
  for (const key of dayKeys) counts.set(key, 0);
  for (const s of history) {
    const key = dayKeyInTz(s.at, timezone);
    counts.set(key, (counts.get(key) ?? 0) + s.min);
  }
  return dayKeys.map((key) => ({ key, min: counts.get(key) ?? 0 }));
}

/**
 * Aggregate minutes per project within the range.
 */
function aggregateProjects(
  history: SessionLike[],
  projectMap: Map<string, ProjectLike>,
): ProjectSlice[] {
  const counts = new Map<string, number>();
  for (const s of history) {
    const pid = s.projectId ?? '_unassigned';
    counts.set(pid, (counts.get(pid) ?? 0) + s.min);
  }
  const slices: ProjectSlice[] = [];
  for (const [projectId, min] of counts) {
    if (min <= 0) continue;
    const proj = projectMap.get(projectId);
    slices.push({
      projectId,
      name: proj?.name ?? 'Unassigned',
      color: proj?.color ?? '#94a3b8',
      min,
    });
  }
  slices.sort((a, b) => b.min - a.min);
  return slices;
}

/**
 * Aggregate minutes per focus area within the range.
 */
function aggregateAreas(history: SessionLike[], areaMap: Map<string, AreaLike>): AreaSlice[] {
  const counts = new Map<string, number>();
  for (const s of history) {
    const aid = s.areaId ?? '_none';
    counts.set(aid, (counts.get(aid) ?? 0) + s.min);
  }
  const slices: AreaSlice[] = [];
  for (const [areaId, min] of counts) {
    if (min <= 0) continue;
    const area = areaMap.get(areaId);
    slices.push({
      areaId,
      name: area?.name ?? 'No area',
      min,
    });
  }
  slices.sort((a, b) => b.min - a.min);
  return slices;
}

/**
 * Aggregate minutes per task within the range.
 */
function aggregateTasks(history: SessionLike[], taskMap: Map<string, TaskLike>): TaskSlice[] {
  const counts = new Map<string, number>();
  for (const s of history) {
    if (!s.taskId) continue;
    counts.set(s.taskId, (counts.get(s.taskId) ?? 0) + s.min);
  }
  const slices: TaskSlice[] = [];
  for (const [taskId, min] of counts) {
    if (min <= 0) continue;
    const task = taskMap.get(taskId);
    slices.push({ taskId, title: task?.title ?? 'Deleted task', min });
  }
  slices.sort((a, b) => b.min - a.min);
  return slices;
}

/**
 * Build the full report data for the given range.
 */
export function buildReport(
  history: SessionLike[],
  projects: ProjectLike[],
  areas: AreaLike[],
  tasks: TaskLike[],
  range: RangeKey,
  timezone: string,
): ReportData {
  const dayKeys = rangeDayKeys(range, timezone);
  const inRange = sessionsInRange(history, dayKeys, timezone);
  const prevDayKeys = previousRangeDayKeys(range, timezone);
  const previousTotalMin = sessionsInRange(history, prevDayKeys, timezone).reduce(
    (sum, s) => sum + s.min,
    0,
  );

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const days = aggregateDays(inRange, dayKeys, timezone);
  const projectSlices = aggregateProjects(inRange, projectMap);
  const areaSlices = aggregateAreas(inRange, areaMap);
  const taskSlices = aggregateTasks(inRange, taskMap);

  const totalMin = inRange.reduce((sum, s) => sum + s.min, 0);
  const sessionCount = inRange.length;
  const avgMinPerDay = dayKeys.length > 0 ? Math.round(totalMin / dayKeys.length) : 0;

  const topDay = days.reduce(
    (best, d) => (d.min > (best?.min ?? 0) ? d : best),
    null as DayBucket | null,
  );

  const topProject = projectSlices.length > 0 ? projectSlices[0] : null;

  return {
    days,
    projects: projectSlices,
    areas: areaSlices,
    tasks: taskSlices,
    summary: { totalMin, sessionCount, avgMinPerDay, topDay, topProject, previousTotalMin },
  };
}

/* ---------------- pareto split (Roadmap 3.4) ---------------- */

export interface ParetoSplit<T> {
  /** Head slices covering ~80% of minutes ("the vital few"). */
  top: T[];
  /** Remaining slices ("the trivial many"). */
  rest: T[];
  /** Actual share of minutes held by `top`, 0..1. */
  topShare: number;
}

/**
 * Split minute-sorted slices into the head covering ≥80% of minutes.
 * Never throws.
 */
export function paretoSplit<T extends { min: number }>(slices: T[]): ParetoSplit<T> {
  const total = slices.reduce((sum, s) => sum + (typeof s.min === 'number' ? s.min : 0), 0);
  if (total <= 0) return { top: [], rest: slices.slice(), topShare: 0 };
  const top: T[] = [];
  let acc = 0;
  for (const s of slices) {
    top.push(s);
    acc += typeof s.min === 'number' ? s.min : 0;
    if (acc / total >= 0.8) break;
  }
  return { top, rest: slices.slice(top.length), topShare: acc / total };
}
