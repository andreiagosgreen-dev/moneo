import { describe, expect, it } from 'vitest';
import { clearMoneoLocalStorage, isMoneoLocalKey } from './localDataReset';
import { STORAGE_KEYS } from './storage/storageKeys';

/** Spec-shaped Storage (the global test mock has no key()/length). */
function memoryStorage(entries: Record<string, string> = {}): Storage {
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
  };
}

describe('localDataReset', () => {
  it('treats every registered product key except the language as Moneo data', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(isMoneoLocalKey(key)).toBe(key !== STORAGE_KEYS.locale);
    }
    expect(isMoneoLocalKey('moneo.coach.dismissed.aziEmpty')).toBe(true);
    expect(isMoneoLocalKey('sb-yvkguiiqojwyosvkxzbt-auth-token')).toBe(false);
    expect(isMoneoLocalKey('other-app')).toBe(false);
  });

  it('removes Moneo keys and keeps the language plus unrelated keys', () => {
    const storage = memoryStorage({
      [STORAGE_KEYS.tasks]: JSON.stringify([{ id: 't1' }]),
      [STORAGE_KEYS.history]: JSON.stringify([{ id: 's1' }]),
      [STORAGE_KEYS.focusAreas]: '[]',
      'moneo.coach.dismissed.aziEmpty': '2026-9-27',
      [STORAGE_KEYS.locale]: JSON.stringify('ro'),
      'sb-x-auth-token': 'session',
      'other-app': 'keep',
    });

    expect(clearMoneoLocalStorage(storage)).toBe(4);
    expect(storage.getItem(STORAGE_KEYS.tasks)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.history)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.focusAreas)).toBeNull();
    expect(storage.getItem('moneo.coach.dismissed.aziEmpty')).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.locale)).toBe(JSON.stringify('ro'));
    expect(storage.getItem('sb-x-auth-token')).toBe('session');
    expect(storage.getItem('other-app')).toBe('keep');
  });

  it('is a no-op on empty storage', () => {
    expect(clearMoneoLocalStorage(memoryStorage())).toBe(0);
  });
});
