/* OKRs (Roadmap Phase 7.3) — objectives, key results, cascade.
 *
 * Objectives cascade (company → team → individual via parentId); progress
 * rolls up: parents average children, leaves average their key results.
 * Key results nest inside their objective (one storage key). Pure + tested.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';

export interface KeyResult {
  id: string;
  title: string;
  /** Numeric target in `unit`. */
  target: number;
  current: number;
  unit: string;
}

export interface Objective {
  id: string;
  title: string;
  /** Free period label, defaulting to the current quarter ("2026-Q3"). */
  period: string;
  parentId?: string;
  keyResults: KeyResult[];
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Free tier holds a few objectives; Pro is unlimited. */
export const FREE_OKRS_LIMIT = 3;

export const MAX_KRS_PER_OBJECTIVE = 8;

/** "2026-Q3" style label for a timestamp. Never throws. */
export function currentPeriod(at: number = Date.now()): string {
  const d = new Date(Number.isFinite(at) ? at : Date.now());
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

function byId(objectives: Objective[]): Map<string, Objective> {
  return new Map(objectives.map((o) => [o.id, o]));
}

export function loadObjectives(): Objective[] {
  const stored = read<Objective[]>(STORAGE_KEYS.objectives);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((o) => o && typeof o.id === 'string' && typeof o.title === 'string')
    .map((o) => ({
      id: o.id,
      title: o.title,
      period: typeof o.period === 'string' && o.period.trim() ? o.period : currentPeriod(),
      ...(typeof o.parentId === 'string' && o.parentId ? { parentId: o.parentId } : {}),
      keyResults: Array.isArray(o.keyResults)
        ? o.keyResults
            .filter((k) => k && typeof k.id === 'string' && typeof k.title === 'string')
            .map((k) => ({
              id: k.id,
              title: k.title,
              target:
                typeof k.target === 'number' && Number.isFinite(k.target) && k.target > 0
                  ? k.target
                  : 100,
              current:
                typeof k.current === 'number' && Number.isFinite(k.current)
                  ? Math.max(0, k.current)
                  : 0,
              unit: typeof k.unit === 'string' ? k.unit.slice(0, 12) : '',
            }))
            .slice(0, MAX_KRS_PER_OBJECTIVE)
        : [],
      ...(o.archived === true ? { archived: true as const } : {}),
      createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
      updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : Date.now(),
    }));
}

export function saveObjectives(objectives: Objective[]): boolean {
  return write(STORAGE_KEYS.objectives, objectives);
}

export function createObjectiveObject(
  objectives: Objective[],
  title: string,
  period?: string,
  parentId?: string,
): Objective | null {
  const clean = title.trim().slice(0, 120);
  if (!clean) return null;
  if (parentId) {
    const parent = byId(objectives).get(parentId);
    if (!parent || parent.archived) return null;
  }
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: clean,
    period: period?.trim() || currentPeriod(),
    ...(parentId ? { parentId } : {}),
    keyResults: [],
    createdAt: now,
    updatedAt: now,
  };
}

export interface ObjectiveUpdates {
  title?: string;
  period?: string;
  parentId?: string | null;
  archived?: boolean;
}

function descendantIds(objectives: Objective[], id: string): string[] {
  const children = new Map<string, string[]>();
  for (const o of objectives) {
    if (o.parentId) {
      const list = children.get(o.parentId) ?? [];
      list.push(o.id);
      children.set(o.parentId, list);
    }
  }
  const out: string[] = [];
  const seen = new Set([id]);
  const stack = [...(children.get(id) ?? [])];
  while (stack.length > 0) {
    const oid = stack.pop()!;
    if (seen.has(oid)) continue;
    seen.add(oid);
    out.push(oid);
    stack.push(...(children.get(oid) ?? []));
  }
  return out;
}

export function updateObjective(
  objectives: Objective[],
  id: string,
  updates: ObjectiveUpdates,
): Objective[] {
  return objectives.map((o) => {
    if (o.id !== id) return o;
    const next: Objective = { ...o, updatedAt: Date.now() };
    if (updates.title !== undefined) next.title = updates.title.trim().slice(0, 120) || o.title;
    if (updates.period !== undefined && updates.period.trim()) next.period = updates.period.trim();
    if (updates.archived !== undefined) {
      if (updates.archived) next.archived = true;
      else delete next.archived;
    }
    if (updates.parentId !== undefined) {
      if (updates.parentId) {
        const parent = byId(objectives).get(updates.parentId);
        if (
          !parent ||
          parent.id === id ||
          parent.archived ||
          descendantIds(objectives, id).includes(updates.parentId)
        ) {
          return o;
        }
        next.parentId = updates.parentId;
      } else {
        delete next.parentId;
      }
    }
    return next;
  });
}

/** Delete an objective; children re-attach upward like goals. */
export function deleteObjective(objectives: Objective[], id: string): Objective[] {
  const doomed = byId(objectives).get(id);
  if (!doomed) return objectives;
  const now = Date.now();
  return objectives
    .filter((o) => o.id !== id)
    .map((o) => {
      if (o.parentId !== id) return o;
      const next: Objective = { ...o, updatedAt: now };
      if (doomed.parentId) next.parentId = doomed.parentId;
      else delete next.parentId;
      return next;
    });
}

export function childrenOf(objectives: Objective[], parentId: string): Objective[] {
  return objectives
    .filter((o) => o.parentId === parentId && !o.archived)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function rootObjectives(objectives: Objective[], period?: string): Objective[] {
  return objectives
    .filter((o) => !o.parentId && !o.archived && (!period || o.period === period))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function okrPeriods(objectives: Objective[]): string[] {
  return Array.from(new Set(objectives.filter((o) => !o.archived).map((o) => o.period))).sort();
}

/* ---------------- key results ---------------- */

export function addKeyResult(
  objectives: Objective[],
  objectiveId: string,
  title: string,
  target: number,
  unit = '',
): Objective[] {
  const clean = title.trim().slice(0, 120);
  if (!clean || !Number.isFinite(target) || target <= 0) return objectives;
  return objectives.map((o) => {
    if (o.id !== objectiveId || o.keyResults.length >= MAX_KRS_PER_OBJECTIVE) return o;
    const kr: KeyResult = {
      id: crypto.randomUUID(),
      title: clean,
      target,
      current: 0,
      unit: unit.slice(0, 12),
    };
    return { ...o, keyResults: [...o.keyResults, kr], updatedAt: Date.now() };
  });
}

export interface KeyResultUpdates {
  title?: string;
  target?: number;
  current?: number;
  unit?: string;
}

export function updateKeyResult(
  objectives: Objective[],
  objectiveId: string,
  krId: string,
  updates: KeyResultUpdates,
): Objective[] {
  return objectives.map((o) => {
    if (o.id !== objectiveId) return o;
    return {
      ...o,
      keyResults: o.keyResults.map((k) => {
        if (k.id !== krId) return k;
        const next: KeyResult = { ...k };
        if (updates.title !== undefined) next.title = updates.title.trim().slice(0, 120) || k.title;
        if (updates.target !== undefined && Number.isFinite(updates.target) && updates.target > 0) {
          next.target = updates.target;
        }
        if (updates.current !== undefined && Number.isFinite(updates.current)) {
          next.current = Math.max(0, updates.current);
        }
        if (updates.unit !== undefined) next.unit = updates.unit.slice(0, 12);
        return next;
      }),
      updatedAt: Date.now(),
    };
  });
}

export function removeKeyResult(
  objectives: Objective[],
  objectiveId: string,
  krId: string,
): Objective[] {
  return objectives.map((o) =>
    o.id === objectiveId
      ? { ...o, keyResults: o.keyResults.filter((k) => k.id !== krId), updatedAt: Date.now() }
      : o,
  );
}

/** 0-1 progress of one key result (over-achievement caps at 1). */
export function krProgress(kr: KeyResult): number {
  if (!(kr.target > 0)) return 0;
  return Math.min(1, Math.max(0, kr.current / kr.target));
}

/**
 * Objective progress 0-100: children average → KR average → 0.
 * Cycle-safe. Never throws.
 */
export function objectiveProgress(
  objectives: Objective[],
  objectiveId: string,
  seen: Set<string> = new Set(),
): number {
  const objective = byId(objectives).get(objectiveId);
  if (!objective || seen.has(objectiveId)) return 0;
  seen.add(objectiveId);
  const kids = childrenOf(objectives, objectiveId);
  if (kids.length > 0) {
    const sum = kids.reduce((acc, k) => acc + objectiveProgress(objectives, k.id, seen), 0);
    return Math.round(sum / kids.length);
  }
  if (objective.keyResults.length === 0) return 0;
  const sum = objective.keyResults.reduce((acc, k) => acc + krProgress(k), 0);
  return Math.round((sum / objective.keyResults.length) * 100);
}

/** Mean progress across root objectives (the headline number). */
export function overallOkrProgress(objectives: Objective[], period?: string): number {
  const roots = rootObjectives(objectives, period);
  if (roots.length === 0) return 0;
  const sum = roots.reduce((acc, o) => acc + objectiveProgress(objectives, o.id), 0);
  return Math.round(sum / roots.length);
}

/**
 * Quarterly review text (Roadmap 7.3 automation): headline + per-objective
 * lines calling out the strongest and weakest key results. Never throws.
 */
export function okrReview(objectives: Objective[], period?: string): string {
  const roots = rootObjectives(objectives, period);
  const label = period ?? 'all periods';
  if (roots.length === 0) return `OKR review (${label}): no objectives yet.`;
  const lines = [`OKR review (${label}): ${overallOkrProgress(objectives, period)}% overall.`];
  for (const o of roots) {
    const pct = objectiveProgress(objectives, o.id);
    lines.push(`- ${o.title}: ${pct}%`);
    const ranked = o.keyResults.slice().sort((a, b) => krProgress(a) - krProgress(b));
    if (ranked.length > 0) {
      const best = ranked[ranked.length - 1];
      const worst = ranked[0];
      lines.push(`  Best KR: ${best.title} ${Math.round(krProgress(best) * 100)}%.`);
      if (worst.id !== best.id) {
        lines.push(`  Needs work: ${worst.title} ${Math.round(krProgress(worst) * 100)}%.`);
      }
    }
    const kids = childrenOf(objectives, o.id);
    if (kids.length > 0) {
      lines.push(
        `  Cascaded: ${kids.map((k) => `${k.title} ${objectiveProgress(objectives, k.id)}%`).join('; ')}.`,
      );
    }
  }
  return lines.join('\n');
}
