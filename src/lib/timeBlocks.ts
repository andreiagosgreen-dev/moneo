/* Time blocking — weekly recurring focus blocks, local-first, additive. */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { dayKeyInTz } from './timezone';

/**
 * Time Blocking: recurring weekly blocks ("Deep work 9-11 on Tue/Thu").
 * Sessions that fall inside a block count toward its adherence.
 * Zero external dependencies — fully local, deterministic.
 */

/** 0 = Sunday … 6 = Saturday (Date#getDay convention). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeBlock {
  id: string;
  label: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: Weekday;
  /** Minutes from midnight when the block starts. */
  startMin: number;
  /** Minutes from midnight when the block ends (must be > startMin). */
  endMin: number;
  /** Display color. */
  color: string;
  /** Optional project id linked to the block (defaults to label-only). */
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export const BLOCK_PALETTE = [
  '#ff6242',
  '#3ddc97',
  '#6faeff',
  '#f5b942',
  '#b58cff',
  '#ff7ab6',
  '#5eead4',
] as const;

export function loadBlocks(): TimeBlock[] {
  const stored = read<TimeBlock[]>(STORAGE_KEYS.timeBlocks);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (b) =>
        b &&
        typeof b.id === 'string' &&
        typeof b.label === 'string' &&
        typeof b.weekday === 'number' &&
        typeof b.startMin === 'number' &&
        typeof b.endMin === 'number',
    )
    .map((b) => ({
      id: b.id,
      label: b.label,
      weekday: (b.weekday % 7) as Weekday,
      startMin: clamp(b.startMin, 0, 1439),
      endMin: clamp(b.endMin, 1, 1440),
      color: typeof b.color === 'string' && b.color.length > 0 ? b.color : BLOCK_PALETTE[0],
      ...(typeof b.projectId === 'string' ? { projectId: b.projectId } : {}),
      createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now(),
      updatedAt: typeof b.updatedAt === 'number' ? b.updatedAt : Date.now(),
    }))
    .filter((b) => b.endMin > b.startMin);
}

export function saveBlocks(blocks: TimeBlock[]): boolean {
  return write(STORAGE_KEYS.timeBlocks, blocks);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function createBlock(input: {
  label: string;
  weekday: Weekday;
  startMin: number;
  endMin: number;
  color?: string;
  projectId?: string;
}): TimeBlock | null {
  const label = input.label.trim();
  if (!label) return null;
  if (input.endMin <= input.startMin) return null;
  const now = Date.now();
  return {
    id: blockId(),
    label,
    weekday: input.weekday,
    startMin: clamp(input.startMin, 0, 1439),
    endMin: clamp(input.endMin, 1, 1440),
    color: input.color ?? BLOCK_PALETTE[0],
    ...(input.projectId ? { projectId: input.projectId } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function blockId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function updateBlock(
  blocks: TimeBlock[],
  blockId: string,
  patch: Partial<Omit<TimeBlock, 'id' | 'createdAt'>>,
): TimeBlock[] {
  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    const next = { ...b, ...patch, updatedAt: Date.now() };
    if (next.endMin <= next.startMin) return b;
    return next;
  });
}

export function deleteBlock(blocks: TimeBlock[], blockId: string): TimeBlock[] {
  return blocks.filter((b) => b.id !== blockId);
}

export function blocksForWeekday(blocks: TimeBlock[], weekday: Weekday): TimeBlock[] {
  return blocks.filter((b) => b.weekday === weekday).sort((a, b) => a.startMin - b.startMin);
}

export interface NextBlock {
  block: TimeBlock;
  /** 'now' when the block already started, 'later' when still upcoming. */
  state: 'now' | 'later';
}

/**
 * Next focus block for a weekday at a minute-of-day: the running block if
 * one started, otherwise the next upcoming one. Null when the day is clear.
 * Never throws.
 */
export function nextFocusBlock(
  blocks: TimeBlock[],
  weekday: Weekday,
  nowMin: number,
): NextBlock | null {
  const day = blocksForWeekday(blocks, weekday).filter((b) => b.endMin > nowMin);
  if (day.length === 0) return null;
  const block = day[0];
  return { block, state: block.startMin <= nowMin ? 'now' : 'later' };
}

export interface BlockConflict {
  a: TimeBlock;
  b: TimeBlock;
  overlapMin: number;
}

/**
 * Overlapping block pairs sharing a weekday (Roadmap 3.3 conflict
 * detection). Each unordered pair appears once. Never throws.
 */
export function blockConflicts(blocks: TimeBlock[]): BlockConflict[] {
  const out: BlockConflict[] = [];
  const byDay = new Map<Weekday, TimeBlock[]>();
  for (const b of blocks) {
    const list = byDay.get(b.weekday) ?? [];
    list.push(b);
    byDay.set(b.weekday, list);
  }
  for (const list of byDay.values()) {
    const sorted = list.slice().sort((x, y) => x.startMin - y.startMin);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].startMin >= sorted[i].endMin) break;
        const overlapMin = Math.min(sorted[i].endMin, sorted[j].endMin) - sorted[j].startMin;
        if (overlapMin > 0) out.push({ a: sorted[i], b: sorted[j], overlapMin });
      }
    }
  }
  return out;
}

