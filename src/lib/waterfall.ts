/* Waterfall planning (Roadmap Phase 7.5) — sequential phases with gates.
 *
 * Phases run strictly in order: a phase activates only when every earlier
 * phase is done, and completes only from active. Exit criteria ("gates")
 * are plain text. Pure functions; storage via STORAGE_KEYS.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';

export type WaterfallStatus = 'todo' | 'active' | 'done';

export const WATERFALL_STATUSES: WaterfallStatus[] = ['todo', 'active', 'done'];

export interface WaterfallPhase {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: WaterfallStatus;
  /** Exit criteria — the gate to the next phase. */
  gate?: string;
  /** Top risk for this phase (Roadmap 7.5 risk assessment). */
  risk?: string;
  startedAt?: number;
  doneAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Classic software pipeline offered as one-click starter phases. */
export const WATERFALL_STARTERS: Array<{ name: string; gate: string }> = [
  { name: 'Requirements', gate: 'Scope signed off' },
  { name: 'Design', gate: 'Designs approved' },
  { name: 'Implementation', gate: 'All tasks complete' },
  { name: 'Testing', gate: 'Zero open blockers' },
  { name: 'Deployment', gate: 'Live + monitored' },
];

/** Named phase packs (software default + hardware/build). */
export type WaterfallPackId = 'software' | 'build';

export const WATERFALL_PACKS: Record<WaterfallPackId, Array<{ name: string; gate: string }>> = {
  software: WATERFALL_STARTERS,
  build: [
    { name: 'Spec', gate: 'Goals and limits written' },
    { name: 'Parts', gate: 'Parts ordered or on hand' },
    { name: 'Assemble', gate: 'Frame and power connected safely' },
    { name: 'Connect', gate: 'Controller, radio, and failsafe set' },
    { name: 'Bench test', gate: 'Safe checks pass before flight' },
    { name: 'First flight', gate: 'First controlled hover logged' },
    { name: 'Improve', gate: 'Tune and note next changes' },
  ],
};

export function loadPhases(): WaterfallPhase[] {
  const stored = read<WaterfallPhase[]>(STORAGE_KEYS.waterfall);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((p) => p && typeof p.id === 'string' && typeof p.projectId === 'string')
    .map((p) => ({
      id: p.id,
      projectId: p.projectId,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.slice(0, 80) : 'Phase',
      order: typeof p.order === 'number' && Number.isFinite(p.order) ? p.order : 0,
      status: WATERFALL_STATUSES.includes(p.status as WaterfallStatus)
        ? (p.status as WaterfallStatus)
        : 'todo',
      ...(typeof p.gate === 'string' && p.gate.trim() ? { gate: p.gate.slice(0, 200) } : {}),
      ...(typeof p.risk === 'string' && p.risk.trim() ? { risk: p.risk.slice(0, 200) } : {}),
      ...(typeof p.startedAt === 'number' ? { startedAt: p.startedAt } : {}),
      ...(typeof p.doneAt === 'number' ? { doneAt: p.doneAt } : {}),
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
    }));
}

export function savePhases(phases: WaterfallPhase[]): boolean {
  return write(STORAGE_KEYS.waterfall, phases);
}

