import { STORAGE_KEYS } from '../storage/storageKeys';

/**
 * Pro full-data sync: which local stores travel to the account, and how
 * each one is cut into independently-merged records.
 *
 * - list:  array of objects with a stable id field → one record per item.
 * - map:   plain object keyed by id/day → one record per key.
 * - set:   array of strings → one record per string (union-friendly).
 * - value: the whole stored value is one record.
 * - object-list: object holding one list field → one record per list item
 *   (`e:<id>`) plus one `rest` record for every other field, so items added
 *   on two devices merge instead of overwriting each other.
 *
 * Focus sessions, focus areas and settings are NOT here: they have their own
 * tables and engine (`syncEngine.ts`) and sync for every signed-in user.
 * Device preferences (theme, language, atmosphere), AI keys and consent,
 * assistant chat and bookkeeping flags stay on the device by design.
 */

export type CollectionShape =
  | { kind: 'list'; idField: string }
  | { kind: 'map' }
  | { kind: 'set' }
  | { kind: 'value' }
  | {
      kind: 'object-list';
      list: string;
      idField: string;
      /** Numeric item field the merged list is kept sorted by (ascending). */
      sortBy?: string;
    };

export interface ProCollection {
  /** Cloud collection name (`user_records.collection`). Never rename. */
  name: string;
  /** localStorage key holding the store. */
  key: string;
  shape: CollectionShape;
}

const list = (idField = 'id'): CollectionShape => ({ kind: 'list', idField });

export const PRO_SYNC_COLLECTIONS: readonly ProCollection[] = [
  { name: 'projects', key: STORAGE_KEYS.projects, shape: list() },
  { name: 'tasks', key: STORAGE_KEYS.tasks, shape: list() },
  { name: 'goals', key: STORAGE_KEYS.goals, shape: list() },
  { name: 'objectives', key: STORAGE_KEYS.objectives, shape: list() },
  { name: 'habits', key: STORAGE_KEYS.habits, shape: list() },
  { name: 'habit_log', key: STORAGE_KEYS.habitLog, shape: { kind: 'map' } },
  { name: 'journal', key: STORAGE_KEYS.journal, shape: { kind: 'map' } },
  { name: 'time_off', key: STORAGE_KEYS.timeOff, shape: { kind: 'set' } },
  { name: 'energy_log', key: STORAGE_KEYS.energyLog, shape: list() },
  { name: 'life_areas', key: STORAGE_KEYS.lifeAreas, shape: list() },
  { name: 'life_map', key: STORAGE_KEYS.lifeMap, shape: list() },
  { name: 'skills', key: STORAGE_KEYS.skills, shape: list() },
  { name: 'time_blocks', key: STORAGE_KEYS.timeBlocks, shape: list() },
  { name: 'ivy_plans', key: STORAGE_KEYS.ivyPlans, shape: list('dateKey') },
  { name: 'frog_log', key: STORAGE_KEYS.frogLog, shape: { kind: 'map' } },
  { name: 'sprints', key: STORAGE_KEYS.sprints, shape: list() },
  { name: 'board_config', key: STORAGE_KEYS.boardConfig, shape: { kind: 'value' } },
  { name: 'waterfall', key: STORAGE_KEYS.waterfall, shape: list() },
  { name: 'links', key: STORAGE_KEYS.links, shape: list() },
  { name: 'saved_filters', key: STORAGE_KEYS.savedFilters, shape: list() },
  { name: 'roadmaps', key: STORAGE_KEYS.roadmaps, shape: list() },
  {
    name: 'workouts',
    key: STORAGE_KEYS.workouts,
    shape: { kind: 'object-list', list: 'log', idField: 'id', sortBy: 'startedAt' },
  },
];

export const PRO_SYNC_KEYS: readonly string[] = PRO_SYNC_COLLECTIONS.map((c) => c.key);

export const MAX_RECORD_ID_LENGTH = 200;
const VALUE_ID = 'value';
const REST_ID = 'rest';
const ITEM_PREFIX = 'e:';

