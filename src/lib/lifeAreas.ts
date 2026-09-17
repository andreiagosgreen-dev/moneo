/* Life areas & work-life balance (Roadmap Phase 5.2 + 5.5).
 *
 * Five default areas split 100% of focus time by target. Each area links
 * Focus Areas; allocation is computed from real session history, so the
 * balance score and advice always reflect measured time — never guesses.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';

export type LifeAreaKey = 'health' | 'relationships' | 'learning' | 'work' | 'finance';

export interface LifeArea {
  id: string;
  key: LifeAreaKey;
  label: string;
  color: string;
  /** Desired share of focus time, 0-100. */
  targetPct: number;
  /** Linked Focus Area ids whose sessions count toward this life area. */
  linkedAreaIds: string[];
  createdAt: number;
  updatedAt: number;
}

const DEFAULTS: Array<{ key: LifeAreaKey; label: string; color: string }> = [
  { key: 'health', label: 'Health', color: '#22c55e' },
  { key: 'relationships', label: 'Relationships', color: '#ec4899' },
  { key: 'learning', label: 'Learning', color: '#3b82f6' },
  { key: 'work', label: 'Work', color: '#f97316' },
  { key: 'finance', label: 'Finance', color: '#eab308' },
];

function seedAreas(): LifeArea[] {
  const now = Date.now();
  return DEFAULTS.map((d) => ({
    id: `life-${d.key}`,
    key: d.key,
    label: d.label,
    color: d.color,
    targetPct: 20,
    linkedAreaIds: [],
    createdAt: now,
    updatedAt: now,
  }));
}

/** Load areas, seeding the five defaults on first run. Never throws. */
export function loadLifeAreas(): LifeArea[] {
  const stored = read<LifeArea[]>(STORAGE_KEYS.lifeAreas);
  if (!Array.isArray(stored) || stored.length === 0) return seedAreas();
  const keys = new Set(DEFAULTS.map((d) => d.key));
  return stored
    .filter((a) => a && typeof a.id === 'string' && keys.has(a.key as LifeAreaKey))
    .map((a) => {
      const def = DEFAULTS.find((d) => d.key === a.key)!;
      return {
        id: a.id,
        key: a.key as LifeAreaKey,
        label: typeof a.label === 'string' && a.label.trim() ? a.label : def.label,
        color: typeof a.color === 'string' ? a.color : def.color,
        targetPct:
          typeof a.targetPct === 'number' && Number.isFinite(a.targetPct)
            ? Math.min(100, Math.max(0, Math.round(a.targetPct)))
            : 20,
        linkedAreaIds: Array.isArray(a.linkedAreaIds)
          ? a.linkedAreaIds.filter((x) => typeof x === 'string')
          : [],
        createdAt: typeof a.createdAt === 'number' ? a.createdAt : Date.now(),
        updatedAt: typeof a.updatedAt === 'number' ? a.updatedAt : Date.now(),
      };
    });
}

export function saveLifeAreas(areas: LifeArea[]): boolean {
  return write(STORAGE_KEYS.lifeAreas, areas);
}

export interface LifeAreaUpdates {
  label?: string;
  color?: string;
  targetPct?: number;
  linkedAreaIds?: string[];
}

export function updateLifeArea(
  areas: LifeArea[],
  id: string,
  updates: LifeAreaUpdates,
): LifeArea[] {
  return areas.map((a) => {
    if (a.id !== id) return a;
    const next: LifeArea = { ...a, updatedAt: Date.now() };
    if (updates.label !== undefined) next.label = updates.label.trim().slice(0, 40) || a.label;
    if (updates.color !== undefined) next.color = updates.color;
    if (updates.targetPct !== undefined && Number.isFinite(updates.targetPct)) {
      next.targetPct = Math.min(100, Math.max(0, Math.round(updates.targetPct)));
    }
    if (updates.linkedAreaIds !== undefined) {
      next.linkedAreaIds = updates.linkedAreaIds.filter((x) => typeof x === 'string');
    }
    return next;
  });
}

/** Restore factory defaults (keeps nothing). */
export function resetLifeAreas(): LifeArea[] {
  return seedAreas();
}

export interface AreaAllocation {
  id: string;
  label: string;
  color: string;
  targetPct: number;
  minutes: number;
  actualPct: number;
}

export interface BalanceReport {
  totalMin: number;
  unassignedMin: number;
  areas: AreaAllocation[];
  /** 0-100: 100 = actual matches targets exactly. */
  score: number;
  /** Most under-served area vs its target (null when balanced). */
  neglected: AreaAllocation | null;
  /** True when work overshoots its target by 10+ points (overtime smell). */
  overtime: boolean;
  advice: string;
}

