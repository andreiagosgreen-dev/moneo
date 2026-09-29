/* Experience points & ranks — derived, never stored. XP is recomputed from
 * the work the user already has on this device (focus sessions, finished
 * tasks, habit check-ins, finished phases and projects), so there is no
 * counter to drift, double-count or "fix". The only persisted bit is the
 * last level the user has already seen, so a level-up celebrates once.
 *
 * The rules and curve live in `xpCore.ts` (shared with the Worker).
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead, safeWrite } from './storage/storageAdapter';
import type { Project } from './projects';
import type { HabitLog } from './habits';
import type { Session } from './store';
import type { Task } from './tasks';
import type { WaterfallPhase } from './waterfall';
import { computeXp as computeXpCore, type XpBreakdown } from './xpCore';

export {
  MAX_LEVEL,
  RANKS,
  XP_RULES,
  finishedProjectIds,
  focusXp,
  habitXp,
  levelFromXp,
  phaseXp,
  rankForLevel,
  taskXp,
  xpAtLevel,
  xpToNext,
} from './xpCore';
export type { LevelInfo, RankId, RankInfo, XpBreakdown } from './xpCore';

export interface XpInput {
  history: Session[];
  tasks: Task[];
  habitLog: HabitLog;
  phases: WaterfallPhase[];
  projects: Project[];
}

export function computeXp(input: XpInput): XpBreakdown {
  return computeXpCore(input);
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
