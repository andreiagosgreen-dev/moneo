import { dayKey, lastNDays, type Session } from "./store";
import { sanitizeIntention } from "./intentions";
import { STORAGE_KEYS } from "./storage/storageKeys";
import {
  hasKey,
  safeRead,
  safeRemove,
  safeWrite,
} from "./storage/storageAdapter";
import { dayKeyInTz, trailingWeekDayKeysInTz } from "./timezone";

/**
 * Focus Areas — lightweight containers answering "which part of my life
 * or work does this focus belong to?". Not project management: no tasks,
 * statuses, deadlines, nesting, colors, or hierarchies.
 */

export const AREA_NAME_MAX = 40;
export const MAX_AREAS = 8;

export interface FocusArea {
  id: string;
  name: string;
  createdAt: number;
  /** Last rename/delete stamp — powers deterministic sync LWW (Gate 9). */
  updatedAt?: number;
  /** Soft-deletion marker. Marked areas stay in storage so sync can
   *  propagate the deletion and history references stay resolvable. */
  deletedAt?: number;
}

/** The user-facing view: active (non-deleted) areas only. */
export function activeAreas(areas: FocusArea[]): FocusArea[] {
  return areas.filter((a) => typeof a.deletedAt !== "number");
}

/**
 * Soft-delete: stamps deletedAt/updatedAt, preserves the entry.
 * Historical sessions are untouched and keep their areaId.
 */
export function markAreaDeleted(
  areas: FocusArea[],
  id: string,
  now: number = Date.now(),
): FocusArea[] {
  return areas.map((a) =>
    a.id === id && typeof a.deletedAt !== "number"
      ? { ...a, deletedAt: now, updatedAt: now }
      : a,
  );
}

const AREAS_KEY = STORAGE_KEYS.focusAreas;
const SELECTED_KEY = STORAGE_KEYS.selectedFocusArea;

/** Deterministic seed for first-time users. Written to storage exactly once. */
const SEED: Array<{ id: string; name: string }> = [
  { id: "area:work", name: "Work" },
  { id: "area:study", name: "Study" },
  { id: "area:personal", name: "Personal" },
];

export function sanitizeAreaName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, AREA_NAME_MAX);
}

function isValidArea(a: unknown): a is FocusArea {
  const x = a as FocusArea | null;
  return (
    !!x &&
    typeof x.id === "string" &&
    x.id.length > 0 &&
    typeof x.name === "string" &&
    x.name.trim().length > 0 &&
    typeof x.createdAt === "number"
  );
}

/** Stable id: crypto.randomUUID when available, safe local fallback otherwise. */
function genId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to local fallback */
  }
  return `area-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function seedDefaults(): FocusArea[] {
  const now = Date.now();
  return SEED.map((s) => ({ ...s, createdAt: now }));
}

/**
 * Defensive load. Missing key → seed defaults (persisted once).
 * Corrupt payload → calm fallback to defaults. Invalid entries are
 * filtered; an empty stored array is respected (user deleted everything).
 */
export function loadFocusAreas(): FocusArea[] {
  if (!hasKey(AREAS_KEY)) {
    const seeded = seedDefaults();
    saveFocusAreas(seeded);
    return seeded;
  }
  const parsed = safeRead<unknown>(AREAS_KEY);
  if (!Array.isArray(parsed)) return seedDefaults();
  const seen = new Set<string>();
  const areas: FocusArea[] = [];
  for (const a of parsed) {
    if (areas.length >= MAX_AREAS) break;
    if (isValidArea(a) && !seen.has(a.id)) {
      seen.add(a.id);
      areas.push({ id: a.id, name: sanitizeAreaName(a.name), createdAt: a.createdAt });
    }
  }
  return areas;
}

export function saveFocusAreas(areas: FocusArea[]) {
  safeWrite(AREAS_KEY, areas);
}

/** Returns the new list, or null when the name is empty or the cap is reached. */
export function createFocusArea(
  areas: FocusArea[],
  name: string,
): FocusArea[] | null {
  const clean = sanitizeAreaName(name);
  if (!clean || areas.length >= MAX_AREAS) return null;
  return [...areas, { id: genId(), name: clean, createdAt: Date.now() }];
}

/** Returns the new list, or null for an unknown id or empty name. */
export function renameFocusArea(
  areas: FocusArea[],
  id: string,
  name: string,
  now: number = Date.now(),
): FocusArea[] | null {
  const clean = sanitizeAreaName(name);
  if (!clean || !areas.some((a) => a.id === id)) return null;
  return areas.map((a) =>
    a.id === id ? { ...a, name: clean, updatedAt: now } : a,
  );
}

/** Deleting an area never touches history — sessions keep their areaId. */
export function deleteFocusArea(areas: FocusArea[], id: string): FocusArea[] {
  return areas.filter((a) => a.id !== id);
}

/** null for unknown/deleted ids — callers render a safe fallback. */
export function resolveAreaName(
  areas: FocusArea[],
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  const found = areas.find((a) => a.id === id);
  // Soft-deleted areas resolve as unknown → UI shows "Deleted area".
  if (!found || typeof found.deletedAt === "number") return null;
  return found.name;
}

/**
 * Capture the immutable round metadata at arming time.
 * The running round keeps exactly these values even if the draft intention
 * or the selected area changes before completion.
 */
export function armRoundFocus(
  draftIntention: string | null | undefined,
  selectedAreaId: string | null | undefined,
  areas: FocusArea[],
): { intention: string | null; areaId: string | null } {
  const areaId =
    typeof selectedAreaId === "string" &&
    areas.some((a) => a.id === selectedAreaId)
      ? selectedAreaId
      : null;
  return { intention: sanitizeIntention(draftIntention ?? null), areaId };
}

export interface AreaSummaryRow {
  areaId: string;
  min: number;
}

/**
 * Minutes per area over the trailing 7 days; area-less sessions excluded.
 * Day grouping uses the given IANA timezone when provided (account-timezone
 * policy), otherwise the device-local day (anonymous default — unchanged).
 */
export function getWeeklyAreaSummary(
  history: Session[],
  timezone?: string,
): AreaSummaryRow[] {
  const week = timezone
    ? new Set(trailingWeekDayKeysInTz(7, timezone))
    : new Set(lastNDays(7).map((d) => dayKey(d)));
  const keyOf = (ts: number) =>
    timezone ? dayKeyInTz(ts, timezone) : dayKey(new Date(ts));
  const map = new Map<string, number>();
  for (const s of history) {
    if (!s.areaId || !week.has(keyOf(s.at))) continue;
    map.set(s.areaId, (map.get(s.areaId) ?? 0) + s.min);
  }
  return [...map.entries()]
    .map(([areaId, min]) => ({ areaId, min }))
    .sort((a, b) => b.min - a.min);
}

/* ---------- selected-area persistence (small UX key) ---------- */

/** Validates against the loaded areas; deleted/corrupt selections → null. */
export function loadSelectedArea(areas: FocusArea[]): string | null {
  const parsed = safeRead<unknown>(SELECTED_KEY);
  if (typeof parsed !== "string") return null;
  return areas.some((a) => a.id === parsed) ? parsed : null;
}

export function saveSelectedArea(id: string | null) {
  if (id === null) safeRemove(SELECTED_KEY);
  else safeWrite(SELECTED_KEY, id);
}