/**
 * Balance over the trailing window from measured session minutes.
 * Sessions whose focus area is linked nowhere count as unassigned.
 */
export function balanceReport(
  areas: LifeArea[],
  history: Array<{ areaId?: string; min: number; at: number }>,
  now: number = Date.now(),
  days = 7,
): BalanceReport {
  const windowStart = now - Math.max(1, days) * 24 * 60 * 60 * 1000;
  const inWindow = history.filter(
    (s) => typeof s.at === 'number' && s.at >= windowStart && s.at <= now,
  );
  const totalMin = inWindow.reduce((sum, s) => sum + (typeof s.min === 'number' ? s.min : 0), 0);
  const perFocus = new Map<string, number>();
  for (const s of inWindow) {
    if (!s.areaId) continue;
    perFocus.set(s.areaId, (perFocus.get(s.areaId) ?? 0) + (typeof s.min === 'number' ? s.min : 0));
  }
  const allocations: AreaAllocation[] = areas.map((a) => {
    const minutes = a.linkedAreaIds.reduce((sum, id) => sum + (perFocus.get(id) ?? 0), 0);
    return {
      id: a.id,
      label: a.label,
      color: a.color,
      targetPct: a.targetPct,
      minutes,
      actualPct: totalMin > 0 ? (minutes / totalMin) * 100 : 0,
    };
  });
  const assigned = allocations.reduce((sum, a) => sum + a.minutes, 0);
  const drift = allocations.reduce((sum, a) => sum + Math.abs(a.actualPct - a.targetPct), 0);
  const score = Math.max(0, Math.round(100 - drift / 2));

  let neglected: AreaAllocation | null = null;
  for (const a of allocations) {
    if (
      a.actualPct < a.targetPct - 5 &&
      (!neglected || a.targetPct - a.actualPct > neglected.targetPct - neglected.actualPct)
    ) {
      neglected = a;
    }
  }
  const workArea = areas.find((a) => a.key === 'work');
  const workAlloc = workArea ? allocations.find((a) => a.id === workArea.id)! : null;
  const overtime = workAlloc !== null && workAlloc.actualPct > workAlloc.targetPct + 10;

  let advice = 'Balanced week — keep the rhythm.';
  if (totalMin === 0) advice = 'No focus time logged — link Focus Areas to see balance.';
  else if (overtime && neglected)
    advice = `Work is crowding out ${neglected.label} — protect one block for it tomorrow.`;
  else if (overtime) advice = 'Work overshoots its share — schedule a hard stop.';
  else if (neglected) advice = `${neglected.label} is under-served — give it the next open block.`;

  return {
    totalMin,
    unassignedMin: Math.max(0, totalMin - assigned),
    areas: allocations,
    score,
    neglected,
    overtime,
    advice,
  };
}

/* ---------------- burnout gauge (Roadmap 2.4/5.5) ---------------- */

export interface BurnoutInput {
  overtime: boolean;
  /** 1-5 trailing mood average (null when unlogged). */
  mood: number | null;
  /** 1-10 trailing energy average (null when unlogged). */
  energy: number | null;
  /** Frogs picked-but-unfinished share 0-1 (null when no frogs). */
  frogSkipRate: number | null;
}

export interface BurnoutGauge {
  level: 'low' | 'guarded' | 'high';
  reasons: string[];
}

/**
 * Rule-based burnout read from combined signals. Needs at least two
 * weak signals for guarded, four points for high. Never throws.
 */
export function burnoutGauge(input: BurnoutInput): BurnoutGauge {
  let score = 0;
  const reasons: string[] = [];
  if (input.overtime) {
    score += 2;
    reasons.push('Work overshoots its share');
  }
  if (input.mood !== null && Number.isFinite(input.mood) && input.mood < 2.5) {
    score += 2;
    reasons.push('Mood running low');
  }
  if (input.energy !== null && Number.isFinite(input.energy) && input.energy < 4) {
    score += 1;
    reasons.push('Energy running low');
  }
  if (
    input.frogSkipRate !== null &&
    Number.isFinite(input.frogSkipRate) &&
    input.frogSkipRate > 0.5
  ) {
    score += 1;
    reasons.push('Frogs keep slipping');
  }
  return {
    level: score >= 4 ? 'high' : score >= 2 ? 'guarded' : 'low',
    reasons,
  };
}