/** Ids of every block involved in at least one conflict (for badges). */
export function conflictedBlockIds(blocks: TimeBlock[]): Set<string> {
  const ids = new Set<string>();
  for (const c of blockConflicts(blocks)) {
    ids.add(c.a.id);
    ids.add(c.b.id);
  }
  return ids;
}

/* ---------- week helpers ---------- */

/** "YYYY-M-D" key of today minus n days (Monday-based week helpers below). */
export function dayKeyForOffset(offsetDays: number, timezone: string): string {
  return dayKeyInTz(Date.now() - offsetDays * 86400_000, timezone);
}

/** Weekday (0=Sun..6=Sat) of "now" in the requested zone (never local). */
function weekdayNowInTz(timezone: string): number {
  try {
    const short = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(new Date());
    const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
    return idx >= 0 ? idx : new Date().getDay();
  } catch {
    return new Date().getDay();
  }
}

/** Monday-first view: the 7 day keys of the current week, oldest → newest. */
export function currentWeekKeys(timezone: string): string[] {
  const wd = weekdayNowInTz(timezone);
  const offset = wd === 0 ? 6 : wd - 1; // Monday = 0
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    keys.push(dayKeyForOffset(offset - i, timezone));
  }
  return keys;
}

/** Weekday (0=Sun..6=Sat) of a "YYYY-M-D" key in local wall time. */
export function weekdayOfKey(key: string): Weekday {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() as Weekday;
}

/** Minute-of-day for a timestamp in the given zone. */
export function minuteOfDayInTz(ts: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(ts));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return (h % 24) * 60 + m;
}

/* ---------- adherence ---------- */

export interface BlockAdherence {
  /** Planned minutes across all blocks for that day. */
  plannedMin: number;
  /** Focused minutes that landed inside a planned block window. */
  actualMin: number;
  /** `actual/planned`, clamped 0..100, 0 when there is nothing planned. */
  pct: number;
}

/**
 * Adherence for one calendar day: how much of the day's planned blocks
 * actually got focus. Sessions are matched by weekday + minute window.
 */
export function adherenceForDay(
  history: Array<{ at: number; min: number }>,
  blocks: TimeBlock[],
  dateKey: string,
  timezone: string,
): BlockAdherence {
  const weekday = weekdayOfKey(dateKey);
  const spans = blocksForWeekday(blocks, weekday);
  if (spans.length === 0) {
    return { plannedMin: 0, actualMin: 0, pct: 0 };
  }
  const plannedMin = spans.reduce((sum, b) => sum + (b.endMin - b.startMin), 0);

  let actualMin = 0;
  for (const s of history) {
    if (dayKeyInTz(s.at, timezone) !== dateKey) continue;
    const mod = minuteOfDayInTz(s.at, timezone);
    const endMod = Math.min(1439, mod + s.min);
    const inside = spans.some((b) => spliceOverlap(mod, endMod, b.startMin, b.endMin) > 0);
    if (inside) actualMin += s.min;
  }

  const pct = plannedMin > 0 ? Math.min(100, Math.round((actualMin / plannedMin) * 100)) : 0;
  return { plannedMin, actualMin, pct };
}

/** Returns the length of the overlap between [aStart,aEnd] and [bStart,bEnd]. */
function spliceOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}
