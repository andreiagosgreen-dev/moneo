import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persistence';
import { onWriteFailure, safeWrite } from './storageAdapter';

describe('requestPersistentStorage', () => {
  beforeEach(() => localStorage.clear());

  it('asks once and remembers it asked', async () => {
    const persist = vi.fn(async () => true);
    const storage = { persisted: async () => false, persist };
    expect(await requestPersistentStorage(storage)).toBe('persisted');
    expect(await requestPersistentStorage(storage)).toBe('skipped');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does nothing when storage is already persistent or unsupported', async () => {
    const persist = vi.fn(async () => true);
    expect(await requestPersistentStorage({ persisted: async () => true, persist })).toBe(
      'persisted',
    );
    expect(persist).not.toHaveBeenCalled();
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
  });

  it('reports a refusal', async () => {
    expect(
      await requestPersistentStorage({ persisted: async () => false, persist: async () => false }),
    ).toBe('denied');
  });
});

describe('onWriteFailure', () => {
  it('tells listeners when the browser refuses a save', () => {
    const seen: string[] = [];
    const off = onWriteFailure((key) => seen.push(key));
    // A value the browser can't store (here: a cycle) takes the same failure path
    // as a full disk — jsdom's localStorage can't be made to throw on demand.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(safeWrite('moneo:x', cyclic)).toBe(false);
    expect(safeWrite('moneo:x', { a: 1 })).toBe(true);
    off();
    expect(seen).toEqual(['moneo:x']);
  });
});
