/**
 * Editable learning/project roadmaps for the Assistant.
 * Pace recalculation: when actual min/day differs from planned, ETA updates.
 */
import { safeRead as read, safeWrite as write } from '../storage/storageAdapter';
import { STORAGE_KEYS } from '../storage/storageKeys';
import type { BuiltPath, PathKind } from './types';
import type { ByokProvider } from './byok';

export type RoadmapGroup =
  | 'learn'
  | 'build'
  | 'ship'
  | 'market'
  | 'write'
  | 'life'
  | 'custom';

export const ROADMAP_GROUPS: RoadmapGroup[] = [
  'learn',
  'build',
  'ship',
  'market',
  'write',
  'life',
  'custom',
];

/** Free keeps one active plan; Pro is unlimited. */
export const FREE_ROADMAPS_LIMIT = 1;

/** Whether another roadmap may be added (Free: one slot). */
export function canAddRoadmap(isPro: boolean, existingCount: number): boolean {
  return isPro || existingCount < FREE_ROADMAPS_LIMIT;
}

const LEGACY_GROUP: Record<string, RoadmapGroup> = {
  math: 'learn',
  marketing: 'market',
  books: 'write',
  learn: 'learn',
  project: 'ship',
  growth: 'life',
  custom: 'custom',
  build: 'build',
  ship: 'ship',
  market: 'market',
  write: 'write',
  life: 'life',
};

export interface RoadmapStep {
  id: string;
  title: string;
  estimateMin: number;
  done: boolean;
  order: number;
  sources?: string[];
  /** Linked Task id after approve. */
  taskId?: string;
}

export interface Roadmap {
  id: string;
  group: RoadmapGroup;
  title: string;
  provider: ByokProvider | 'local-fallback';
  steps: RoadmapStep[];
  /** Planned focused minutes per day. */
  plannedMinPerDay: number;
  /** EWMA of actual focused minutes/day (from Focus). */
  actualMinPerDay: number;
  totalEstimateMin: number;
  projectId?: string;
  sources?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RoadmapEta {
  remainingMin: number;
  daysLeft: number;
  weeksLeft: number;
  paceMinPerDay: number;
}

function newId(): string {
  return crypto.randomUUID();
}

function sumEstimates(steps: RoadmapStep[]): number {
  return steps.reduce((s, x) => s + Math.max(0, x.estimateMin), 0);
}

function normalizeSteps(steps: RoadmapStep[]): RoadmapStep[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({
      ...s,
      title: s.title.trim().slice(0, 160),
      estimateMin: Math.min(480, Math.max(5, Math.round(s.estimateMin) || 25)),
      order: i,
    }));
}

function sanitizeGroup(raw: unknown): RoadmapGroup {
  if (typeof raw === 'string' && LEGACY_GROUP[raw]) return LEGACY_GROUP[raw];
  return 'custom';
}

export function loadRoadmaps(): Roadmap[] {
  const stored = read<Roadmap[]>(STORAGE_KEYS.roadmaps);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((r) => r && typeof r.id === 'string' && typeof r.title === 'string')
    .map((r) => ({ ...r, group: sanitizeGroup(r.group) }));
}

export function saveRoadmaps(list: Roadmap[]): boolean {
  return write(STORAGE_KEYS.roadmaps, list);
}

export function loadActiveRoadmapId(): string | null {
  const id = read<string>(STORAGE_KEYS.activeRoadmapId);
  return typeof id === 'string' && id ? id : null;
}

export function saveActiveRoadmapId(id: string | null): boolean {
  if (!id) return write(STORAGE_KEYS.activeRoadmapId, '');
  return write(STORAGE_KEYS.activeRoadmapId, id);
}

export function activeRoadmap(list: Roadmap[] = loadRoadmaps()): Roadmap | null {
  const id = loadActiveRoadmapId();
  if (!id) return list[0] ?? null;
  return list.find((r) => r.id === id) ?? list[0] ?? null;
}

