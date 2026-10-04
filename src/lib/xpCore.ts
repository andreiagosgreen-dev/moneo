/* Pure XP / level / rank math shared by the app (`xp.ts`) and the Worker
 * (`cloudflare/workers/discount.ts`, which recomputes the rank from synced
 * data). Must stay free of imports: the Worker type-checks it without DOM
 * or app modules.
 */

export const XP_RULES = {
  /** XP per focused minute. */
  focusPerMinute: 1,
  /** Focus minutes that count per local day — long marathons don't farm XP. */
  focusDailyCapMin: 240,
  task: 10,
  milestoneTask: 25,
  /** Finished tasks that count per local day — mass check-offs don't farm XP. */
  taskDailyCap: 20,
  habitCheckIn: 5,
  phase: 30,
  project: 100,
  /** A project needs this many tasks (or phases) to earn the finish bonus. */
  projectMinItems: 3,
} as const;

export interface XpSessionLike {
  at: number;
  min: number;
}

export interface XpTaskLike {
  status?: string;
  completedAt?: number | null;
  updatedAt?: number | null;
  milestone?: boolean;
  projectId?: string;
}

export interface XpPhaseLike {
  status?: string;
  projectId?: string;
}

export interface XpProjectLike {
  id: string;
}

export type XpHabitLog = Record<string, string[]>;

export interface XpBreakdown {
  focus: number;
  tasks: number;
  habits: number;
  phases: number;
  projects: number;
  total: number;
}

export type DayKeyFn = (at: number) => string;

/** Device-local "YYYY-M-D" (same format as `localDayKey` in projects.ts). */
export const localDayKeyOf: DayKeyFn = (at) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function validAt(at: unknown): at is number {
  return typeof at === 'number' && Number.isFinite(at);
}

/** 1 XP per focused minute, at most `focusDailyCapMin` minutes per local day. */
export function focusXp(
  history: readonly XpSessionLike[],
  dayKey: DayKeyFn = localDayKeyOf,
): number {
  const perDay = new Map<string, number>();
  for (const s of history) {
    if (!s || !validAt(s.at) || !Number.isFinite(s.min) || s.min <= 0) continue;
    const key = dayKey(s.at);
    perDay.set(key, (perDay.get(key) ?? 0) + Math.floor(s.min));
  }
  let total = 0;
  for (const min of perDay.values()) total += Math.min(min, XP_RULES.focusDailyCapMin);
  return total * XP_RULES.focusPerMinute;
}

/** When a finished task counts: `completedAt`, else `updatedAt`, else 0. */
export function taskCompletedAt(t: XpTaskLike): number {
  return validAt(t.completedAt) ? t.completedAt : validAt(t.updatedAt) ? t.updatedAt : 0;
}

/**
 * Finished tasks: +10, milestones +25. Per local day only the
 * `taskDailyCap` most valuable completions count.
 */
export function taskXp(tasks: readonly XpTaskLike[], dayKey: DayKeyFn = localDayKeyOf): number {
  const perDay = new Map<string, number[]>();
  for (const t of tasks) {
    if (!t || t.status !== 'completed') continue;
    const key = dayKey(taskCompletedAt(t));
    const list = perDay.get(key) ?? [];
    list.push(t.milestone ? XP_RULES.milestoneTask : XP_RULES.task);
    perDay.set(key, list);
  }
  let total = 0;
  for (const list of perDay.values()) {
    list.sort((a, b) => b - a);
    for (const xp of list.slice(0, XP_RULES.taskDailyCap)) total += xp;
  }
  return total;
}

/** +5 per habit per day it was checked (duplicates in the log don't count twice). */
export function habitXp(habitLog: XpHabitLog): number {
  if (!habitLog || typeof habitLog !== 'object') return 0;
  let days = 0;
  for (const list of Object.values(habitLog)) {
    if (!Array.isArray(list)) continue;
    days += new Set(list.filter((d) => typeof d === 'string' && d)).size;
  }
  return days * XP_RULES.habitCheckIn;
}

