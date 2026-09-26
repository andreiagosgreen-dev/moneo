/**
 * Horizon decomposition — turn a timed goal/project into a narrower spine:
 * life → 10y → 7y → 5y → 3y → 1y → quarter → month → week → day,
 * plus hour-sized work slices for Focus.
 *
 * Pure + deterministic; never throws. Persistence is the caller's job.
 */
import type { Goal, GoalLevel } from './goals';
import type { Task, TaskPriority } from './tasks';

/** Broad → narrow spine (includes 7-year checkpoint). */
export const DECOMPOSE_SPINE: GoalLevel[] = [
  'life',
  'years10',
  'years7',
  'years5',
  'years3',
  'vision',
  'milestone',
  'project',
  'weekly',
  'daily',
];

/** Approximate duration in months for each level. */
export const LEVEL_MONTHS: Record<GoalLevel, number> = {
  life: 480,
  years10: 120,
  years7: 84,
  years5: 60,
  years3: 36,
  vision: 12,
  milestone: 3,
  project: 1,
  weekly: 0.25,
  daily: 1 / 30,
};

const MS_PER_MONTH = 30.4375 * 24 * 60 * 60 * 1000;

/** Levels that get concrete Focus tasks (hour estimates). */
const TASK_LEVELS: GoalLevel[] = ['project', 'weekly', 'daily'];

export function levelFromDurationMonths(months: number): GoalLevel {
  const m = Number.isFinite(months) ? Math.max(0, months) : 0;
  if (m >= 400) return 'life';
  if (m >= 100) return 'years10';
  if (m >= 72) return 'years7';
  if (m >= 48) return 'years5';
  if (m >= 24) return 'years3';
  if (m >= 9) return 'vision';
  if (m >= 2) return 'milestone';
  if (m >= 0.75) return 'project';
  if (m >= 0.15) return 'weekly';
  return 'daily';
}

export function levelFromDateRange(startMs: number, endMs: number): GoalLevel {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 'project';
  }
  return levelFromDurationMonths((endMs - startMs) / MS_PER_MONTH);
}

/** Narrower levels below a root (empty when already at daily). */
export function childLevelsBelow(root: GoalLevel): GoalLevel[] {
  const i = DECOMPOSE_SPINE.indexOf(root);
  if (i < 0 || i >= DECOMPOSE_SPINE.length - 1) return [];
  return DECOMPOSE_SPINE.slice(i + 1);
}

export function shouldAutoDecompose(level: GoalLevel): boolean {
  return childLevelsBelow(level).length > 0;
}

/** Default Focus estimate (minutes) for a horizon leaf. */
export function estimateMinForLevel(level: GoalLevel): number {
  switch (level) {
    case 'daily':
      return 60;
    case 'weekly':
      return 120;
    case 'project':
      return 180;
    case 'milestone':
      return 240;
    default:
      return 90;
  }
}

export interface DecomposeGoalOptions {
  now?: number;
  /** Localized level label, e.g. t(GOAL_LEVEL_KEYS[level]). */
  label: (level: GoalLevel) => string;
  /** Cap child count (Free tier room). */
  maxChildren?: number;
  /** Shared project id stamped onto every child. */
  projectId?: string;
}

/**
 * Build a chained spine of child goals under `root`.
 * Each node parents the next narrower level (10y → 7y → … → day).
 */
export function decomposeGoalChildren(root: Goal, opts: DecomposeGoalOptions): Goal[] {
  const levels = childLevelsBelow(root.level);
  const max = opts.maxChildren ?? levels.length;
  const take = levels.slice(0, Math.max(0, max));
  if (take.length === 0) return [];

  const now = opts.now ?? Date.now();
  const rootMonths = Math.max(LEVEL_MONTHS[root.level], LEVEL_MONTHS.daily);
  const end =
    typeof root.targetDate === 'number' && root.targetDate > now
      ? root.targetDate
      : now + rootMonths * MS_PER_MONTH;
  const span = Math.max(MS_PER_MONTH / 30, end - now);
  const projectId = opts.projectId ?? root.projectId;

  const out: Goal[] = [];
  let parentId = root.id;
  for (const level of take) {
    const ratio = Math.min(1, Math.max(LEVEL_MONTHS.daily / rootMonths, LEVEL_MONTHS[level] / rootMonths));
    const targetDate = Math.round(now + span * ratio);
    const title = `${opts.label(level)} · ${root.title}`.slice(0, 120);
    const g: Goal = {
      id: crypto.randomUUID(),
      title,
      level,
      parentId,
      ...(projectId ? { projectId } : {}),
      targetDate,
      createdAt: now,
      updatedAt: now,
    };
    out.push(g);
    parentId = g.id;
  }
  return out;
}

