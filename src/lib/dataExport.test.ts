import { describe, expect, it } from 'vitest';
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  applyImport,
  buildExport,
  exportFileName,
  parseExport,
  type CloudExport,
} from './dataExport';
import { STORAGE_KEYS } from './storage/storageKeys';

/** Spec-shaped Storage (the global test mock has no key()/length). */
function memoryStorage(entries: Record<string, string> = {}): Storage & { dump(): object } {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    dump: () => Object.fromEntries(map),
  };
}

const AI_SECRET = 'sk-test-SECRET-123';

function populated() {
  return memoryStorage({
    [STORAGE_KEYS.tasks]: JSON.stringify([{ id: 't1', title: 'Write' }]),
    [STORAGE_KEYS.history]: JSON.stringify([{ id: 's1', durationMin: 25 }]),
    [STORAGE_KEYS.locale]: JSON.stringify('ro'),
    [STORAGE_KEYS.aiByok]: JSON.stringify({ provider: 'openai', key: AI_SECRET, webSearch: true }),
    [STORAGE_KEYS.syncState]: JSON.stringify({ deviceId: 'dev-A', initialized: true }),
    'moneo.coach.dismissed.aziEmpty': '2026-9-27',
    'sb-yvkguiiqojwyosvkxzbt-auth-token': JSON.stringify({ access_token: 'jwt-SECRET' }),
    'other-app': 'x',
  });
}

describe('buildExport', () => {
  it('carries format, version, date and every Moneo key', () => {
    const now = new Date('2026-09-27T10:00:00Z');
    const data = buildExport(populated(), { now });
    expect(data.format).toBe(EXPORT_FORMAT);
    expect(data.version).toBe(EXPORT_VERSION);
    expect(data.exportedAt).toBe('2026-09-27T10:00:00.000Z');
    expect(data.local[STORAGE_KEYS.tasks]).toEqual([{ id: 't1', title: 'Write' }]);
    expect(data.local[STORAGE_KEYS.locale]).toBe('ro');
    expect(data.localRaw['moneo.coach.dismissed.aziEmpty']).toBe('2026-9-27');
    expect(data.cloud).toBeNull();
  });

  it('never exports auth tokens, sync bookkeeping or unrelated keys', () => {
    const text = JSON.stringify(buildExport(populated()));
    expect(text).not.toContain('jwt-SECRET');
    expect(text).not.toContain('auth-token');
    expect(text).not.toContain('dev-A');
    expect(text).not.toContain('other-app');
  });

  it('strips the AI key by default and includes it only when asked', () => {
    const off = buildExport(populated());
    expect(off.includesAiKeys).toBe(false);
    expect(JSON.stringify(off)).not.toContain(AI_SECRET);
    expect(off.local[STORAGE_KEYS.aiByok]).toEqual({
      provider: 'openai',
      key: '',
      webSearch: true,
    });

    const on = buildExport(populated(), { includeAiKeys: true });
    expect(on.includesAiKeys).toBe(true);
    expect(on.local[STORAGE_KEYS.aiByok]).toEqual({
      provider: 'openai',
      key: AI_SECRET,
      webSearch: true,
    });
  });

  it('embeds the cloud section as given', () => {
    const cloud: CloudExport = {
      email: 'a@example.com',
      sessions: [{ id: 's1' }],
      areas: [],
      settings: { focus_min: 25 },
      subscription: { status: 'active', planId: 'pro-monthly', currentPeriodEnd: null },
    };
    expect(buildExport(memoryStorage(), { cloud }).cloud).toEqual(cloud);
  });

  it('names the file moneo-export-YYYY-MM-DD.json (local date)', () => {
    expect(exportFileName(new Date(2026, 0, 5, 23, 30))).toBe('moneo-export-2026-01-05.json');
  });
});