export function phaseXp(phases: readonly XpPhaseLike[]): number {
  return phases.filter((p) => p && p.status === 'done').length * XP_RULES.phase;
}

/**
 * Projects that count as finished: every task done (with at least
 * `projectMinItems` tasks) or every phase done (same minimum). Archived
 * projects still count — archiving is what people do after finishing.
 */
export function finishedProjectIds(
  projects: readonly XpProjectLike[],
  tasks: readonly XpTaskLike[],
  phases: readonly XpPhaseLike[],
): string[] {
  const min = XP_RULES.projectMinItems;
  const out: string[] = [];
  for (const p of projects) {
    if (!p) continue;
    const owned = tasks.filter((t) => t && t.projectId === p.id);
    const scoped = phases.filter((ph) => ph && ph.projectId === p.id);
    const tasksDone = owned.length >= min && owned.every((t) => t.status === 'completed');
    const phasesDone = scoped.length >= min && scoped.every((ph) => ph.status === 'done');
    if (tasksDone || phasesDone) out.push(p.id);
  }
  return out;
}

export interface XpCoreInput {
  history: readonly XpSessionLike[];
  tasks: readonly XpTaskLike[];
  habitLog: XpHabitLog;
  phases: readonly XpPhaseLike[];
  projects: readonly XpProjectLike[];
}

export function computeXp(input: XpCoreInput, dayKey: DayKeyFn = localDayKeyOf): XpBreakdown {
  const focus = focusXp(input.history ?? [], dayKey);
  const tasks = taskXp(input.tasks ?? [], dayKey);
  const habits = habitXp(input.habitLog ?? {});
  const phases = phaseXp(input.phases ?? []);
  const projects =
    finishedProjectIds(input.projects ?? [], input.tasks ?? [], input.phases ?? []).length *
    XP_RULES.project;
  return {
    focus,
    tasks,
    habits,
    phases,
    projects,
    total: focus + tasks + habits + phases + projects,
  };
}

/* ---------- level curve ---------- */

/** Hard stop for the curve walk; unreachable in practice (~millions of XP). */
export const MAX_LEVEL = 500;

/** XP needed to go from `level` to `level + 1`: ≈ 60·n^1.6, rounded to 5. */
export function xpToNext(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return Math.round((60 * Math.pow(n, 1.6)) / 5) * 5;
}

/** Total XP at which `level` starts (level 1 starts at 0). */
export function xpAtLevel(level: number): number {
  const target = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
  let sum = 0;
  for (let n = 1; n < target; n++) sum += xpToNext(n);
  return sum;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level spans (into / span = progress). */
  span: number;
  /** 0..1 progress towards the next level. */
  progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let rest = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  let level = 1;
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  const span = xpToNext(level);
  return { level, into: rest, span, progress: Math.min(1, rest / span) };
}

/* ---------- ranks ---------- */

export type RankId = 'beginner' | 'apprentice' | 'practitioner' | 'expert' | 'master';

/** Each rank spans a few levels ("tiers"); the last rank never ends. */
export const RANKS: ReadonlyArray<{ id: RankId; firstLevel: number }> = [
  { id: 'beginner', firstLevel: 1 },
  { id: 'apprentice', firstLevel: 4 },
  { id: 'practitioner', firstLevel: 9 },
  { id: 'expert', firstLevel: 15 },
  { id: 'master', firstLevel: 22 },
];

export interface RankInfo {
  id: RankId;
  /** 1-based step inside the rank (Apprentice II → 2). */
  tier: number;
  /** True when `level` is the first level of this rank. */
  isNewRank: boolean;
}

export function rankForLevel(level: number): RankInfo {
  const lv = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (lv >= RANKS[i].firstLevel) idx = i;
  const rank = RANKS[idx];
  const tier = lv - rank.firstLevel + 1;
  return { id: rank.id, tier, isNewRank: tier === 1 };
}

/* ---------- Pro rank reward ---------- */