export function roadmapProgress(r: Roadmap): number {
  if (r.steps.length === 0) return 0;
  const done = r.steps.filter((s) => s.done).length;
  return Math.round((done / r.steps.length) * 100);
}

export function nextOpenStep(r: Roadmap): RoadmapStep | null {
  return r.steps.find((s) => !s.done) ?? null;
}

/** ETA from remaining open estimates and a pace (min/day). */
export function roadmapEta(r: Roadmap, paceOverride?: number): RoadmapEta {
  const remainingMin = r.steps.filter((s) => !s.done).reduce((s, x) => s + x.estimateMin, 0);
  const pace = Math.max(
    5,
    Math.round(paceOverride ?? (r.actualMinPerDay > 0 ? r.actualMinPerDay : r.plannedMinPerDay)),
  );
  const daysLeft = Math.max(1, Math.ceil(remainingMin / pace));
  return {
    remainingMin,
    daysLeft,
    weeksLeft: Math.max(1, Math.ceil(daysLeft / 7)),
    paceMinPerDay: pace,
  };
}

/** Recalc when actual pace changes (e.g. 120 min/day instead of 25). */
export function recalcRoadmap(r: Roadmap, actualMinPerDay: number, now = Date.now()): Roadmap {
  const actual = Math.min(480, Math.max(0, Math.round(actualMinPerDay)));
  const prev = r.actualMinPerDay > 0 ? r.actualMinPerDay : r.plannedMinPerDay;
  const blended = prev > 0 && actual > 0 ? Math.round(prev * 0.7 + actual * 0.3) : actual || prev;
  return {
    ...r,
    actualMinPerDay: blended,
    totalEstimateMin: sumEstimates(r.steps),
    updatedAt: now,
  };
}

export function roadmapFromBuiltPath(
  path: BuiltPath,
  group: RoadmapGroup,
  provider: ByokProvider | 'local-fallback',
  sources: string[] = [],
  plannedMinPerDay = 25,
  now = Date.now(),
): Roadmap {
  const steps: RoadmapStep[] = path.tasks.map((t, i) => ({
    id: newId(),
    title: t.title,
    estimateMin: Math.min(480, Math.max(5, t.pomodoros * 25)),
    done: false,
    order: i,
    ...(sources.length && i === 0 ? { sources: [...sources] } : {}),
  }));
  return {
    id: newId(),
    group,
    title: path.goal.slice(0, 120),
    provider,
    steps: normalizeSteps(steps),
    plannedMinPerDay: Math.min(480, Math.max(5, Math.round(plannedMinPerDay))),
    actualMinPerDay: 0,
    totalEstimateMin: sumEstimates(steps),
    ...(sources.length ? { sources } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertRoadmap(list: Roadmap[], roadmap: Roadmap): Roadmap[] {
  const i = list.findIndex((r) => r.id === roadmap.id);
  if (i < 0) return [...list, roadmap];
  const next = [...list];
  next[i] = roadmap;
  return next;
}

export function deleteRoadmap(list: Roadmap[], id: string): Roadmap[] {
  return list.filter((r) => r.id !== id);
}

export function updateStep(
  r: Roadmap,
  stepId: string,
  patch: Partial<Pick<RoadmapStep, 'title' | 'estimateMin' | 'done' | 'taskId'>>,
  now = Date.now(),
): Roadmap {
  const steps = r.steps.map((s) => {
    if (s.id !== stepId) return s;
    return {
      ...s,
      ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 160) || s.title } : {}),
      ...(patch.estimateMin !== undefined
        ? { estimateMin: Math.min(480, Math.max(5, Math.round(patch.estimateMin))) }
        : {}),
      ...(patch.done !== undefined ? { done: patch.done } : {}),
      ...(patch.taskId !== undefined
        ? patch.taskId
          ? { taskId: patch.taskId }
          : { taskId: undefined }
        : {}),
    };
  });
  return {
    ...r,
    steps: normalizeSteps(steps),
    totalEstimateMin: sumEstimates(steps),
    updatedAt: now,
  };
}