export interface DecomposeTaskDraft {
  title: string;
  estimateMin: number;
  priority: TaskPriority;
  /** Horizon this task represents (for pickers). */
  level: GoalLevel;
}

/**
 * Hour / day / week / month work slices for a project with a deadline.
 * Day horizon expands into concrete hour blocks for the Focus timer.
 */
export function decomposeProjectTasks(
  projectName: string,
  startMs: number,
  deadlineMs: number,
  label: (level: GoalLevel) => string,
): DecomposeTaskDraft[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(deadlineMs) || deadlineMs <= startMs) {
    return [];
  }
  const rootLevel = levelFromDateRange(startMs, deadlineMs);
  const levels = [rootLevel, ...childLevelsBelow(rootLevel)].filter((l, i, a) => a.indexOf(l) === i);
  const clean = projectName.trim().slice(0, 60) || 'Project';
  const drafts: DecomposeTaskDraft[] = [];

  for (const level of levels) {
    if (!TASK_LEVELS.includes(level) && level !== 'milestone' && level !== 'vision') {
      // Long horizons: one checkpoint task each
      if (LEVEL_MONTHS[level] >= 12) {
        drafts.push({
          title: `${label(level)} · ${clean}`.slice(0, 120),
          estimateMin: estimateMinForLevel(level),
          priority: level === rootLevel ? 'p1' : 'p2',
          level,
        });
      }
      continue;
    }
    if (level === 'daily') {
      // Day → hours: two focus blocks
      drafts.push({
        title: `${label('daily')} · 2h · ${clean}`.slice(0, 120),
        estimateMin: 120,
        priority: 'p1',
        level: 'daily',
      });
      drafts.push({
        title: `${label('daily')} · 1h · ${clean}`.slice(0, 120),
        estimateMin: 60,
        priority: 'p2',
        level: 'daily',
      });
      continue;
    }
    drafts.push({
      title: `${label(level)} · ${clean}`.slice(0, 120),
      estimateMin: estimateMinForLevel(level),
      priority: level === 'weekly' || level === 'project' ? 'p1' : 'p2',
      level,
    });
  }

  // Cap noise
  return drafts.slice(0, 12);
}

/** Task drafts for goal spine leaves that Focus can select. */
export function decomposeGoalTaskDrafts(
  children: Goal[],
  rootTitle: string,
  label: (level: GoalLevel) => string,
): DecomposeTaskDraft[] {
  const drafts: DecomposeTaskDraft[] = [];
  for (const g of children) {
    if (!TASK_LEVELS.includes(g.level)) continue;
    if (g.level === 'daily') {
      drafts.push({
        title: `${label('daily')} · 2h · ${rootTitle}`.slice(0, 120),
        estimateMin: 120,
        priority: 'p1',
        level: 'daily',
      });
      drafts.push({
        title: `${label('daily')} · 1h · ${rootTitle}`.slice(0, 120),
        estimateMin: 60,
        priority: 'p2',
        level: 'daily',
      });
    } else {
      drafts.push({
        title: g.title.slice(0, 120),
        estimateMin: estimateMinForLevel(g.level),
        priority: g.level === 'weekly' ? 'p1' : 'p2',
        level: g.level,
      });
    }
  }
  return drafts.slice(0, 12);
}

/** Attach estimateMin onto a freshly created task. */
export function withEstimate(task: Task, estimateMin: number): Task {
  const m = Math.min(480, Math.max(5, Math.round(estimateMin)));
  return { ...task, estimateMin: m, updatedAt: Date.now() };
}