function validId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_RECORD_ID_LENGTH;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Cut a stored value into records. Malformed values yield no records (never throws). */
export function splitRecords(shape: CollectionShape, value: unknown): Map<string, unknown> {
  const out = new Map<string, unknown>();
  switch (shape.kind) {
    case 'list':
      if (!Array.isArray(value)) return out;
      for (const item of value) {
        if (!isPlainObject(item)) continue;
        const id = item[shape.idField];
        if (validId(id) && !out.has(id)) out.set(id, item);
      }
      return out;
    case 'map':
      if (!isPlainObject(value)) return out;
      for (const [id, v] of Object.entries(value)) {
        if (validId(id) && v !== undefined && v !== null) out.set(id, v);
      }
      return out;
    case 'set':
      if (!Array.isArray(value)) return out;
      for (const v of value) if (validId(v)) out.set(v, true);
      return out;
    case 'value':
      if (value !== undefined && value !== null) out.set(VALUE_ID, value);
      return out;
    case 'object-list': {
      if (!isPlainObject(value)) return out;
      const { [shape.list]: items, ...rest } = value;
      if (Object.keys(rest).length > 0) out.set(REST_ID, rest);
      for (const [id, item] of splitRecords({ kind: 'list', idField: shape.idField }, items)) {
        const rid = ITEM_PREFIX + id;
        if (validId(rid)) out.set(rid, item);
      }
      return out;
    }
  }
}

export interface RecordChanges {
  upserts: Map<string, unknown>;
  deletes: Set<string>;
}

/**
 * Apply remote record changes onto the current stored value, preserving
 * local order and any items this adapter could not identify. New records
 * are appended in the order given. `undefined` means "remove the key".
 */
export function joinRecords(
  shape: CollectionShape,
  current: unknown,
  { upserts, deletes }: RecordChanges,
): unknown {
  switch (shape.kind) {
    case 'list': {
      const base = Array.isArray(current) ? current : [];
      const seen = new Set<string>();
      const out: unknown[] = [];
      for (const item of base) {
        const id = isPlainObject(item) ? item[shape.idField] : undefined;
        if (!validId(id) || seen.has(id)) {
          out.push(item);
          continue;
        }
        seen.add(id);
        if (deletes.has(id)) continue;
        out.push(upserts.has(id) ? upserts.get(id) : item);
      }
      for (const [id, v] of upserts) if (!seen.has(id)) out.push(v);
      return out;
    }
    case 'map': {
      const out: Record<string, unknown> = isPlainObject(current) ? { ...current } : {};
      for (const id of deletes) delete out[id];
      for (const [id, v] of upserts) out[id] = v;
      return out;
    }
    case 'set': {
      const base = Array.isArray(current) ? current.filter((v) => typeof v === 'string') : [];
      const out = base.filter((v) => !deletes.has(v));
      for (const id of upserts.keys()) if (!out.includes(id)) out.push(id);
      return out;
    }
    case 'value':
      if (upserts.has(VALUE_ID)) return upserts.get(VALUE_ID);
      if (deletes.has(VALUE_ID)) return undefined;
      return current;
    case 'object-list': {
      const base = isPlainObject(current) ? current : {};
      const { [shape.list]: items, ...rest } = base;
      const itemChanges: RecordChanges = { upserts: new Map(), deletes: new Set() };
      for (const [id, v] of upserts) {
        if (id.startsWith(ITEM_PREFIX)) itemChanges.upserts.set(id.slice(ITEM_PREFIX.length), v);
      }
      for (const id of deletes) {
        if (id.startsWith(ITEM_PREFIX)) itemChanges.deletes.add(id.slice(ITEM_PREFIX.length));
      }
      const list = joinRecords(
        { kind: 'list', idField: shape.idField },
        items,
        itemChanges,
      ) as unknown[];
      if (shape.sortBy) {
        const key = shape.sortBy;
        const at = (v: unknown) => {
          const n = isPlainObject(v) ? v[key] : undefined;
          return typeof n === 'number' && Number.isFinite(n) ? n : 0;
        };
        list.sort((a, b) => at(a) - at(b));
      }
      const restUpsert = upserts.get(REST_ID);
      const nextRest = isPlainObject(restUpsert) ? restUpsert : deletes.has(REST_ID) ? {} : rest;
      return { ...nextRest, [shape.list]: list };
    }
  }
}
