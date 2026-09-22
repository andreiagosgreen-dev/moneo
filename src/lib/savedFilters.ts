/* Saved filters / Smart Views (Faza 18) — named, reusable combinations of
 * existing Task fields (status/priority/projectId/due window). Zero new
 * task data; pure matching over what already exists. Pure functions;
 * storage via STORAGE_KEYS.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import type { Task, TaskPriority, TaskStatus } from './tasks';

export const MAX_SAVED_FILTERS = 20;
const MAX_NAME_LENGTH = 60;

export interface SavedFilter {
  id: string;
  name: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  /** Due within N days from now (inclusive), overdue tasks always match. */
  dueWithinDays?: number;
  createdAt: number;
}

export type FilterCriteria = Omit<SavedFilter, 'id' | 'name' | 'createdAt'>;

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];
const PRIORITIES: TaskPriority[] = ['p0', 'p1', 'p2', 'p3'];

function isStatus(v: unknown): v is TaskStatus {
  return typeof v === 'string' && (STATUSES as string[]).includes(v);
}

function isPriority(v: unknown): v is TaskPriority {
  return typeof v === 'string' && (PRIORITIES as string[]).includes(v);
}

export function loadSavedFilters(): SavedFilter[] {
  const stored = read<unknown[]>(STORAGE_KEYS.savedFilters);
  if (!Array.isArray(stored)) return [];
  const clean: SavedFilter[] = [];
  for (const v of stored) {
    if (!v || typeof v !== 'object') continue;
    const f = v as Record<string, unknown>;
    if (typeof f.id !== 'string' || typeof f.name !== 'string' || !f.name.trim()) continue;
    clean.push({
      id: f.id,
      name: f.name.trim().slice(0, MAX_NAME_LENGTH),
      ...(isStatus(f.status) ? { status: f.status } : {}),
      ...(isPriority(f.priority) ? { priority: f.priority } : {}),
      ...(typeof f.projectId === 'string' && f.projectId ? { projectId: f.projectId } : {}),
      ...(typeof f.dueWithinDays === 'number' && f.dueWithinDays >= 0
        ? { dueWithinDays: f.dueWithinDays }
        : {}),
      createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
    });
  }
  return clean.slice(0, MAX_SAVED_FILTERS);
}

export function saveSavedFilters(filters: SavedFilter[]): boolean {
  return write(STORAGE_KEYS.savedFilters, filters.slice(0, MAX_SAVED_FILTERS));
}

/** Never throws; drops silently once MAX_SAVED_FILTERS is reached. */
export function createSavedFilter(
  filters: SavedFilter[],
  name: string,
  criteria: FilterCriteria,
  now: number = Date.now(),
): SavedFilter[] {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed || filters.length >= MAX_SAVED_FILTERS) return filters;
  const filter: SavedFilter = {
    id: `sf-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    ...criteria,
    createdAt: now,
  };
  return [...filters, filter];
}

export function removeSavedFilter(filters: SavedFilter[], id: string): SavedFilter[] {
  return filters.filter((f) => f.id !== id);
}

/** Pure predicate. Overdue open tasks always satisfy `dueWithinDays`. */
export function matchesFilter(
  task: Task,
  filter: FilterCriteria,
  now: number = Date.now(),
): boolean {
  if (filter.status && task.status !== filter.status) return false;
  if (filter.priority && task.priority !== filter.priority) return false;
  if (filter.projectId && task.projectId !== filter.projectId) return false;
  if (typeof filter.dueWithinDays === 'number') {
    if (typeof task.dueAt !== 'number') return false;
    const horizon = now + filter.dueWithinDays * 24 * 60 * 60 * 1000;
    if (task.dueAt > horizon) return false;
  }
  return true;
}

export function applyFilter(
  tasks: Task[],
  filter: FilterCriteria,
  now: number = Date.now(),
): Task[] {
  return tasks.filter((t) => matchesFilter(t, filter, now));
}