describe('parseExport', () => {
  const valid = () => JSON.stringify(buildExport(populated()));

  it('accepts a real export', () => {
    const r = parseExport(valid());
    expect(r.ok).toBe(true);
  });

  it('rejects broken JSON, foreign files, future versions and bad shapes', () => {
    expect(parseExport('{nope')).toEqual({ ok: false, error: 'invalid-json' });
    expect(parseExport('[]')).toEqual({ ok: false, error: 'wrong-format' });
    expect(parseExport(JSON.stringify({ format: 'other', version: 1 }))).toEqual({
      ok: false,
      error: 'wrong-format',
    });
    const base = JSON.parse(valid());
    expect(parseExport(JSON.stringify({ ...base, version: EXPORT_VERSION + 1 }))).toEqual({
      ok: false,
      error: 'unsupported-version',
    });
    expect(parseExport(JSON.stringify({ ...base, version: '1' }))).toEqual({
      ok: false,
      error: 'unsupported-version',
    });
    expect(parseExport(JSON.stringify({ ...base, local: [] }))).toEqual({
      ok: false,
      error: 'invalid-shape',
    });
    expect(parseExport(JSON.stringify({ ...base, localRaw: { 'moneo:x': 5 } }))).toEqual({
      ok: false,
      error: 'invalid-shape',
    });
  });
});

describe('applyImport', () => {
  it('round-trips: export → fresh device → identical Moneo data', () => {
    const source = populated();
    const file = JSON.stringify(buildExport(source, { includeAiKeys: true }));
    const parsed = parseExport(file);
    if (!parsed.ok) throw new Error('parse failed');

    const target = memoryStorage();
    applyImport(target, parsed.data);
    for (const key of [
      STORAGE_KEYS.tasks,
      STORAGE_KEYS.history,
      STORAGE_KEYS.locale,
      STORAGE_KEYS.aiByok,
      'moneo.coach.dismissed.aziEmpty',
    ]) {
      expect(target.getItem(key)).toBe(source.getItem(key));
    }
    expect(target.getItem(STORAGE_KEYS.syncState)).toBeNull();
    expect(target.getItem('sb-yvkguiiqojwyosvkxzbt-auth-token')).toBeNull();
  });

  it('replaces local data but keeps this device’s sync state, tokens and AI key', () => {
    const file = buildExport(
      memoryStorage({ [STORAGE_KEYS.projects]: JSON.stringify([{ id: 'p-new' }]) }),
    );
    const target = populated();
    applyImport(target, file);
    expect(target.getItem(STORAGE_KEYS.tasks)).toBeNull();
    expect(target.getItem(STORAGE_KEYS.projects)).toBe(JSON.stringify([{ id: 'p-new' }]));
    expect(target.getItem(STORAGE_KEYS.syncState)).toContain('dev-A');
    expect(target.getItem('sb-yvkguiiqojwyosvkxzbt-auth-token')).toContain('jwt-SECRET');
    expect(target.getItem('other-app')).toBe('x');
    expect(target.getItem(STORAGE_KEYS.aiByok)).toContain(AI_SECRET);
    expect(target.getItem(STORAGE_KEYS.locale)).toBe(JSON.stringify('ro'));
  });

  it('ignores keys outside the Moneo namespace smuggled into a file', () => {
    const parsed = parseExport(
      JSON.stringify({
        format: EXPORT_FORMAT,
        version: 1,
        local: { 'sb-x-auth-token': { access_token: 'evil' }, [STORAGE_KEYS.goals]: [] },
        localRaw: { 'other-app': 'evil', [STORAGE_KEYS.syncState]: 'evil' },
      }),
    );
    if (!parsed.ok) throw new Error('parse failed');
    const target = memoryStorage();
    applyImport(target, parsed.data);
    expect(target.dump()).toEqual({ [STORAGE_KEYS.goals]: '[]' });
  });

  it('restores the previous data when a write fails (quota)', () => {
    const target = populated();
    const before = target.dump();
    const file = buildExport(memoryStorage({ [STORAGE_KEYS.goals]: '[1]' }));
    const realSet = target.setItem;
    let armed = true;
    target.setItem = (k: string, v: string) => {
      if (armed && k === STORAGE_KEYS.goals) {
        armed = false;
        throw new Error('QuotaExceededError');
      }
      realSet(k, v);
    };
    expect(() => applyImport(target, file)).toThrow('QuotaExceededError');
    expect(target.dump()).toEqual(before);
  });
});
