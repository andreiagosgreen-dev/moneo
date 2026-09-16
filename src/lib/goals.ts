/* Goal hierarchy (Roadmap Phase 4.2) — vision → milestone → project → weekly.
 *
 * Progress rolls up automatically: a parent averages its children, a leaf
 * linked to a project mirrors that project's task completion, otherwise a
 * manual 0-100 override applies. Pure functions; storage via STORAGE_KEYS.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { projectCompletion, type Task } from './tasks';

export type GoalLevel = 'vision' | 'milestone' | 'project' | 'weekly';

export const GOAL_LEVELS: GoalLevel[] = ['vision', 'milestone', 'project', 'weekly'];

export const GOAL_LEVEL_LABELS: Record<GoalLevel, string> = {
  vision: 'Vision · yearly',
  milestone: 'Milestone · quarterly',
  project: 'Project · monthly',
  weekly: 'Weekly',
};

/** Broader → narrower. A parent must sit strictly above its child. */
const LEVEL_RANK: Record<GoalLevel, number> = {
  vision: 0,
  milestone: 1,
  project: 2,
  weekly: 3,
};

export interface Goal {
  id: string;
  title: string;
  level: GoalLevel;
  parentId?: string;
  /** Linked project: leaf progress mirrors its task completion. */
  projectId?: string;
  /** Target date in epoch ms. */
  targetDate?: number;
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
      ...(typeof g.targetDate === 'number' && Number.isFinite(g.targetDate)
        ? { targetDate: g.targetDate }
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
  targetDate?: number | null;
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
    if (updates.targetDate !== undefined) {
      if (updates.targetDate !== null && Number.isFinite(updates.targetDate)) {
        next.targetDate = updates.targetDate;
      } else delete next.targetDate;
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
