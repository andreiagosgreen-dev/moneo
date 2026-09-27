/**
 * Life hub progress frames — pure aggregates for the Map/Viață screen.
 */
import type { IvyPlan } from '../ivyLee';
import { planDoneCount } from '../ivyLee';
import type { LifeMapArea } from '../lifemap';
import { areaGap, lifeBalance } from '../lifemap';
import type { Project } from '../projects';
import type { Task } from '../tasks';
import type { MonoTab } from '../../mono/MonoNav';

export interface LifeFrame {
  id: 'today' | 'focus' | 'projects' | 'life';
  /** 0–100 for rings/bars. */
  pct: number;
  /** Optional secondary number (e.g. focus minutes). */
  meta?: number;
  tab: MonoTab;
}

export type LifeNextKind = 'writePlan' | 'workFocus' | 'tuneMap' | 'keepRhythm';

export interface LifeNextStep {
  kind: LifeNextKind;
  tab: MonoTab;
}

export interface LifeHubSnapshot {
  frames: LifeFrame[];
  next: LifeNextStep;
}

/** Today plan completion 0–100 (0 when empty). */
export function todayPlanPct(plan: IvyPlan | null): number {
  if (!plan || plan.tasks.length === 0) return 0;
  return Math.round((planDoneCount(plan) / plan.tasks.length) * 100);
}

/**
 * Soft focus score for the day: sessions and minutes → 0–100.
 * 1 session ≈ 40, 25 min ≈ +20, capped at 100.
 */
export function focusDayPct(sessions: number, focusMin: number): number {
  const s = Math.max(0, sessions);
  const m = Math.max(0, focusMin);
  return Math.min(100, Math.round(s * 40 + (m / 25) * 20));
}

/** Completed / all tasks on non-archived projects → 0–100. */
export function projectsDonePct(tasks: Task[], projects: Project[]): number {
  const active = new Set(projects.filter((p) => !p.archived).map((p) => p.id));
  const list = tasks.filter((t) => active.has(t.projectId));
  if (list.length === 0) return 0;
  const done = list.filter((t) => t.status === 'completed').length;
  return Math.round((done / list.length) * 100);
}

/** Life Map balance score 0–100 (importance-weighted current vs desired). */
export function lifeMapPct(areas: LifeMapArea[]): number {
  return lifeBalance(areas).score;
}

/**
 * Next guidance step from real state (no AI).
 * - no plan → write on Today
 * - open plan items → work on Focus
 * - day cleared + life gaps → tune Map
 * - else keep rhythm on Focus
 */
export function lifeNextStep(plan: IvyPlan | null, areas: LifeMapArea[]): LifeNextStep {
  const tasks = plan?.tasks ?? [];
  if (tasks.length === 0) {
    return { kind: 'writePlan', tab: 'today' };
  }
  if (tasks.some((t) => !t.done)) {
    return { kind: 'workFocus', tab: 'focus' };
  }
  if (areas.some((a) => areaGap(a) > 0)) {
    return { kind: 'tuneMap', tab: 'map' };
  }
  return { kind: 'keepRhythm', tab: 'focus' };
}

export function buildLifeHubSnapshot(input: {
  plan: IvyPlan | null;
  focusSessions: number;
  focusMin: number;
  tasks: Task[];
  projects: Project[];
  lifeMap: LifeMapArea[];
}): LifeHubSnapshot {
  const { plan, focusSessions, focusMin, tasks, projects, lifeMap } = input;
  return {
    frames: [
      { id: 'today', pct: todayPlanPct(plan), tab: 'today' },
      {
        id: 'focus',
        pct: focusDayPct(focusSessions, focusMin),
        meta: focusMin,
        tab: 'focus',
      },
      { id: 'projects', pct: projectsDonePct(tasks, projects), tab: 'projects' },
      { id: 'life', pct: lifeMapPct(lifeMap), tab: 'map' },
    ],
    next: lifeNextStep(plan, lifeMap),
  };
}