export function addStep(
  r: Roadmap,
  title: string,
  estimateMin = 25,
  now = Date.now(),
  taskId?: string,
): Roadmap {
  const clean = title.trim().slice(0, 160);
  if (!clean) return r;
  const steps = [
    ...r.steps,
    {
      id: newId(),
      title: clean,
      estimateMin: Math.min(480, Math.max(5, Math.round(estimateMin))),
      done: false,
      order: r.steps.length,
      ...(taskId ? { taskId } : {}),
    },
  ];
  return {
    ...r,
    steps: normalizeSteps(steps),
    totalEstimateMin: sumEstimates(steps),
    updatedAt: now,
  };
}

/** Mirror Task completion onto linked roadmap steps (Focus → strip %). */
export function syncStepsFromTasks(
  r: Roadmap,
  taskStatus: (taskId: string) => 'completed' | 'pending' | 'other' | null,
  now = Date.now(),
): Roadmap | null {
  let changed = false;
  const steps = r.steps.map((step) => {
    if (!step.taskId) return step;
    const st = taskStatus(step.taskId);
    if (st !== 'completed' && st !== 'pending') return step;
    const done = st === 'completed';
    if (done === step.done) return step;
    changed = true;
    return { ...step, done };
  });
  if (!changed) return null;
  return {
    ...r,
    steps: normalizeSteps(steps),
    totalEstimateMin: sumEstimates(steps),
    updatedAt: now,
  };
}

export function removeStep(r: Roadmap, stepId: string, now = Date.now()): Roadmap {
  const steps = r.steps.filter((s) => s.id !== stepId);
  return {
    ...r,
    steps: normalizeSteps(steps),
    totalEstimateMin: sumEstimates(steps),
    updatedAt: now,
  };
}

/** Move step by delta (-1 up, +1 down). */
export function moveStep(r: Roadmap, stepId: string, delta: -1 | 1, now = Date.now()): Roadmap {
  const steps = normalizeSteps(r.steps);
  const i = steps.findIndex((s) => s.id === stepId);
  if (i < 0) return r;
  const j = i + delta;
  if (j < 0 || j >= steps.length) return r;
  const next = [...steps];
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  // Re-index order before normalize so the positional swap sticks.
  return {
    ...r,
    steps: normalizeSteps(next.map((s, idx) => ({ ...s, order: idx }))),
    updatedAt: now,
  };
}

export function setPlannedPace(r: Roadmap, plannedMinPerDay: number, now = Date.now()): Roadmap {
  return {
    ...r,
    plannedMinPerDay: Math.min(480, Math.max(5, Math.round(plannedMinPerDay))),
    updatedAt: now,
  };
}

/** i18n key for a group starter goal, or null for blank custom. */
export function groupStarterKey(group: RoadmapGroup): `assist.roadmap.starter.${Exclude<RoadmapGroup, 'custom'>}` | null {
  if (group === 'custom') return null;
  return `assist.roadmap.starter.${group}`;
}

export function groupDefaultHorizonMonths(group: RoadmapGroup): number {
  switch (group) {
    case 'learn':
      return 3;
    case 'build':
      return 6;
    case 'ship':
      return 6;
    case 'market':
      return 4;
    case 'write':
      return 6;
    case 'life':
      return 12;
    case 'custom':
      return 6;
  }
}

/** Preferred PathKind for a chip; custom leaves detection to the engine. */
export function groupPreferredKind(group: RoadmapGroup): PathKind | undefined {
  switch (group) {
    case 'learn':
      return 'learning';
    case 'build':
      return 'build';
    case 'ship':
    case 'market':
      return 'launch';
    case 'write':
    case 'life':
      return 'general';
    case 'custom':
      return undefined;
  }
}
