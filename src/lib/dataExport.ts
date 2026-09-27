/**
 * Full data export / import (JSON) — free for everyone (data portability).
 *
 * Export = every Moneo key in this browser + (when signed in) the synced
 * cloud rows the client can already read. Never included: auth/session
 * tokens (Supabase keeps them under `sb-*`, outside the Moneo namespace),
 * sync bookkeeping, and the BYOK AI key unless the user opts in.
 *
 * Import only replaces LOCAL data; cloud/account data is never written
 * from here — the sync engine reconciles on its own.
 */
import { isMoneoLocalKey } from './localDataReset';
import { STORAGE_KEYS } from './storage/storageKeys';

export const EXPORT_FORMAT = 'moneo-export';
export const EXPORT_VERSION = 1;

/** Device bookkeeping, not user data: neither exported nor overwritten on import. */
const DEVICE_ONLY_KEYS: ReadonlySet<string> = new Set([STORAGE_KEYS.syncState]);

export interface CloudExport {
  email: string | null;
  sessions: unknown[] | null;
  areas: unknown[] | null;
  settings: unknown | null;
  subscription: { status: string; planId: string; currentPeriodEnd: number | null } | null;
}

export interface MoneoExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  includesAiKeys: boolean;
  /** Moneo localStorage keys whose value is JSON, parsed for readability. */
  local: Record<string, unknown>;
  /** Moneo localStorage keys whose value is not JSON, verbatim. */
  localRaw: Record<string, string>;
  cloud: CloudExport | null;
}

export interface ExportOptions {
  includeAiKeys?: boolean;
  cloud?: CloudExport | null;
  now?: Date;
}

function isExportableKey(key: string): boolean {
  return (isMoneoLocalKey(key) || key === STORAGE_KEYS.locale) && !DEVICE_ONLY_KEYS.has(key);
}

function stripAiKey(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return { ...(value as Record<string, unknown>), key: '' };
}

export function buildExport(storage: Storage, opts: ExportOptions = {}): MoneoExport {
  const includeAiKeys = opts.includeAiKeys === true;
  const local: Record<string, unknown> = {};
  const localRaw: Record<string, string> = {};
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && isExportableKey(key)) keys.push(key);
  }
  for (const key of keys.sort()) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      localRaw[key] = raw;
      continue;
    }
    local[key] = key === STORAGE_KEYS.aiByok && !includeAiKeys ? stripAiKey(parsed) : parsed;
  }
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: (opts.now ?? new Date()).toISOString(),
    includesAiKeys: includeAiKeys,
    local,
    localRaw,
    cloud: opts.cloud ?? null,
  };
}

export function exportFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `moneo-export-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export type ImportError = 'invalid-json' | 'wrong-format' | 'unsupported-version' | 'invalid-shape';

export type ParseResult = { ok: true; data: MoneoExport } | { ok: false; error: ImportError };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function parseExport(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (!isPlainObject(data) || data.format !== EXPORT_FORMAT) {
    return { ok: false, error: 'wrong-format' };
  }
  if (
    typeof data.version !== 'number' ||
    !Number.isInteger(data.version) ||
    data.version < 1 ||
    data.version > EXPORT_VERSION
  ) {
    return { ok: false, error: 'unsupported-version' };
  }
  const local = data.local;
  const localRaw = data.localRaw ?? {};
  if (!isPlainObject(local) || !isPlainObject(localRaw)) {
    return { ok: false, error: 'invalid-shape' };
  }
  if (Object.values(localRaw).some((v) => typeof v !== 'string')) {
    return { ok: false, error: 'invalid-shape' };
  }
  return {
    ok: true,
    data: {
      format: EXPORT_FORMAT,
      version: data.version,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
      includesAiKeys: data.includesAiKeys === true,
      local,
      localRaw: localRaw as Record<string, string>,
      cloud: isPlainObject(data.cloud) ? (data.cloud as unknown as CloudExport) : null,
    },
  };
}

export interface ImportSummary {
  written: number;
}

function snapshotMoneoKeys(storage: Storage): Map<string, string> {
  const snap = new Map<string, string>();
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null || !(isMoneoLocalKey(key) || key === STORAGE_KEYS.locale)) continue;
    const v = storage.getItem(key);
    if (v !== null) snap.set(key, v);
  }
  return snap;
}

function hasAiKey(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const v = JSON.parse(raw) as { key?: unknown };
    return typeof v?.key === 'string' && v.key.length > 0;
  } catch {
    return false;
  }
}

/**
 * Replace this browser's Moneo data with `data`. All-or-nothing: on any
 * write failure (e.g. storage quota) the previous data is restored and the
 * error is rethrown. The device's sync bookkeeping is kept, the language
 * is kept unless the file carries one, and an AI key already on this
 * device survives an import without one.
 */
export function applyImport(storage: Storage, data: MoneoExport): ImportSummary {
  const before = snapshotMoneoKeys(storage);
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(data.local)) {
    if (!isExportableKey(key)) continue;
    entries.push([key, JSON.stringify(value)]);
  }
  for (const [key, value] of Object.entries(data.localRaw)) {
    if (!isExportableKey(key)) continue;
    entries.push([key, value]);
  }
  const incoming = new Map(entries);
  const currentByok = before.get(STORAGE_KEYS.aiByok);
  if (hasAiKey(currentByok) && !hasAiKey(incoming.get(STORAGE_KEYS.aiByok))) {
    incoming.set(STORAGE_KEYS.aiByok, currentByok!);
  }
  const currentLocale = before.get(STORAGE_KEYS.locale);
  if (currentLocale !== undefined && !incoming.has(STORAGE_KEYS.locale)) {
    incoming.set(STORAGE_KEYS.locale, currentLocale);
  }

  const replaceable = [...before.keys()].filter((k) => !DEVICE_ONLY_KEYS.has(k));
  try {
    for (const key of replaceable) storage.removeItem(key);
    for (const [key, value] of incoming) storage.setItem(key, value);
  } catch (e) {
    for (const key of incoming.keys()) storage.removeItem(key);
    for (const [key, value] of before) storage.setItem(key, value);
    throw e;
  }
  return { written: incoming.size };
}

/** Trigger a browser download of the export. */
export function downloadExport(data: MoneoExport, now: Date = new Date()): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(now);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
