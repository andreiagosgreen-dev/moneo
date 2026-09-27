/* Everyday celebration moments — a short, calm "well done" after real work:
 * a finished focus session, a milestone task or waterfall phase, a whole
 * project. Pure functions only; the hook owns state and the lazy UI layer
 * owns the animation. Distinct from the rare, modal celebrations in
 * `celebrations.ts` (first goal, focus-day thresholds).
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead, safeWrite } from './storage/storageAdapter';
import type { Session } from './store';
import type { Project } from './projects';
import type { Task } from './tasks';
import type { WaterfallPhase } from './waterfall';

export type MomentKind = 'session' | 'milestone' | 'phase' | 'project';

export interface Moment {
  /** Stable key — dedupes the queue; non-session ids persist in the shown-log. */
  id: string;
  kind: MomentKind;
  /** Task / phase / project name (absent for sessions). */
  label?: string;
  /** Focused minutes (sessions only). */
  minutes?: number;
  /** Message variant, deterministic per moment. */
  variant: number;
}

/** Bigger wins get more confetti and a longer stay. */
export const MOMENT_WEIGHT: Record<MomentKind, number> = {
  session: 1,
  milestone: 2,
  phase: 2,
  project: 3,
};

/** Never let celebrations pile up behind each other. */
export const MAX_QUEUE = 3;

export const SESSION_VARIANTS = 3;

/** Shown-log prefix, shared with the rare-celebration log. */
const SHOWN_PREFIX = 'moment:';

export function sessionMoment(entry: Pick<Session, 'at' | 'min'>): Moment {
  const at = Number.isFinite(entry.at) ? entry.at : 0;
  return {
    id: `session:${at}`,
    kind: 'session',
    minutes: Math.max(0, Math.round(entry.min)),
    variant: Math.abs(Math.floor(at / 1000)) % SESSION_VARIANTS,
  };
}

export interface WorkSnapshot {
  tasks: Task[];
  phases: WaterfallPhase[];
}

function allPhasesDone(phases: WaterfallPhase[], projectId: string): boolean {
  const scoped = phases.filter((p) => p.projectId === projectId);
  return scoped.length > 0 && scoped.every((p) => p.status === 'done');
}

function allTasksDone(tasks: Task[], projectId: string): boolean {
  const owned = tasks.filter((t) => t.projectId === projectId);
  return owned.length > 0 && owned.every((t) => t.status === 'completed');
}

/**
 * Moments earned between two snapshots of local work. Only real completions
 * count (a task or phase that just flipped to done) — deleting the last open
 * task never "finishes" a project. When a project finishes, its own phase /
 * milestone moments from the same change are folded into the bigger one.
 */
export function detectWorkMoments(
  prev: WorkSnapshot,
  next: WorkSnapshot,
  projects: Project[],
): Moment[] {
  if (prev.tasks === next.tasks && prev.phases === next.phases) return [];
  const prevTask = new Map(prev.tasks.map((t) => [t.id, t]));
  const prevPhase = new Map(prev.phases.map((p) => [p.id, p]));
  const touched = new Set<string>();
  const small: Array<Moment & { projectId: string }> = [];

  for (const t of next.tasks) {
    if (t.status !== 'completed') continue;
    const before = prevTask.get(t.id);
    if (!before || before.status === 'completed') continue;
    touched.add(t.projectId);
    if (t.milestone) {
      small.push({
        id: `milestone:${t.id}`,
        kind: 'milestone',
        label: t.title,
        variant: 0,
        projectId: t.projectId,
      });
    }
  }
  for (const p of next.phases) {
    if (p.status !== 'done') continue;
    const before = prevPhase.get(p.id);
    if (!before || before.status === 'done') continue;
    touched.add(p.projectId);
    small.push({
      id: `phase:${p.id}`,
      kind: 'phase',
      label: p.name,
      variant: 0,
      projectId: p.projectId,
    });
  }

  const finished = new Set<string>();
  const out: Moment[] = [];
  for (const projectId of touched) {
    const project = projects.find((x) => x.id === projectId);
    if (!project || project.archived) continue;
    const tasksNow = allTasksDone(next.tasks, projectId);
    const tasksBefore = allTasksDone(prev.tasks, projectId);
    const phasesNow = allPhasesDone(next.phases, projectId);
    const phasesBefore = allPhasesDone(prev.phases, projectId);
    if ((tasksNow && !tasksBefore) || (phasesNow && !phasesBefore)) {
      finished.add(projectId);
      out.push({ id: `project:${projectId}`, kind: 'project', label: project.name, variant: 0 });
    }
  }
  for (const m of small) {
    if (finished.has(m.projectId)) continue;
    out.push({ id: m.id, kind: m.kind, label: m.label, variant: m.variant });
  }
  return out;
}

/**
 * Merge new moments into the queue: skip ones already queued or already
 * shown, keep at most one session moment (the newest), and cap the length
 * by dropping the lightest, oldest entries first.
 */
export function enqueueMoments(
  queue: Moment[],
  incoming: Moment[],
  shown: Record<string, true>,
): Moment[] {
  let next = [...queue];
  for (const m of incoming) {
    if (next.some((q) => q.id === m.id)) continue;
    if (m.kind !== 'session' && shown[SHOWN_PREFIX + m.id]) continue;
    if (m.kind === 'session') next = next.filter((q, i) => i === 0 || q.kind !== 'session');
    next.push(m);
  }
  while (next.length > MAX_QUEUE) {
    // Index 0 may already be on screen — never yank it.
    let drop = 1;
    for (let i = 2; i < next.length; i++) {
      if (MOMENT_WEIGHT[next[i].kind] < MOMENT_WEIGHT[next[drop].kind]) drop = i;
    }
    next.splice(drop, 1);
  }
  return next;
}

/** Sessions celebrate every time; everything else only once, ever. */
export function markMomentShown(shown: Record<string, true>, m: Moment): Record<string, true> {
  if (m.kind === 'session') return shown;
  return { ...shown, [SHOWN_PREFIX + m.id]: true };
}

/** How long a moment stays before it quietly leaves (ms). */
export function momentDuration(kind: MomentKind): number {
  return 3500 + MOMENT_WEIGHT[kind] * 1200;
}

/** Confetti pieces for a moment; none at all under reduced motion. */
export function confettiCount(kind: MomentKind, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return [0, 22, 38, 64][MOMENT_WEIGHT[kind]];
}

/* ---------- preference (Settings toggle) — local only ---------- */

export interface CelebratePrefs {
  enabled: boolean;
}

export const DEFAULT_CELEBRATE_PREFS: CelebratePrefs = { enabled: true };

export function loadCelebratePrefs(): CelebratePrefs {
  const stored = safeRead<Partial<CelebratePrefs>>(STORAGE_KEYS.celebratePrefs);
  return {
    enabled:
      stored && typeof stored.enabled === 'boolean'
        ? stored.enabled
        : DEFAULT_CELEBRATE_PREFS.enabled,
  };
}

export function saveCelebratePrefs(prefs: CelebratePrefs): boolean {
  return safeWrite(STORAGE_KEYS.celebratePrefs, prefs);
}
