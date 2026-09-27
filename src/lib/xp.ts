/* Experience points & ranks — derived, never stored. XP is recomputed from
 * the work the user already has on this device (focus sessions, finished
 * tasks, habit check-ins, finished phases and projects), so there is no
 * counter to drift, double-count or "fix". The only persisted bit is the
 * last level the user has already seen, so a level-up celebrates once.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead, safeWrite } from './storage/storageAdapter';
import { localDayKey, type Project } from './projects';
import type { HabitLog } from './habits';
import type { Session } from './store';
import type { Task } from './tasks';
import type { WaterfallPhase } from './waterfall';

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

export interface XpInput {
  history: Session[];
  tasks: Task[];
  habitLog: HabitLog;
  phases: WaterfallPhase[];
  projects: Project[];
}

export interface XpBreakdown {
  focus: number;
  tasks: number;
  habits: number;
  phases: number;
  projects: number;
  total: number;
}

function validAt(at: unknown): at is number {
  return typeof at === 'number' && Number.isFinite(at);
}

/** 1 XP per focused minute, at most `focusDailyCapMin` minutes per local day. */
export function focusXp(history: Session[]): number {
  const perDay = new Map<string, number>();
  for (const s of history) {
    if (!s || !validAt(s.at) || !Number.isFinite(s.min) || s.min <= 0) continue;
    const key = localDayKey(s.at);
    perDay.set(key, (perDay.get(key) ?? 0) + Math.floor(s.min));
  }
  let total = 0;
  for (const min of perDay.values()) total += Math.min(min, XP_RULES.focusDailyCapMin);
  return total * XP_RULES.focusPerMinute;
}

/**
 * Finished tasks: +10, milestones +25. Per local day only the
 * `taskDailyCap` most valuable completions count.
 */
export function taskXp(tasks: Task[]): number {
  const perDay = new Map<string, number[]>();
  for (const t of tasks) {
    if (!t || t.status !== 'completed') continue;
    const at = validAt(t.completedAt) ? t.completedAt : validAt(t.updatedAt) ? t.updatedAt : 0;
    const key = localDayKey(at);
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
export function habitXp(habitLog: HabitLog): number {
  if (!habitLog || typeof habitLog !== 'object') return 0;
  let days = 0;
  for (const list of Object.values(habitLog)) {
    if (!Array.isArray(list)) continue;
    days += new Set(list.filter((d) => typeof d === 'string' && d)).size;
  }
  return days * XP_RULES.habitCheckIn;
}

export function phaseXp(phases: WaterfallPhase[]): number {
  return phases.filter((p) => p && p.status === 'done').length * XP_RULES.phase;
}

/**
 * Projects that count as finished: every task done (with at least
 * `projectMinItems` tasks) or every phase done (same minimum). Archived
 * projects still count — archiving is what people do after finishing.
 */
export function finishedProjectIds(
  projects: Project[],
  tasks: Task[],
  phases: WaterfallPhase[],
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

export function computeXp(input: XpInput): XpBreakdown {
  const focus = focusXp(input.history ?? []);
  const tasks = taskXp(input.tasks ?? []);
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

const ROMAN: Array<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function romanNumeral(n: number): string {
  let rest = Math.max(1, Math.min(3999, Math.floor(n)));
  let out = '';
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/* ---------- level-up detection (the only persisted state) ---------- */

/**
 * Bigger jumps come from a sync pull or a restored backup, not from one
 * real action — those update silently instead of celebrating.
 */
export const MAX_CELEBRATED_JUMP = 2;

export interface LevelUpCheck {
  /** Level to celebrate, or null. */
  celebrate: number | null;
  /** What to store as the last seen level. */
  seen: number;
}

/**
 * First run (nothing seen yet) adopts the current level quietly. A level
 * above the last seen one celebrates once; dropping back (a task unchecked)
 * never lowers the mark, so un-checking and re-checking can't replay it.
 */
export function levelUpCheck(level: number, lastSeen: number | null): LevelUpCheck {
  const lv = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  if (lastSeen === null || !Number.isFinite(lastSeen) || lastSeen < 1) {
    return { celebrate: null, seen: lv };
  }
  const prev = Math.floor(lastSeen);
  if (lv <= prev) return { celebrate: null, seen: prev };
  return { celebrate: lv - prev <= MAX_CELEBRATED_JUMP ? lv : null, seen: lv };
}

export function loadLastSeenLevel(): number | null {
  const stored = safeRead<{ level?: unknown }>(STORAGE_KEYS.xpSeen);
  const level = stored && typeof stored === 'object' ? stored.level : undefined;
  return typeof level === 'number' && Number.isFinite(level) && level >= 1
    ? Math.floor(level)
    : null;
}

export function saveLastSeenLevel(level: number): boolean {
  return safeWrite(STORAGE_KEYS.xpSeen, { level });
}
