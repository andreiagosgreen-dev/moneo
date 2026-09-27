/* Goal hierarchy (Roadmap Phase 4.2) — vision → milestone → project → weekly.
 *
 * Progress rolls up automatically: a parent averages its children, a leaf
 * linked to a project mirrors that project's task completion, otherwise a
 * manual 0-100 override applies. Pure functions; storage via STORAGE_KEYS.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { projectCompletion, type Task } from './tasks';
import { createI18n, type I18n } from './i18n';

/** Default English translator — keeps helpers usable without a provider. */
const EN_I18N = createI18n('en');

export type GoalLevel =
  | 'life'
  | 'years10'
  | 'years7'
  | 'years5'
  | 'years3'
  | 'vision'
  | 'milestone'
  | 'project'
  | 'weekly'
  | 'daily';

export const GOAL_LEVELS: GoalLevel[] = [
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

export const GOAL_LEVEL_LABELS: Record<GoalLevel, string> = {
  life: 'Life',
  years10: '10 years',
  years7: '7 years',
  years5: '5 years',
  years3: '3 years',
  vision: '1 year',
  milestone: 'Quarter',
  project: 'Month',
  weekly: 'Week',
  daily: 'Day',
};

/** Translation keys mirroring GOAL_LEVEL_LABELS (UI renders via t()). */
export const GOAL_LEVEL_KEYS: Record<GoalLevel, string> = {
  life: 'goal.level.life',
  years10: 'goal.level.years10',
  years7: 'goal.level.years7',
  years5: 'goal.level.years5',
  years3: 'goal.level.years3',
  vision: 'goal.level.vision',
  milestone: 'goal.level.milestone',
  project: 'goal.level.project',
  weekly: 'goal.level.weekly',
  daily: 'goal.level.daily',
};

/** Short badge keys (first word of each level). */
export const GOAL_SHORT_KEYS: Record<GoalLevel, string> = {
  life: 'goal.short.life',
  years10: 'goal.short.years10',
  years7: 'goal.short.years7',
  years5: 'goal.short.years5',
  years3: 'goal.short.years3',
  vision: 'goal.short.vision',
  milestone: 'goal.short.milestone',
  project: 'goal.short.project',
  weekly: 'goal.short.weekly',
  daily: 'goal.short.daily',
};

/** Broader → narrower. A parent must sit strictly above its child. */
const LEVEL_RANK: Record<GoalLevel, number> = {
  life: 0,
  years10: 1,
  years7: 2,
  years5: 3,
  years3: 4,
  vision: 5,
  milestone: 6,
  project: 7,
  weekly: 8,
  daily: 9,
};

export interface Goal {
  id: string;
  title: string;
  level: GoalLevel;
  parentId?: string;
  /** Linked project: leaf progress mirrors its task completion. */
  projectId?: string;
  /** Linked life area (Roadmap 5.2 life-area goals). */
  lifeAreaId?: string;
  /** Goal-level dependencies: ids that should finish first (Roadmap 4.2). */
  blockedBy?: string[];
  /** Target date in epoch ms. */
  targetDate?: number;
  /** Time capsule (Faza 26): a note delivered as a notification once targetDate arrives. */
  capsuleNote?: string;
  /** Manual 0-100 progress (used when no children / no linked project). */
  progress?: number;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Free tier holds a handful of goals; Pro is unlimited. */
export const FREE_GOALS_LIMIT = 3;

function byId(goals: Goal[]): Map<string, Goal> {
  return new Map(goals.map((g) => [g.id, g]));
}

export function canParent(childLevel: GoalLevel, parent: Goal): boolean {
  return LEVEL_RANK[parent.level] < LEVEL_RANK[childLevel];
}

/** Load goals, defaulting additive fields so legacy payloads stay valid. */
export function loadGoals(): Goal[] {
  const stored = read<Goal[]>(STORAGE_KEYS.goals);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((g) => g && typeof g.id === 'string' && typeof g.title === 'string')
    .map((g) => ({
      id: g.id,
      title: g.title,
      level: GOAL_LEVELS.includes(g.level as GoalLevel) ? (g.level as GoalLevel) : 'project',
      ...(typeof g.parentId === 'string' && g.parentId ? { parentId: g.parentId } : {}),
      ...(typeof g.projectId === 'string' && g.projectId ? { projectId: g.projectId } : {}),
      ...(typeof g.lifeAreaId === 'string' && g.lifeAreaId ? { lifeAreaId: g.lifeAreaId } : {}),
      ...(Array.isArray(g.blockedBy)
        ? { blockedBy: g.blockedBy.filter((b) => typeof b === 'string' && b) }
        : {}),
      ...(typeof g.targetDate === 'number' && Number.isFinite(g.targetDate)
        ? { targetDate: g.targetDate }
        : {}),
      ...(typeof g.capsuleNote === 'string' && g.capsuleNote.trim()
        ? { capsuleNote: g.capsuleNote.slice(0, 500) }
        : {}),
      ...(typeof g.progress === 'number' && Number.isFinite(g.progress)
        ? { progress: Math.min(100, Math.max(0, Math.round(g.progress))) }
        : {}),
      ...(g.archived === true ? { archived: true as const } : {}),
      createdAt: typeof g.createdAt === 'number' ? g.createdAt : Date.now(),
      updatedAt: typeof g.updatedAt === 'number' ? g.updatedAt : Date.now(),
    }));
}

export function saveGoals(goals: Goal[]): boolean {
  return write(STORAGE_KEYS.goals, goals);
}

/**
 * Create a goal object (null when the parent link is illegal).
 * Persistence is the caller's job via saveGoals.
 */
export function createGoalObject(
  goals: Goal[],
  title: string,
  level: GoalLevel,
  parentId?: string,
): Goal | null {
  const clean = title.trim();
  if (!clean) return null;
  if (parentId) {
    const parent = byId(goals).get(parentId);
    if (!parent || parent.archived || !canParent(level, parent)) return null;
  }
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: clean,
    level,
    ...(parentId ? { parentId } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export interface GoalUpdates {
  title?: string;
  level?: GoalLevel;
  parentId?: string | null;
  projectId?: string | null;
  lifeAreaId?: string | null;
  targetDate?: number | null;
  capsuleNote?: string | null;
  progress?: number | null;
  archived?: boolean;
}

/** Apply updates; illegal parent/level moves leave the list unchanged for that goal. */
export function updateGoal(goals: Goal[], id: string, updates: GoalUpdates): Goal[] {
  return goals.map((g) => {
    if (g.id !== id) return g;
    const next: Goal = { ...g, updatedAt: Date.now() };
    if (updates.title !== undefined) next.title = updates.title.trim() || g.title;
    if (updates.archived !== undefined) {
      if (updates.archived) next.archived = true;
      else delete next.archived;
    }
    if (updates.projectId !== undefined) {
      if (updates.projectId) next.projectId = updates.projectId;
      else delete next.projectId;
    }
    if (updates.lifeAreaId !== undefined) {
      if (updates.lifeAreaId) next.lifeAreaId = updates.lifeAreaId;
      else delete next.lifeAreaId;
    }
    if (updates.targetDate !== undefined) {
      if (updates.targetDate !== null && Number.isFinite(updates.targetDate)) {
        next.targetDate = updates.targetDate;
      } else delete next.targetDate;
    }
    if (updates.capsuleNote !== undefined) {
      const trimmed = updates.capsuleNote?.trim();
      if (trimmed) next.capsuleNote = trimmed.slice(0, 500);
      else delete next.capsuleNote;
    }
    if (updates.progress !== undefined) {
      if (updates.progress !== null && Number.isFinite(updates.progress)) {
        next.progress = Math.min(100, Math.max(0, Math.round(updates.progress)));
      } else delete next.progress;
    }
    const newLevel = updates.level ?? next.level;
    const newParentId = updates.parentId !== undefined ? updates.parentId : next.parentId;
    if (updates.level !== undefined || updates.parentId !== undefined) {
      if (newParentId) {
        const parent = byId(goals).get(newParentId);
        if (
          !parent ||
          parent.id === id ||
          parent.archived ||
          !canParent(newLevel, parent) ||
          descendantIds(goals, id).includes(newParentId)
        ) {
          return g;
        }
        next.parentId = newParentId;
      } else {
        delete next.parentId;
      }
      if (updates.level !== undefined) {
        // Level change must keep existing children narrower than the new level.
        const kids = childrenOf(goals, id);
        if (kids.some((k) => LEVEL_RANK[k.level] <= LEVEL_RANK[newLevel])) return g;
        next.level = newLevel;
      }
    }
    return next;
  });
}

/**
 * Delete a goal; its children re-attach to the deleted goal's parent
 * (or become roots) so no subtree is lost by accident.
 */
export function deleteGoal(goals: Goal[], id: string): Goal[] {
  const doomed = byId(goals).get(id);
  if (!doomed) return goals;
  const now = Date.now();
  return goals
    .filter((g) => g.id !== id)
    .map((g) => {
      if (g.parentId !== id) return g;
      const next: Goal = { ...g, updatedAt: now };
      if (doomed.parentId) next.parentId = doomed.parentId;
      else delete next.parentId;
      return next;
    });
}

/** All descendant ids of a goal (cycle-safe). */
export function descendantIds(goals: Goal[], goalId: string): string[] {
  const children = new Map<string, string[]>();
  for (const g of goals) {
    if (g.parentId) {
      const list = children.get(g.parentId) ?? [];
      list.push(g.id);
      children.set(g.parentId, list);
    }
  }
  const out: string[] = [];
  const seen = new Set([goalId]);
  const stack = [...(children.get(goalId) ?? [])];
  while (stack.length > 0) {
    const gid = stack.pop()!;
    if (seen.has(gid)) continue;
    seen.add(gid);
    out.push(gid);
    stack.push(...(children.get(gid) ?? []));
  }
  return out;
}

export function childrenOf(goals: Goal[], parentId: string): Goal[] {
  return goals
    .filter((g) => g.parentId === parentId && !g.archived)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function rootGoals(goals: Goal[]): Goal[] {
  return goals
    .filter((g) => !g.parentId && !g.archived)
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.createdAt - b.createdAt);
}

export function archivedGoals(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.archived).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The (unarchived) goal directly linked to a project, if any. */
export function goalForProject(goals: Goal[], projectId: string): Goal | null {
  return goals.find((g) => g.projectId === projectId && !g.archived) ?? null;
}

/** A goal's ancestor chain, broadest first, ending with the goal itself. */
export function goalAncestry(goals: Goal[], goalId: string): Goal[] {
  const index = byId(goals);
  const chain: Goal[] = [];
  const seen = new Set<string>();
  let current = index.get(goalId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? index.get(current.parentId) : undefined;
  }
  return chain;
}

/**
 * Progress 0-100: children average → linked project completion → manual
 * override → 0. Cycle-safe. Never throws.
 */
export function goalProgress(
  goals: Goal[],
  tasks: Task[],
  goalId: string,
  seen: Set<string> = new Set(),
): number {
  const goal = byId(goals).get(goalId);
  if (!goal || seen.has(goalId)) return 0;
  seen.add(goalId);
  const kids = childrenOf(goals, goalId);
  if (kids.length > 0) {
    const sum = kids.reduce((acc, k) => acc + goalProgress(goals, tasks, k.id, seen), 0);
    return Math.round(sum / kids.length);
  }
  if (goal.projectId) {
    const { done, total } = projectCompletion(tasks, goal.projectId);
    if (total > 0) return Math.round((done / total) * 100);
  }
  return typeof goal.progress === 'number' ? goal.progress : 0;
}

/* ---------------- goal dependencies (Roadmap 4.2) ---------------- */

function goalWouldCycle(goals: Goal[], goalId: string, candidateId: string): boolean {
  const index = byId(goals);
  const stack = [candidateId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === goalId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(index.get(id)?.blockedBy ?? []));
  }
  return false;
}

/**
 * Replace a goal's dependency list. Kept refs must exist, be non-self,
 * non-archived and cycle-free. Never throws.
 */
export function setGoalBlockedBy(goals: Goal[], goalId: string, blockerIds: string[]): Goal[] {
  const goal = byId(goals).get(goalId);
  if (!goal) return goals;
  const index = byId(goals);
  const kept = Array.from(new Set(blockerIds.filter((b) => typeof b === 'string' && b))).filter(
    (b) =>
      b !== goalId &&
      index.get(b) !== undefined &&
      !index.get(b)!.archived &&
      !goalWouldCycle(goals, goalId, b),
  );
  return goals.map((g) => {
    if (g.id !== goalId) return g;
    const next: Goal = { ...g, updatedAt: Date.now() };
    if (kept.length > 0) next.blockedBy = kept;
    else delete next.blockedBy;
    return next;
  });
}

/** Unfinished dependencies (progress < 100) for display. Never throws. */
export function goalBlockers(goals: Goal[], tasks: Task[], goal: Goal): Goal[] {
  if (!goal.blockedBy || goal.blockedBy.length === 0) return [];
  const index = byId(goals);
  return goal.blockedBy
    .map((b) => index.get(b))
    .filter((b): b is Goal => !!b && goalProgress(goals, tasks, b.id) < 100);
}

/* ---------------- rule-based task generation (Phase 4.3) ---------------- */

const GOAL_BLUEPRINTS: Array<{ match: RegExp; steps: string[] }> = [
  {
    match: /learn|study|course|master/i,
    steps: [
      'Define what "done" looks like',
      'Complete the first module',
      'Build a practice exercise',
      'Teach it back in writing',
    ],
  },
  {
    match: /launch|ship|release|publish/i,
    steps: [
      'Write a one-paragraph scope',
      'Build the smallest version',
      'Test with one real user',
      'Announce publicly',
    ],
  },
  {
    match: /write|book|article|blog/i,
    steps: ['Outline the headlines', 'Ugly first draft', 'Edit pass with examples', 'Publish'],
  },
  {
    match: /fit|health|run|gym|sport/i,
    steps: [
      'Baseline week: track everything',
      'Schedule 3 sessions',
      'Log every session',
      'Review and adjust',
    ],
  },
  {
    match: /save|money|debt|budget/i,
    steps: [
      'Compute the exact number',
      'Automate one transfer',
      'Cut one recurring expense',
      'Monthly review',
    ],
  },
];

const DEFAULT_STEPS = [
  'Define done in one sentence',
  'Split into 3 concrete milestones',
  'Do the first concrete step',
  'Weekly review',
];

/** Suggest starter tasks for a goal title (Roadmap 4.3, rule-based). */
export function suggestTasksForGoal(title: string): string[] {
  const clean = title.trim();
  if (!clean) return [];
  for (const bp of GOAL_BLUEPRINTS) {
    if (bp.match.test(clean)) return [...bp.steps];
  }
  return [...DEFAULT_STEPS];
}

/* ---------------- SMART check + conflicts (Roadmap 4.3/4.2) ---------------- */

export interface SmartCheck {
  specific: boolean;
  measurable: boolean;
  achievable: boolean;
  relevant: boolean;
  timeBound: boolean;
  score: number; // 0-5 passed letters
  tips: string[];
}

/**
 * Heuristic SMART scan of a goal title: numbers/units → measurable,
 * action verb → specific, date words/date → time-bound, length bounds →
 * achievable, non-blank → relevant. Never throws.
 */
export function smartScore(title: string, i18n: I18n = EN_I18N): SmartCheck {
  const text = title.trim();
  const specific =
    /^(launch|ship|write|build|learn|run|save|grow|finish|publish|release|complete|create|earn|lose|read)\b/i.test(
      text,
    ) && text.split(/\s+/).length >= 3;
  const measurable = /\d/.test(text);
  const achievable = text.length > 0 && text.length <= 80;
  const relevant = text.length > 0;
  const timeBound =
    /\b(q[1-4]|20\d\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|week|month|year|by |until|today|tomorrow)\b/i.test(
      text,
    );
  const parts = [specific, measurable, achievable, relevant, timeBound];
  const tips: string[] = [];
  if (!specific) tips.push(i18n.t('goal.tip.specific'));
  if (!measurable) tips.push(i18n.t('goal.tip.measurable'));
  if (!timeBound) tips.push(i18n.t('goal.tip.timeBound'));
  return {
    specific,
    measurable,
    achievable,
    relevant,
    timeBound,
    score: parts.filter(Boolean).length,
    tips,
  };
}

export interface GoalConflict {
  a: Goal;
  b: Goal;
  /** Shared target week label ("2026-W37"). */
  week: string;
}

function targetWeek(targetDate: number): string {
  const d = new Date(targetDate);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const onejan = new Date(monday.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((monday.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
  );
  return `${monday.getFullYear()}-W${week}`;
}

/**
 * Pairs of active goals sharing a target week (planning conflict smell).
 * Never throws.
 */
export function goalConflicts(goals: Goal[]): GoalConflict[] {
  const dated = goals.filter(
    (g) => !g.archived && typeof g.targetDate === 'number' && Number.isFinite(g.targetDate),
  );
  const out: GoalConflict[] = [];
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      const week = targetWeek(dated[i].targetDate as number);
      if (week === targetWeek(dated[j].targetDate as number)) {
        out.push({ a: dated[i], b: dated[j], week });
      }
    }
  }
  return out;
}

/**
 * Goals with a capsuleNote set, targetDate reached, not archived, not yet
 * delivered (Faza 26 — time capsule). Delivered once ever, not day-keyed.
 */
export function capsulesDue(
  goals: Goal[],
  delivered: Record<string, number>,
  now: number = Date.now(),
): Goal[] {
  if (!Number.isFinite(now)) return [];
  return goals.filter(
    (g) =>
      !g.archived &&
      typeof g.capsuleNote === 'string' &&
      g.capsuleNote.trim().length > 0 &&
      typeof g.targetDate === 'number' &&
      g.targetDate <= now &&
      delivered[g.id] === undefined,
  );
}

export function loadCapsuleDelivered(): Record<string, number> {
  const stored = read<Record<string, number>>(STORAGE_KEYS.capsuleDelivered);
  if (!stored || typeof stored !== 'object') return {};
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(stored)) {
    if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
  }
  return clean;
}

export function saveCapsuleDelivered(delivered: Record<string, number>): boolean {
  return write(STORAGE_KEYS.capsuleDelivered, delivered);
}

export function markCapsuleDelivered(
  delivered: Record<string, number>,
  goalId: string,
  now: number,
): Record<string, number> {
  return { ...delivered, [goalId]: now };
}
