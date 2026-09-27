import { describe, expect, it } from 'vitest';
import { onStorageWrite, safeWrite } from './storageAdapter';

describe('onStorageWrite', () => {
  it('notifies only for watched keys whose stored value actually changed', () => {
    const seen: string[] = [];
    const off = onStorageWrite(['moneo:a'], (key) => seen.push(key));
    safeWrite('moneo:a', [1]);
    safeWrite('moneo:a', [1]);
    safeWrite('moneo:b', [1]);
    safeWrite('moneo:a', [2]);
    expect(seen).toEqual(['moneo:a', 'moneo:a']);
    off();
    safeWrite('moneo:a', [3]);
    expect(seen).toHaveLength(2);
  });

  it('never lets a failing listener break the save', () => {
    const off = onStorageWrite(['moneo:a'], () => {
      throw new Error('boom');
    });
    expect(safeWrite('moneo:a', { ok: true })).toBe(true);
    expect(localStorage.getItem('moneo:a')).toBe('{"ok":true}');
    off();
  });
});