export function phasesForProject(phases: WaterfallPhase[], projectId: string): WaterfallPhase[] {
  return phases
    .filter((p) => p.projectId === projectId)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function createPhaseObject(
  projectId: string,
  name: string,
  order: number,
  gate?: string,
): WaterfallPhase | null {
  const clean = name.trim().slice(0, 80);
  if (!clean || !Number.isFinite(order)) return null;
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    name: clean,
    order,
    status: 'todo',
    ...(gate?.trim() ? { gate: gate.trim().slice(0, 200) } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

/** Seed a phase pack (no-op when phases already exist for the project). */
export function seedPhasesForProject(
  phases: WaterfallPhase[],
  projectId: string,
  pack: WaterfallPackId = 'software',
): WaterfallPhase[] {
  if (phases.some((p) => p.projectId === projectId)) return phases;
  const now = Date.now();
  const starters = (WATERFALL_PACKS[pack] ?? WATERFALL_PACKS.software).map((s, i) => ({
    id: crypto.randomUUID(),
    projectId,
    name: s.name,
    order: i,
    status: 'todo' as const,
    gate: s.gate,
    createdAt: now,
    updatedAt: now,
  }));
  return [...phases, ...starters];
}

/** Seed the classic 5-stage software pipeline (no-op when phases already exist). */
export function seedStarterPhases(phases: WaterfallPhase[], projectId: string): WaterfallPhase[] {
  return seedPhasesForProject(phases, projectId, 'software');
}

export interface PhaseUpdates {
  name?: string;
  gate?: string | null;
  risk?: string | null;
}

/** Rename / re-gate a phase. Status moves only through setPhaseStatus. */
export function updatePhase(
  phases: WaterfallPhase[],
  id: string,
  updates: PhaseUpdates,
): WaterfallPhase[] {
  return phases.map((p) => {
    if (p.id !== id) return p;
    const next: WaterfallPhase = { ...p, updatedAt: Date.now() };
    if (updates.name !== undefined) next.name = updates.name.trim().slice(0, 80) || p.name;
    if (updates.gate !== undefined) {
      if (updates.gate && updates.gate.trim()) next.gate = updates.gate.trim().slice(0, 200);
      else delete next.gate;
    }
    if (updates.risk !== undefined) {
      if (updates.risk && updates.risk.trim()) next.risk = updates.risk.trim().slice(0, 200);
      else delete next.risk;
    }
    return next;
  });
}

/**
 * Move a phase todo→active→done, enforcing strict sequence:
 * activating needs every earlier phase done; completing needs active.
 * Violations leave the list unchanged. Never throws.
 */
export function setPhaseStatus(
  phases: WaterfallPhase[],
  id: string,
  status: WaterfallStatus,
  now: number = Date.now(),
): WaterfallPhase[] {
  const phase = phases.find((p) => p.id === id);
  if (!phase || phase.status === status) return phases;
  const ordered = phasesForProject(phases, phase.projectId);
  const idx = ordered.findIndex((p) => p.id === id);
  if (status === 'active') {
    if (phase.status !== 'todo') return phases;
    if (!ordered.slice(0, idx).every((p) => p.status === 'done')) return phases;
    if (ordered.some((p) => p.status === 'active')) return phases;
  }
  if (status === 'done' && phase.status !== 'active') return phases;
  if (status === 'todo') return phases; // no moving backwards
  return phases.map((p) => {
    if (p.id !== id) return p;
    const next: WaterfallPhase = { ...p, status, updatedAt: now };
    if (status === 'active') next.startedAt = now;
    if (status === 'done') next.doneAt = now;
    return next;
  });
}

export function deletePhase(phases: WaterfallPhase[], id: string): WaterfallPhase[] {
  return phases.filter((p) => p.id !== id);
}

/**
 * Rollback a done phase to active (Roadmap 7.5): allowed only when every
 * later phase is still todo, so history never contradicts the sequence.
 * Never throws.
 */
export function rollbackPhase(
  phases: WaterfallPhase[],
  id: string,
  now: number = Date.now(),
): WaterfallPhase[] {
  const phase = phases.find((p) => p.id === id);
  if (!phase || phase.status !== 'done') return phases;
  const ordered = phasesForProject(phases, phase.projectId);
  const idx = ordered.findIndex((p) => p.id === id);
  if (!ordered.slice(idx + 1).every((p) => p.status === 'todo')) return phases;
  return phases.map((p) => {
    if (p.id !== id) return p;
    const next: WaterfallPhase = { ...p, status: 'active', updatedAt: now };
    delete next.doneAt;
    return next;
  });
}

/** Share of done phases 0-100 (0 when the project has no phases). */
export function waterfallProgress(phases: WaterfallPhase[], projectId: string): number {
  const scoped = phasesForProject(phases, projectId);
  if (scoped.length === 0) return 0;
  return Math.round((scoped.filter((p) => p.status === 'done').length / scoped.length) * 100);
}
